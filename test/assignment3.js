const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HKU Drone Club Assignment 3", function () {
  const initialSupply = ethers.parseEther("1000");
  const welcomePoints = ethers.parseEther("50");
  const mintCost = ethers.parseEther("100");

  let cpt;
  let campusMemo;
  let deployer;
  let admin;
  let alice;
  let bob;
  let extraAccounts;

  beforeEach(async function () {
    [deployer, admin, alice, bob, ...extraAccounts] = await ethers.getSigners();

    const CPT = await ethers.getContractFactory("CPT");
    cpt = await CPT.deploy(deployer.address);
    await cpt.waitForDeployment();

    const CampusMemo = await ethers.getContractFactory("CampusMemo");
    campusMemo = await CampusMemo.deploy(
      await cpt.getAddress(),
      "ipfs://example-cid/"
    );
    await campusMemo.waitForDeployment();
  });

  async function onboard(account) {
    await cpt.connect(account).applyForMembership();
    await cpt.approveMembership(account.address);
  }

  async function issueMemo(account) {
    await cpt.mintPoints(deployer.address, mintCost);
    await cpt.approve(await campusMemo.getAddress(), mintCost);
    await campusMemo.mintMemo(account.address);
  }

  it("mints the initial 1,000 CPT into the club treasury", async function () {
    expect(await cpt.totalSupply()).to.equal(initialSupply);
    expect(await cpt.balanceOf(await cpt.getAddress())).to.equal(initialSupply);
  });

  it("lets an administrator approve a member and issue welcome points", async function () {
    await onboard(alice);

    expect(await cpt.isMember(alice.address)).to.equal(true);
    expect(await cpt.balanceOf(alice.address)).to.equal(welcomePoints);
    expect(await cpt.balanceOf(await cpt.getAddress())).to.equal(
      initialSupply - welcomePoints
    );
  });

  it("rejects membership approval by a non-administrator", async function () {
    await cpt.connect(alice).applyForMembership();
    await expect(
      cpt.connect(alice).approveMembership(alice.address)
    ).to.be.reverted;
  });

  it("supports standard CPT transfers between members", async function () {
    await onboard(alice);
    await cpt.connect(alice).transfer(bob.address, ethers.parseEther("10"));

    expect(await cpt.balanceOf(bob.address)).to.equal(ethers.parseEther("10"));
    expect(await cpt.balanceOf(alice.address)).to.equal(ethers.parseEther("40"));
  });

  it("lets only an administrator deduct CPT from a user's balance", async function () {
    await onboard(alice);
    const deduction = ethers.parseEther("20");

    await expect(cpt.adminBurnPoints(alice.address, deduction))
      .to.emit(cpt, "PointsBurnedByAdmin")
      .withArgs(alice.address, deduction);

    expect(await cpt.balanceOf(alice.address)).to.equal(
      welcomePoints - deduction
    );
    expect(await cpt.totalSupply()).to.equal(initialSupply - deduction);

    await expect(
      cpt.connect(alice).adminBurnPoints(alice.address, 1)
    ).to.be.reverted;
    await expect(
      cpt.adminBurnPoints(alice.address, welcomePoints)
    ).to.be.revertedWith("Insufficient points");
  });

  it("recovers CPT to the treasury without allowance or changing membership, NFTs, or supply", async function () {
    await onboard(alice);
    await issueMemo(alice);

    const treasury = await cpt.getAddress();
    const recovered = ethers.parseEther("20");
    const treasuryBefore = await cpt.balanceOf(treasury);
    const supplyBefore = await cpt.totalSupply();
    const adminBalanceBefore = await cpt.balanceOf(deployer.address);
    expect(await cpt.allowance(alice.address, deployer.address)).to.equal(0);

    await expect(cpt.adminRecoverPoints(alice.address, recovered))
      .to.emit(cpt, "PointsRecoveredByAdmin")
      .withArgs(alice.address, recovered)
      .and.to.emit(cpt, "Transfer")
      .withArgs(alice.address, treasury, recovered);

    expect(await cpt.balanceOf(alice.address)).to.equal(welcomePoints - recovered);
    expect(await cpt.balanceOf(treasury)).to.equal(treasuryBefore + recovered);
    expect(await cpt.totalSupply()).to.equal(supplyBefore);
    expect(await cpt.balanceOf(deployer.address)).to.equal(adminBalanceBefore);
    expect(await cpt.isMember(alice.address)).to.equal(true);
    expect(await campusMemo.ownerOf(1)).to.equal(alice.address);

    await cpt.distributePoints(bob.address, recovered);
    expect(await cpt.balanceOf(bob.address)).to.equal(recovered);
    expect(await cpt.balanceOf(treasury)).to.equal(treasuryBefore);
  });

  it("rejects CPT recovery by a non-administrator", async function () {
    await onboard(alice);
    await expect(cpt.connect(bob).adminRecoverPoints(alice.address, 1))
      .to.be.revertedWithCustomError(cpt, "AccessControlUnauthorizedAccount")
      .withArgs(bob.address, await cpt.ADMIN_ROLE());
    expect(await cpt.balanceOf(alice.address)).to.equal(welcomePoints);
  });

  it("rejects recovery above the user's balance without changing balances or supply", async function () {
    await onboard(alice);
    const treasury = await cpt.getAddress();
    await expect(cpt.adminRecoverPoints(alice.address, welcomePoints + 1n))
      .to.be.revertedWith("Insufficient points");
    expect(await cpt.balanceOf(alice.address)).to.equal(welcomePoints);
    expect(await cpt.balanceOf(treasury)).to.equal(initialSupply - welcomePoints);
    expect(await cpt.totalSupply()).to.equal(initialSupply);
  });

  it("rejects recovery from the zero address", async function () {
    await expect(cpt.adminRecoverPoints(ethers.ZeroAddress, 0))
      .to.be.revertedWith("Invalid account");
  });

  it("allows a member to burn all of their points and leave", async function () {
    await onboard(alice);
    await expect(cpt.connect(alice).withdrawFromClub())
      .to.emit(cpt, "MemberWithdrawn")
      .withArgs(alice.address, welcomePoints);

    expect(await cpt.isMember(alice.address)).to.equal(false);
    expect(await cpt.balanceOf(alice.address)).to.equal(0);
  });

  it("keeps a commemorative NFT with a member after withdrawal", async function () {
    await onboard(alice);
    await issueMemo(alice);

    await cpt.connect(alice).withdrawFromClub();

    expect(await cpt.isMember(alice.address)).to.equal(false);
    expect(await cpt.balanceOf(alice.address)).to.equal(0);
    expect(await campusMemo.ownerOf(1)).to.equal(alice.address);
  });

  it("burns the administrator's 100 CPT when issuing an NFT to a member", async function () {
    await onboard(alice);
    await cpt.distributePoints(deployer.address, mintCost);
    await cpt.approve(await campusMemo.getAddress(), mintCost);

    await expect(campusMemo.mintMemo(alice.address))
      .to.emit(campusMemo, "MemoMinted")
      .withArgs(deployer.address, alice.address, 1);

    expect(await campusMemo.ownerOf(1)).to.equal(alice.address);
    expect(await cpt.balanceOf(alice.address)).to.equal(welcomePoints);
    expect(await cpt.totalSupply()).to.equal(initialSupply - mintCost);
    expect(await campusMemo.tokenURI(1)).to.equal("ipfs://example-cid/1");
  });

  it("rejects NFT minting by an ordinary member", async function () {
    await onboard(alice);
    await expect(campusMemo.connect(alice).mintMemo(alice.address))
      .to.be.revertedWith("Not a club administrator");
    expect(await campusMemo.totalMinted()).to.equal(0);
    expect(await cpt.balanceOf(alice.address)).to.equal(welcomePoints);
  });

  it("rejects issuing an NFT to a non-member or the zero address", async function () {
    await expect(campusMemo.mintMemo(bob.address))
      .to.be.revertedWith("Recipient is not a club member");
    await expect(campusMemo.mintMemo(ethers.ZeroAddress))
      .to.be.revertedWith("Invalid recipient");
    expect(await campusMemo.totalMinted()).to.equal(0);
  });

  it("uses current CPT administrator roles for NFT issuance", async function () {
    await onboard(alice);
    const role = await cpt.ADMIN_ROLE();
    await cpt.grantRole(role, admin.address);
    await cpt.mintPoints(admin.address, mintCost);
    await cpt.connect(admin).approve(await campusMemo.getAddress(), mintCost);
    await campusMemo.connect(admin).mintMemo(alice.address);
    expect(await campusMemo.ownerOf(1)).to.equal(alice.address);

    await cpt.revokeRole(role, admin.address);
    await expect(campusMemo.connect(admin).mintMemo(alice.address))
      .to.be.revertedWith("Not a club administrator");
    expect(await campusMemo.totalMinted()).to.equal(1);
  });

  it("requires administrator payment and allowance without charging the recipient", async function () {
    await onboard(alice);
    await cpt.mintPoints(deployer.address, mintCost);
    await expect(campusMemo.mintMemo(alice.address))
      .to.be.revertedWithCustomError(cpt, "ERC20InsufficientAllowance");
    expect(await campusMemo.nextTokenId()).to.equal(1);
    expect(await cpt.balanceOf(deployer.address)).to.equal(mintCost);

    await cpt.approve(await campusMemo.getAddress(), mintCost);
    await cpt.burn(mintCost);
    await expect(campusMemo.mintMemo(alice.address))
      .to.be.revertedWithCustomError(cpt, "ERC20InsufficientBalance");
    expect(await cpt.allowance(deployer.address, await campusMemo.getAddress()))
      .to.equal(mintCost);
    expect(await campusMemo.nextTokenId()).to.equal(1);
    expect(await cpt.balanceOf(alice.address)).to.equal(welcomePoints);
  });

  it("supports standard NFT transfers", async function () {
    await onboard(alice);
    await cpt.distributePoints(deployer.address, mintCost);
    await cpt.approve(await campusMemo.getAddress(), mintCost);
    await campusMemo.mintMemo(alice.address);

    await campusMemo.connect(alice).safeTransferFrom(alice.address, bob.address, 1);
    expect(await campusMemo.ownerOf(1)).to.equal(bob.address);
  });

  it("does not let administrators take an issued NFT without owner approval", async function () {
    await onboard(alice);
    await issueMemo(alice);
    await expect(campusMemo.transferFrom(alice.address, deployer.address, 1))
      .to.be.revertedWithCustomError(campusMemo, "ERC721InsufficientApproval");
    expect(await campusMemo.ownerOf(1)).to.equal(alice.address);
  });

  it("lets a former member sell an existing NFT after withdrawal", async function () {
    await onboard(alice);
    await issueMemo(alice);
    await cpt.connect(alice).withdrawFromClub();
    await expect(campusMemo.mintMemo(alice.address))
      .to.be.revertedWith("Recipient is not a club member");

    const price = ethers.parseEther("80");
    await campusMemo.connect(alice).listMemo(1, price);
    await cpt.mintPoints(bob.address, price);
    await cpt.connect(bob).approve(await campusMemo.getAddress(), price);
    await campusMemo.connect(bob).buyMemo(1);
    expect(await campusMemo.ownerOf(1)).to.equal(bob.address);
    expect(await cpt.balanceOf(alice.address)).to.equal(price);
    expect(await cpt.isMember(alice.address)).to.equal(false);
  });

  it("lets a seller list an NFT and a buyer purchase it with CPT", async function () {
    await onboard(alice);
    await issueMemo(alice);

    const salePrice = ethers.parseEther("80");
    await expect(campusMemo.connect(alice).listMemo(1, salePrice))
      .to.emit(campusMemo, "MemoListed")
      .withArgs(alice.address, 1, salePrice);
    expect(await campusMemo.ownerOf(1)).to.equal(await campusMemo.getAddress());

    await cpt.mintPoints(bob.address, salePrice);
    await cpt.connect(bob).approve(await campusMemo.getAddress(), salePrice);

    await expect(campusMemo.connect(bob).buyMemo(1))
      .to.emit(campusMemo, "MemoPurchased")
      .withArgs(bob.address, alice.address, 1, salePrice);

    expect(await campusMemo.ownerOf(1)).to.equal(bob.address);
    expect(await cpt.balanceOf(alice.address)).to.equal(welcomePoints + salePrice);
    expect(await cpt.balanceOf(bob.address)).to.equal(0);
    expect((await campusMemo.listings(1)).seller).to.equal(ethers.ZeroAddress);
  });

  it("lets the seller cancel an NFT listing", async function () {
    await onboard(alice);
    await issueMemo(alice);

    await campusMemo.connect(alice).listMemo(1, ethers.parseEther("80"));
    await expect(campusMemo.connect(alice).cancelMemoListing(1))
      .to.emit(campusMemo, "MemoListingCancelled")
      .withArgs(alice.address, 1);

    expect(await campusMemo.ownerOf(1)).to.equal(alice.address);
    await expect(campusMemo.connect(bob).buyMemo(1)).to.be.revertedWith(
      "Not listed"
    );
  });

  it("enforces the ten-NFT cap", async function () {
    const minters = [alice, bob, ...extraAccounts.slice(0, 8)];

    for (const account of minters) {
      await onboard(account);
      await issueMemo(account);
    }

    expect(await campusMemo.totalMinted()).to.equal(10);

    const eleventh = extraAccounts[8];
    await onboard(eleventh);
    await cpt.mintPoints(deployer.address, mintCost);
    await cpt.approve(await campusMemo.getAddress(), mintCost);
    await expect(campusMemo.mintMemo(eleventh.address)).to.be.revertedWith(
      "Maximum supply reached"
    );
  });
});
