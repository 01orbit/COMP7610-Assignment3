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
    await cpt.mintPoints(alice.address, mintCost);
    await cpt.connect(alice).approve(await campusMemo.getAddress(), mintCost);
    await campusMemo.connect(alice).mintMemo();

    await cpt.connect(alice).withdrawFromClub();

    expect(await cpt.isMember(alice.address)).to.equal(false);
    expect(await cpt.balanceOf(alice.address)).to.equal(0);
    expect(await campusMemo.ownerOf(1)).to.equal(alice.address);
  });

  it("burns 100 CPT when a member mints one Campus-Memo", async function () {
    await onboard(alice);
    await cpt.connect(deployer).distributePoints(alice.address, mintCost);
    await cpt.connect(alice).approve(await campusMemo.getAddress(), mintCost);

    await expect(campusMemo.connect(alice).mintMemo())
      .to.emit(campusMemo, "MemoMinted")
      .withArgs(alice.address, 1);

    expect(await campusMemo.ownerOf(1)).to.equal(alice.address);
    expect(await cpt.balanceOf(alice.address)).to.equal(welcomePoints);
    expect(await cpt.totalSupply()).to.equal(initialSupply - mintCost);
    expect(await campusMemo.tokenURI(1)).to.equal("ipfs://example-cid/1");
  });

  it("rejects NFT minting by an address that is not a member", async function () {
    await cpt.connect(alice).approve(await campusMemo.getAddress(), mintCost);
    await expect(campusMemo.connect(alice).mintMemo()).to.be.revertedWith(
      "Not a club member"
    );
  });

  it("supports standard NFT transfers", async function () {
    await onboard(alice);
    await cpt.connect(deployer).distributePoints(alice.address, mintCost);
    await cpt.connect(alice).approve(await campusMemo.getAddress(), mintCost);
    await campusMemo.connect(alice).mintMemo();

    await campusMemo.connect(alice).safeTransferFrom(alice.address, bob.address, 1);
    expect(await campusMemo.ownerOf(1)).to.equal(bob.address);
  });

  it("lets a seller list an NFT and a buyer purchase it with CPT", async function () {
    await onboard(alice);
    await cpt.mintPoints(alice.address, mintCost);
    await cpt.connect(alice).approve(await campusMemo.getAddress(), mintCost);
    await campusMemo.connect(alice).mintMemo();

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
    await cpt.mintPoints(alice.address, mintCost);
    await cpt.connect(alice).approve(await campusMemo.getAddress(), mintCost);
    await campusMemo.connect(alice).mintMemo();

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
      // Use the administrator's additional-mint path for the test supply;
      // the 1,000-CPT treasury remains reserved for welcome allocations.
      await cpt.mintPoints(account.address, ethers.parseEther("100"));
      await cpt.connect(account).approve(await campusMemo.getAddress(), mintCost);
      await campusMemo.connect(account).mintMemo();
    }

    expect(await campusMemo.totalMinted()).to.equal(10);

    const eleventh = extraAccounts[8];
    await onboard(eleventh);
    await cpt.mintPoints(eleventh.address, ethers.parseEther("100"));
    await cpt.connect(eleventh).approve(await campusMemo.getAddress(), mintCost);
    await expect(campusMemo.connect(eleventh).mintMemo()).to.be.revertedWith(
      "Maximum supply reached"
    );
  });
});
