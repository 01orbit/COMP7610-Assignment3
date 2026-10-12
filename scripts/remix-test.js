/*
 * Run in Remix: compile CPT.sol and CampusMemo.sol, select Remix VM, then
 * right-click this file -> Run. Uses fresh deployments, never existing NFTs.
 * The default image URL is an OFFLINE fixture, not a network dependency.
 * This file also exports its exact test runner for local Hardhat verification.
 */
const TEST_IMAGE_URI = "https://raw.githubusercontent.com/example/campus-memo/0123456789abcdef0123456789abcdef01234567/campus-memo.png";

async function runAssignmentTests({ ethers, provider, readArtifact, imageURI = TEST_IMAGE_URI, log = console.log }) {
  const network = await provider.getNetwork();
  if (![1337, 31337].includes(Number(network.chainId))) {
    throw new Error("This destructive test suite only runs on a local VM (chain 1337/31337). Select Remix VM, not Sepolia or a wallet.");
  }
  const accounts = await provider.listAccounts();
  if (accounts.length < 4) throw new Error("Select Remix VM with at least four unlocked test accounts.");
  const signers = await Promise.all([0, 1, 2, 3].map(index => provider.getSigner(index)));
  const [A, B, C, D] = signers;
  const [a, b, c, d] = await Promise.all(signers.map(signer => signer.getAddress()));
  const parseEther = ethers.parseEther || ethers.utils.parseEther;
  const abiCoder = ethers.AbiCoder ? ethers.AbiCoder.defaultAbiCoder() : ethers.utils.defaultAbiCoder;
  const decodeBase64 = ethers.decodeBase64 || ethers.utils.base64.decode;
  const toUtf8String = ethers.toUtf8String || ethers.utils.toUtf8String;
  const metadataPrefix = "data:application/json;base64,";
  const points = amount => parseEther(String(amount));
  const zero = "0x0000000000000000000000000000000000000000";
  let checks = 0;
  let assertions = 0;
  const deployments = [];
  const interfaces = [];

  function equal(actual, expected, label) {
    assertions++;
    const normalize = value => /^0x[0-9a-f]{40}$/i.test(String(value)) ? String(value).toLowerCase() : String(value);
    if (normalize(actual) !== normalize(expected)) {
      throw new Error(`${label}: expected ${expected}, received ${actual}`);
    }
  }
  function metadata(uri, id) {
    equal(uri.slice(0, metadataPrefix.length), metadataPrefix, `NFT #${id} data URI prefix`);
    const decoded = JSON.parse(toUtf8String(decodeBase64(uri.slice(metadataPrefix.length))));
    equal(decoded.name, `Campus-Memo #${id}`, `NFT #${id} metadata name`);
    equal(decoded.description, "A limited-edition commemorative NFT of the HKU Drone Club.", `NFT #${id} metadata description`);
    equal(decoded.image, imageURI, `NFT #${id} metadata image`);
    equal(decoded.attributes[0].trait_type, "Edition", `NFT #${id} edition trait`);
    equal(decoded.attributes[0].value, id, `NFT #${id} edition value`);
    return decoded;
  }
  async function step(name, action) {
    log(`RUN  ${name}`);
    await action();
    checks++;
    log(`PASS ${checks}: ${name}`);
  }
  async function address(contract) {
    return contract.getAddress ? contract.getAddress() : contract.address;
  }
  async function send(contract, signer, method, ...args) {
    const transaction = await contract.connect(signer)[method](...args);
    const receipt = await transaction.wait();
    equal(receipt.status, 1, `${method} transaction status`);
    return receipt;
  }
  function staticCall(contract, signer, method, ...args) {
    const connected = contract.connect(signer);
    return connected.callStatic
      ? connected.callStatic[method](...args)
      : connected.getFunction(method).staticCall(...args);
  }
  // An RPC/network failure must not be mistaken for an expected revert.
  async function reverts(contract, signer, method, args, expected) {
    let caught;
    try { await staticCall(contract, signer, method, ...args); }
    catch (error) { caught = error; }
    if (!caught) throw new Error(`${method} unexpectedly succeeded; expected ${expected}`);
    const candidates = [caught.data, caught.error?.data, caught.info?.error?.data, caught.error?.error?.data];
    const data = candidates.map(value => typeof value === "string" ? value : value?.data)
      .find(value => typeof value === "string" && /^0x[0-9a-f]+$/i.test(value) && value.length >= 10);
    let actual;
    if (data?.startsWith("0x08c379a0")) {
      actual = abiCoder.decode(["string"], "0x" + data.slice(10))[0];
    } else if (data) {
      // NFT calls can bubble up a CPT custom error, so decode both ABIs.
      for (const iface of [contract.interface, ...interfaces]) {
        try { actual = iface.parseError(data)?.name; } catch (_) { continue; }
        if (actual) break;
      }
    }
    // Some providers decode Error(string) themselves instead of exposing data.
    if (!actual && caught.reason === expected) actual = caught.reason;
    equal(actual || "unrecognized RPC error", expected, `${method} revert reason`);
  }
  function event(receipt, contract, name, expected) {
    for (const entry of receipt.logs) {
      if (entry.address.toLowerCase() !== (contract.target || contract.address).toLowerCase()) continue;
      let decoded;
      try { decoded = contract.interface.parseLog(entry); } catch (_) { continue; }
      if (decoded?.name !== name) continue;
      expected.forEach((value, index) => equal(decoded.args[index], value, `${name} argument ${index}`));
      return;
    }
    throw new Error(`${name} event missing`);
  }
  async function deploy(name, args) {
    const artifact = await readArtifact(name);
    const bytecode = artifact.data?.bytecode?.object || artifact.bytecode?.object || artifact.bytecode;
    if (!Array.isArray(artifact.abi) || typeof bytecode !== "string" || bytecode.length < 10) {
      throw new Error(`Invalid ${name} artifact. Compile both contracts with contract metadata generation enabled.`);
    }
    const factory = new ethers.ContractFactory(artifact.abi, bytecode.startsWith("0x") ? bytecode : "0x" + bytecode, A);
    interfaces.push(factory.interface);
    const contract = await factory.deploy(...args);
    if (contract.waitForDeployment) await contract.waitForDeployment();
    else await contract.deployed();
    const transaction = contract.deploymentTransaction ? contract.deploymentTransaction() : contract.deployTransaction;
    const record = { contract: name, address: await address(contract), transaction: transaction.hash };
    deployments.push(record);
    log(`DEPLOY ${JSON.stringify(record)}`);
    return contract;
  }
  async function fixture() {
    const cpt = await deploy("CPT", [a]);
    const T = await address(cpt);
    const nft = await deploy("CampusMemo", [T, imageURI]);
    return { cpt, nft, T, N: await address(nft) };
  }
  async function onboard(cpt, signer, member) {
    await send(cpt, signer, "applyForMembership");
    await send(cpt, A, "approveMembership", member);
  }
  const { cpt, nft, T, N } = await fixture();
  async function balances(expected, owner) {
    const actual = await Promise.all([a, b, c, T].map(account => cpt.balanceOf(account)));
    actual.push(await cpt.totalSupply());
    actual.forEach((value, index) => equal(value, points(expected[index]), `balance/supply ${index}`));
    if (owner) equal(await nft.ownerOf(1), owner, "NFT #1 owner");
  }

  await step("Initial treasury, roles, metadata and missing NFTs", async () => {
    await balances([0, 0, 0, 1000, 1000]);
    equal(await cpt.name(), "Club Point Token", "CPT name");
    equal(await cpt.symbol(), "CPT", "CPT symbol");
    equal(await cpt.decimals(), 18, "CPT decimals");
    equal(await cpt.hasRole(await cpt.ADMIN_ROLE(), a), true, "administrator role");
    equal(await cpt.hasRole(await cpt.DEFAULT_ADMIN_ROLE(), a), true, "role management");
    equal(await cpt.isMember(a), false, "administrator is not automatically a member");
    equal(await nft.cpt(), T, "linked CPT");
    equal(await nft.MAX_SUPPLY(), 10, "NFT cap");
    equal(await nft.MINT_COST(), points(100), "issuance cost");
    equal(await nft.imageURI(), imageURI, "stored image URL");
    equal(await nft.totalMinted(), 0, "no NFT issued");
    for (const id of [0, 1, 10, 11]) await reverts(nft, A, "tokenURI", [id], "ERC721NonexistentToken");
  });
  await step("Membership application, unauthorized approval and welcome allocation", async () => {
    await send(cpt, B, "applyForMembership");
    equal(await cpt.membershipApplications(b), true, "pending application");
    equal(await cpt.isMember(b), false, "not yet a member");
    equal(await cpt.balanceOf(b), 0, "application gives no points");
    await reverts(cpt, B, "applyForMembership", [], "Application exists");
    await reverts(cpt, B, "approveMembership", [b], "AccessControlUnauthorizedAccount");
    await send(cpt, A, "approveMembership", b);
    await onboard(cpt, C, c);
    equal(await cpt.isMember(b), true, "B approved");
    equal(await cpt.isMember(c), true, "C approved");
    equal(await cpt.membershipApplications(b), false, "application cleared");
    await reverts(cpt, B, "applyForMembership", [], "Already a member");
    await balances([0, 5, 5, 990, 1000]);
  });
  await step("Non-administrators cannot issue, distribute or deduct points", async () => {
    for (const method of ["mintPoints", "distributePoints", "adminBurnPoints", "adminRecoverPoints"]) {
      await reverts(cpt, B, method, [b, points(10)], "AccessControlUnauthorizedAccount");
    }
    await reverts(cpt, A, "adminBurnPoints", [b, points(100)], "Insufficient points");
    await reverts(cpt, A, "adminRecoverPoints", [b, points(100)], "Insufficient points");
    await reverts(cpt, A, "adminRecoverPoints", [zero, 0], "Invalid account");
    await balances([0, 5, 5, 990, 1000]);
  });
  await step("Only an administrator can issue an NFT to a current member", async () => {
    await reverts(nft, B, "mintMemo", [b], "Not a club administrator");
    await reverts(nft, A, "mintMemo", [a], "Recipient is not a club member");
    await reverts(nft, A, "mintMemo", [zero], "Invalid recipient");
    equal(await nft.totalMinted(), 0, "failed issuance leaves supply unchanged");
  });
  await step("Fund administrator, reject missing allowance, approve and issue NFT #1", async () => {
    await send(cpt, A, "distributePoints", a, points(100));
    await balances([100, 5, 5, 890, 1000]);
    await reverts(nft, A, "mintMemo", [b], "ERC20InsufficientAllowance");
    equal(await nft.nextTokenId(), 1, "failed issuance leaves ID unchanged");
    await send(cpt, A, "approve", N, points(100));
    equal(await cpt.allowance(a, N), points(100), "administrator allowance");
    const receipt = await send(nft, A, "mintMemo", b);
    event(receipt, nft, "MemoMinted", [a, b, 1]);
    event(receipt, cpt, "Transfer", [a, zero, points(100)]);
    metadata(await nft.tokenURI(1), 1);
    equal(await nft.balanceOf(b), 1, "B NFT balance");
    equal(await cpt.allowance(a, N), 0, "allowance consumed");
    await balances([0, 5, 5, 890, 900], b);
  });
  await step("Administrator cannot take a member's NFT; only owner may list", async () => {
    await reverts(nft, A, "transferFrom", [b, a, 1], "ERC721InsufficientApproval");
    await reverts(nft, C, "listMemo", [1, points(80)], "Not token owner");
    await reverts(nft, B, "listMemo", [1, 0], "Price must be positive");
    equal(await nft.ownerOf(1), b, "failed operations preserve ownership");
  });
  await step("Treasury distribution preserves supply", async () => {
    await send(cpt, A, "distributePoints", b, points(145));
    await balances([0, 150, 5, 745, 900], b);
  });
  await step("Minting CPT increases supply", async () => {
    await send(cpt, A, "mintPoints", b, points(20));
    await balances([0, 170, 5, 745, 920], b);
  });
  await step("Administrator burn reduces supply", async () => {
    event(await send(cpt, A, "adminBurnPoints", b, points(10)), cpt, "PointsBurnedByAdmin", [b, points(10)]);
    await balances([0, 160, 5, 745, 910], b);
  });
  await step("Administrator recovery needs no allowance and preserves supply/membership/NFT", async () => {
    equal(await cpt.allowance(b, a), 0, "no recovery approval");
    event(await send(cpt, A, "adminRecoverPoints", b, points(20)), cpt, "PointsRecoveredByAdmin", [b, points(20)]);
    equal(await cpt.isMember(b), true, "recovery preserves membership");
    await balances([0, 140, 5, 765, 910], b);
  });
  await step("CPT transfer between members and buyer funding", async () => {
    await send(cpt, B, "transfer", c, points(10));
    await balances([0, 130, 15, 765, 910], b);
    await send(cpt, A, "distributePoints", c, points(65));
    await balances([0, 130, 80, 700, 910], b);
  });
  await step("Listing escrows NFT and prevents self-purchase/unauthorized cancellation", async () => {
    event(await send(nft, B, "listMemo", 1, points(80)), nft, "MemoListed", [b, 1, points(80)]);
    const listing = await nft.listings(1);
    equal(listing.seller, b, "listing seller");
    equal(listing.price, points(80), "listing price");
    await reverts(nft, B, "buyMemo", [1], "Seller cannot buy own NFT");
    await reverts(nft, C, "cancelMemoListing", [1], "Not listing seller");
    await balances([0, 130, 80, 700, 910], N);
  });
  await step("Seller cancellation returns NFT and clears listing", async () => {
    event(await send(nft, B, "cancelMemoListing", 1), nft, "MemoListingCancelled", [b, 1]);
    equal((await nft.listings(1)).seller, zero, "cancelled seller");
    equal((await nft.listings(1)).price, 0, "cancelled price");
    await reverts(nft, C, "buyMemo", [1], "Not listed");
    await balances([0, 130, 80, 700, 910], b);
  });
  await step("Buyer must approve CPT; purchase pays seller and transfers existing NFT", async () => {
    await send(nft, B, "listMemo", 1, points(80));
    await reverts(nft, C, "buyMemo", [1], "ERC20InsufficientAllowance");
    equal(await nft.ownerOf(1), N, "failed purchase keeps escrow");
    await send(cpt, C, "approve", N, points(80));
    event(await send(nft, C, "buyMemo", 1), nft, "MemoPurchased", [c, b, 1, points(80)]);
    equal(await cpt.allowance(c, N), 0, "buyer allowance consumed");
    equal((await nft.listings(1)).seller, zero, "purchased listing cleared");
    await reverts(nft, C, "buyMemo", [1], "Not listed");
    await balances([0, 210, 0, 700, 910], c);
  });
  await step("Standard safe NFT transfer back to B", async () => {
    await send(nft, C, "safeTransferFrom(address,address,uint256)", c, b, 1);
    equal(await nft.balanceOf(b), 1, "B has the NFT");
    equal(await nft.balanceOf(c), 0, "C no longer has the NFT");
    await balances([0, 210, 0, 700, 910], b);
  });
  await step("Withdrawal burns all remaining CPT and retains NFT", async () => {
    event(await send(cpt, B, "withdrawFromClub"), cpt, "MemberWithdrawn", [b, points(210)]);
    equal(await cpt.isMember(b), false, "membership revoked");
    await reverts(cpt, B, "withdrawFromClub", [], "Not a member");
    await reverts(nft, A, "mintMemo", [b], "Recipient is not a club member");
    metadata(await nft.tokenURI(1), 1);
    await balances([0, 0, 0, 700, 700], b);
  });
  await step("Former member can list/cancel their retained NFT", async () => {
    await send(nft, B, "listMemo", 1, points(80));
    await send(nft, B, "cancelMemoListing", 1);
    await balances([0, 0, 0, 700, 700], b);
  });
  await step("Issue IDs 2-10; decode each on-chain JSON URI; reject the eleventh without payment", async () => {
    await send(cpt, A, "mintPoints", a, points(900));
    await send(cpt, A, "approve", N, points(900));
    for (let id = 2; id <= 10; id++) {
      await send(nft, A, "mintMemo", c);
      equal(await nft.ownerOf(id), c, `NFT #${id} owner`);
      metadata(await nft.tokenURI(id), id);
    }
    equal(await nft.totalMinted(), 10, "ten NFTs issued");
    equal(await nft.nextTokenId(), 11, "next ID");
    equal(await nft.balanceOf(c), 9, "C holds nine NFTs");
    await reverts(nft, A, "mintMemo", [c], "Maximum supply reached");
    await balances([0, 0, 0, 700, 700], b);
  });

  // Isolated fixtures avoid altering the documented mainline balance table.
  const other = await fixture();
  await onboard(other.cpt, B, b);
  await step("Administrator allowance with insufficient balance cannot issue NFT", async () => {
    await send(other.cpt, A, "mintPoints", a, points(100));
    await send(other.cpt, A, "approve", other.N, points(100));
    await send(other.cpt, A, "burn", points(100));
    await reverts(other.nft, A, "mintMemo", [b], "ERC20InsufficientBalance");
    equal(await other.nft.nextTokenId(), 1, "failed payment preserves ID");
    equal(await other.cpt.allowance(a, other.N), points(100), "failed payment preserves allowance");
    equal(await other.cpt.balanceOf(b), points(5), "recipient not charged");
  });
  await step("Current administrator grants/revocations affect NFT issuance", async () => {
    const role = await other.cpt.ADMIN_ROLE();
    await send(other.cpt, A, "grantRole", role, d);
    await send(other.cpt, D, "mintPoints", d, points(100));
    await send(other.cpt, D, "approve", other.N, points(100));
    await send(other.nft, D, "mintMemo", b);
    equal(await other.nft.ownerOf(1), b, "new administrator issued NFT");
    await send(other.cpt, A, "revokeRole", role, d);
    equal(await other.cpt.hasRole(role, d), false, "administrator revoked");
    await reverts(other.nft, D, "mintMemo", [b], "Not a club administrator");
    equal(await other.nft.totalMinted(), 1, "revoked administrator cannot issue");
  });
  await step("Buyer allowance with insufficient balance preserves escrow and listing", async () => {
    await onboard(other.cpt, C, c);
    await send(other.nft, B, "listMemo", 1, points(80));
    await send(other.cpt, C, "approve", other.N, points(80));
    await reverts(other.nft, C, "buyMemo", [1], "ERC20InsufficientBalance");
    equal(await other.nft.ownerOf(1), other.N, "escrow preserved");
    equal((await other.nft.listings(1)).seller, b, "seller preserved");
    equal(await other.cpt.balanceOf(c), points(5), "buyer balance preserved");
    equal(await other.cpt.allowance(c, other.N), points(80), "buyer allowance preserved");
  });
  await step("A former member may sell their NFT and receive CPT after withdrawal", async () => {
    await send(other.cpt, B, "withdrawFromClub");
    await send(other.cpt, A, "distributePoints", c, points(75));
    await send(other.nft, C, "buyMemo", 1);
    equal(await other.cpt.isMember(b), false, "seller remains a former member");
    equal(await other.cpt.balanceOf(b), points(80), "former member receives sale price");
    equal(await other.nft.ownerOf(1), c, "buyer receives former member's NFT");
  });

  const result = { checks, assertions, mainline: { CPT: T, CampusMemo: N }, deployments, imageURI };
  log(`ALL TESTS PASSED: ${checks} groups, ${assertions} assertions.`);
  log(`MAINLINE CPT: ${T}`);
  log(`MAINLINE CampusMemo: ${N}`);
  log("Final mainline: A/B/C = 0 CPT; treasury/supply = 700 CPT; NFT #1 = B; NFTs #2-10 = C.");
  log("On-chain JSON metadata was decoded and checked; the image URL is a pinned GitHub raw URL.");
  return result;
}

if (typeof module !== "undefined" && module.exports && typeof remix === "undefined") {
  module.exports = { runAssignmentTests };
} else {
  (async () => {
    try {
      const { ethers } = require("ethers");
      const provider = ethers.BrowserProvider
        ? new ethers.BrowserProvider(web3Provider)
        : new ethers.providers.Web3Provider(web3Provider);
      async function readArtifact(name) {
        // Remix versions/workspaces differ in where compiler metadata is saved.
        const candidates = [`contracts/artifacts/${name}.json`, `artifacts/${name}.json`,
          `browser/contracts/artifacts/${name}.json`, `browser/artifacts/${name}.json`];
        for (const path of candidates) {
          let content;
          try { content = await remix.call("fileManager", "getFile", path); } catch (_) { continue; }
          if (!content) continue;
          return JSON.parse(content);
        }
        throw new Error(`Cannot find ${name}.json compiler artifact. Compile both contracts and enable Generate contract metadata.`);
      }
      await runAssignmentTests({ ethers, provider, readArtifact });
    } catch (error) {
      console.error(`TESTS FAILED: ${error.message}`);
      throw error;
    }
  })();
}
