const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying PixelCanvas with maxBatch = 900\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy contract
  const PixelCanvasV1 = await hre.ethers.getContractFactory("PixelCanvasV1");
  
  const pixelCanvas = await hre.upgrades.deployProxy(
    PixelCanvasV1,
    [
      1920, // width
      1080, // height  
      deployer.address, // treasury
      hre.ethers.parseEther("0.001"), // basePrice
      deployer.address, // owner
      deployer.address, // pauser
      900 // maxBatch - THE KEY CHANGE!
    ],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );

  await pixelCanvas.waitForDeployment();
  const address = await pixelCanvas.getAddress();

  console.log("✅ CONTRACT DEPLOYED SUCCESSFULLY!");
  console.log("================================");
  console.log("Address:", address);
  
  // Read values directly from deployment
  console.log("\n📊 CONTRACT PARAMETERS:");
  console.log("Width:", (await pixelCanvas.width()).toString());
  console.log("Height:", (await pixelCanvas.height()).toString());
  console.log("Base Price:", hre.ethers.formatEther(await pixelCanvas.basePrice()), "ETH");
  console.log("Max Batch:", (await pixelCanvas.maxBatch()).toString(), "pixels ⭐");
  console.log("Treasury:", await pixelCanvas.treasury());
  
  console.log("\n🎯 VALIDATION:");
  const maxBatch = Number(await pixelCanvas.maxBatch());
  console.log(`• Your 478 pixel transaction: ${478 <= maxBatch ? '✅ WILL WORK' : '❌ TOO LARGE'}`);
  console.log(`• Maximum possible: ${maxBatch} pixels`);
  console.log(`• Safety margin: ${maxBatch - 478} pixels remaining`);
  
  console.log("\n🔧 USAGE INSTRUCTIONS:");
  console.log("1. Update your frontend to use contract address:", address);
  console.log("2. Connect to Hardhat network: http://127.0.0.1:8545");
  console.log("3. Chain ID: 31337");
  console.log("4. Your 478 pixel transaction should now succeed!");
  
  return address;
}

main()
  .then((address) => {
    console.log("\n🎉 DEPLOYMENT COMPLETE!");
    console.log("Contract ready at:", address);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
