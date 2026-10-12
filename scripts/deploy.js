const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const baseURI = process.env.NFT_BASE_URI || "ipfs://REPLACE_WITH_CID/";

  console.log(`Deployer: ${deployer.address}`);

  const CPT = await hre.ethers.getContractFactory("CPT");
  const cpt = await CPT.deploy(deployer.address);
  await cpt.waitForDeployment();

  const CampusMemo = await hre.ethers.getContractFactory("CampusMemo");
  const campusMemo = await CampusMemo.deploy(
    await cpt.getAddress(),
    baseURI
  );
  await campusMemo.waitForDeployment();

  console.log(`CPT: ${await cpt.getAddress()}`);
  console.log(`CampusMemo: ${await campusMemo.getAddress()}`);
  console.log(`NFT base URI: ${baseURI}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
