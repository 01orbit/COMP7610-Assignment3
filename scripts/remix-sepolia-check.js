/*
 * Read-only check for EXISTING Sepolia contracts. No deployments, signing,
 * approvals, transfers, mints or withdrawals are performed by this script.
 * In Remix: fill CONFIG, choose Browser Extension -> MetaMask -> Sepolia,
 * then right-click this file -> Run. ABI fragments below only contain reads.
 */
const CONFIG = {
  cptAddress: "REPLACE_WITH_CPT_ADDRESS",
  nftAddress: "REPLACE_WITH_CAMPUSMEMO_ADDRESS",
  adminAddress: "REPLACE_WITH_ACCOUNT_A_ADDRESS",
  imageURI: "REPLACE_WITH_FULL_COMMIT_PINNED_GITHUB_RAW_IMAGE_URL",
  // "initial": immediately after deployment, before any transactions.
  // "inspect": inspect the current state without assuming balances.
  // "after-demo": after the EXACT sequence in REMIX_DEPLOYMENT_GUIDE.md.
  stage: "initial",
  memberAddress: "", // Account B; required only for after-demo.
  buyerAddress: ""   // Account C; required only for after-demo.
};

const CPT_READ_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function INITIAL_SUPPLY() view returns (uint256)",
  "function WELCOME_POINTS() view returns (uint256)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function isMember(address) view returns (bool)"
];
const NFT_READ_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function cpt() view returns (address)",
  "function imageURI() view returns (string)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function MINT_COST() view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  "function nextTokenId() view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)"
];

async function verifySepoliaDeployment({ ethers, provider, config, log = console.log }) {
  const isAddress = ethers.isAddress || ethers.utils.isAddress;
  const parseEther = ethers.parseEther || ethers.utils.parseEther;
  const formatEther = ethers.formatEther || ethers.utils.formatEther;
  const decodeBase64 = ethers.decodeBase64 || ethers.utils.base64.decode;
  const toUtf8String = ethers.toUtf8String || ethers.utils.toUtf8String;
  const points = amount => parseEther(String(amount));
  const addressKeys = ["cptAddress", "nftAddress", "adminAddress"];
  if (config.stage === "after-demo") addressKeys.push("memberAddress", "buyerAddress");
  for (const key of addressKeys) {
    if (!isAddress(config[key]) || /^0x0{40}$/i.test(config[key])) {
      throw new Error(`Fill CONFIG.${key} with a nonzero address.`);
    }
  }
  if (!/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\/\S+$/i.test(config.imageURI)) {
    throw new Error("Fill CONFIG.imageURI with the exact commit-pinned image URL used at deployment.");
  }
  if (!["initial", "inspect", "after-demo"].includes(config.stage)) {
    throw new Error("CONFIG.stage must be initial, inspect or after-demo.");
  }
  if (config.stage === "after-demo" && new Set(
    [config.adminAddress, config.memberAddress, config.buyerAddress].map(x => x.toLowerCase())
  ).size !== 3) throw new Error("The walkthrough requires three distinct accounts A, B and C.");
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 11155111) {
    throw new Error("Select MetaMask connected to Sepolia (chain ID 11155111).");
  }

  // Read one block so balances and ownership form a consistent snapshot.
  const blockTag = await provider.getBlockNumber();
  let assertions = 0;
  function equal(actual, expected, label) {
    assertions++;
    const normalize = value => /^0x[0-9a-f]{40}$/i.test(String(value))
      ? String(value).toLowerCase() : String(value);
    if (normalize(actual) !== normalize(expected)) {
      throw new Error(`${label}: expected ${expected}, received ${actual}`);
    }
    log(`PASS: ${label}`);
  }
  for (const address of [config.cptAddress, config.nftAddress]) {
    if (await provider.getCode(address, blockTag) === "0x") {
      throw new Error(`No contract at ${address} on Sepolia block ${blockTag}. Check the address and deployment receipt.`);
    }
  }
  const cpt = new ethers.Contract(config.cptAddress, CPT_READ_ABI, provider);
  const nft = new ethers.Contract(config.nftAddress, NFT_READ_ABI, provider);
  const read = (contract, method, ...args) => contract[method](...args, { blockTag });
  log(`Sepolia read-only snapshot: block ${blockTag}, stage ${config.stage}`);
  equal(await read(cpt, "name"), "Club Point Token", "CPT name");
  equal(await read(cpt, "symbol"), "CPT", "CPT symbol");
  equal(await read(cpt, "decimals"), 18, "CPT decimals");
  equal(await read(cpt, "INITIAL_SUPPLY"), points(1000), "Initial supply constant = 1000 CPT");
  equal(await read(cpt, "WELCOME_POINTS"), points(5), "Welcome points = 5 CPT");
  equal(await read(cpt, "hasRole", await read(cpt, "ADMIN_ROLE"), config.adminAddress), true, "Account A administrator role");
  equal(await read(cpt, "hasRole", await read(cpt, "DEFAULT_ADMIN_ROLE"), config.adminAddress), true, "Account A role management");
  equal(await read(nft, "name"), "Campus-Memo", "NFT name");
  equal(await read(nft, "symbol"), "CMEMO", "NFT symbol");
  equal(await read(nft, "cpt"), config.cptAddress, "NFT links to the submitted CPT address");
  equal(await read(nft, "imageURI"), config.imageURI, "Image URL matches deployment input");
  equal(await read(nft, "MAX_SUPPLY"), 10, "NFT cap = 10");
  equal(await read(nft, "MINT_COST"), points(100), "Issuance cost = 100 CPT");
  const minted = Number(await read(nft, "totalMinted"));
  if (!Number.isInteger(minted) || minted < 0 || minted > 10) throw new Error("NFT supply outside 0-10.");
  equal(await read(nft, "nextTokenId"), minted + 1, "Next token ID matches issued supply");
  const supply = await read(cpt, "totalSupply");
  const treasury = await read(cpt, "balanceOf", config.cptAddress);
  log(`Current supply: ${formatEther(supply)} CPT; treasury: ${formatEther(treasury)} CPT; issued NFTs: ${minted}`);
  if (config.stage === "initial") {
    equal(supply, points(1000), "Initial total supply");
    equal(treasury, points(1000), "Initial treasury holds all 1000 CPT");
    equal(await read(cpt, "balanceOf", config.adminAddress), 0, "Administrator starts with zero CPT");
    equal(minted, 0, "No NFTs issued at deployment");
  }
  for (let id = 1; id <= minted; id++) {
    const uri = await read(nft, "tokenURI", id);
    const prefix = "data:application/json;base64,";
    equal(uri.slice(0, prefix.length), prefix, `NFT #${id} data URI prefix`);
    const metadata = JSON.parse(toUtf8String(decodeBase64(uri.slice(prefix.length))));
    equal(metadata.name, `Campus-Memo #${id}`, `NFT #${id} metadata name`);
    equal(metadata.description, "A limited-edition commemorative NFT of the HKU Drone Club.", `NFT #${id} metadata description`);
    equal(metadata.image, config.imageURI, `NFT #${id} metadata image`);
    equal(metadata.attributes?.[0]?.trait_type, "Edition", `NFT #${id} edition trait`);
    equal(metadata.attributes?.[0]?.value, id, `NFT #${id} edition number`);
    log(`NFT #${id} owner: ${await read(nft, "ownerOf", id)}`);
    log(`NFT #${id} full URI: ${uri}`);
    log(`NFT #${id} JSON: ${JSON.stringify(metadata, null, 2)}`);
  }
  if (minted === 0) log("No NFT exists yet: metadata decoding will be checked after issuance. Image fetching is not part of this script.");
  if (config.stage === "after-demo") {
    equal(minted, 1, "Exactly NFT #1 issued in the walkthrough");
    equal(supply, points(818), "After-demo total supply = 818 CPT");
    equal(treasury, points(818), "After-demo treasury = 818 CPT");
    equal(await read(cpt, "balanceOf", config.adminAddress), 0, "After-demo A balance = 0");
    equal(await read(cpt, "balanceOf", config.memberAddress), 0, "After-demo B balance = 0");
    equal(await read(cpt, "balanceOf", config.buyerAddress), 0, "After-demo C balance = 0");
    equal(await read(cpt, "isMember", config.memberAddress), false, "B withdrew from the club");
    equal(await read(cpt, "isMember", config.buyerAddress), true, "C remains a member");
    equal(await read(nft, "ownerOf", 1), config.memberAddress, "B retains NFT #1 after withdrawal");
  }
  log(`SEPOLIA CHECK PASSED: ${assertions} assertions, block ${blockTag}. No transactions sent.`);
  return { assertions, blockTag, minted };
}

if (typeof module !== "undefined" && module.exports && typeof remix === "undefined") {
  module.exports = { verifySepoliaDeployment };
} else {
  (async () => {
    try {
      const { ethers } = require("ethers");
      const provider = ethers.BrowserProvider
        ? new ethers.BrowserProvider(web3Provider)
        : new ethers.providers.Web3Provider(web3Provider);
      await verifySepoliaDeployment({ ethers, provider, config: CONFIG });
    } catch (error) {
      console.error(`SEPOLIA CHECK FAILED: ${error.message}`);
      throw error;
    }
  })();
}
