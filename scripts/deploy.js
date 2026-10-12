const hre = require("hardhat");

async function main() {
  const imageURI = process.env.NFT_IMAGE_URL;
  if (!imageURI) {
    throw new Error("Set NFT_IMAGE_URL to the raw URL of the committed NFT image before deployment.");
  }
  // Match the on-chain JSON character rules before deploying even CPT.
  if (/[^\x21-\x7e]|["\\]/.test(imageURI)) {
    throw new Error("NFT_IMAGE_URL contains spaces or characters that cannot be embedded in JSON; use a percent-encoded raw URL.");
  }
  const url = new URL(imageURI);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "raw.githubusercontent.com" ||
    !/^\/[^/]+\/[^/]+\/[a-f0-9]{40}\/[^/]+(?:\/[^/]+)*$/i.test(url.pathname) ||
    url.search || url.hash || url.username || url.password
  ) {
    throw new Error("NFT_IMAGE_URL must be https://raw.githubusercontent.com/USER/REPO/40-CHAR-COMMIT/path/to/image (no query or fragment).");
  }
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deployer: ${deployer.address}`);

  const CPT = await hre.ethers.getContractFactory("CPT");
  const cpt = await CPT.deploy(deployer.address);
  await cpt.waitForDeployment();
  console.log(`CPT: ${await cpt.getAddress()}`);
  console.log(`CPT deployment transaction: ${cpt.deploymentTransaction().hash}`);

  const CampusMemo = await hre.ethers.getContractFactory("CampusMemo");
  const campusMemo = await CampusMemo.deploy(
    await cpt.getAddress(),
    imageURI
  );
  await campusMemo.waitForDeployment();

  console.log(`CampusMemo: ${await campusMemo.getAddress()}`);
  console.log(`CampusMemo deployment transaction: ${campusMemo.deploymentTransaction().hash}`);
  console.log(`NFT image URL: ${imageURI}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
