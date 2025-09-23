import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Canvas dimensions (1920x1080 for Full HD)
  const WIDTH = 1920;
  const HEIGHT = 1080;
  
  // Deployment parameters
  const TREASURY = deployer.address; // Use deployer as initial treasury
  const BASE_PRICE = ethers.parseEther("0.0001"); // 0.0001 ETH base price (reduced 10x)
  const MAX_BATCH = 900; // Optimized batch size based on comprehensive gas testing

  console.log("Deploying PixelCanvasV1...");

  // Deploy the upgradeable contract
  const PixelCanvasV1 = await ethers.getContractFactory("PixelCanvasV1");
  const pixelCanvas = await upgrades.deployProxy(
    PixelCanvasV1,
    [
      WIDTH,
      HEIGHT,
      TREASURY,
      BASE_PRICE,
      deployer.address, // owner
      deployer.address, // pauser
      MAX_BATCH
    ],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );

  await pixelCanvas.waitForDeployment();
  const pixelCanvasAddress = await pixelCanvas.getAddress();

  console.log("PixelCanvasV1 deployed to:", pixelCanvasAddress);
  
  // Verify deployment by reading some initial values
  console.log("Canvas dimensions:", await pixelCanvas.width(), "x", await pixelCanvas.height());
  console.log("Base price:", ethers.formatEther(await pixelCanvas.basePrice()), "ETH");
  console.log("Treasury:", await pixelCanvas.treasury());
  console.log("Max batch:", await pixelCanvas.maxBatch());
  console.log("Owner:", await pixelCanvas.owner());
  
  const [redCount, blueCount] = await pixelCanvas.getTeamCounts();
  console.log("Team counts - Red:", redCount, "Blue:", blueCount);

  return {
    pixelCanvas: pixelCanvasAddress,
    deployer: deployer.address
  };
}

main()
  .then((addresses) => {
    console.log("Deployment successful!");
    console.log("Contract address:", addresses.pixelCanvas);
    console.log("Deployer address:", addresses.deployer);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
