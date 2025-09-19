const { ethers } = require("hardhat");

async function main() {
  const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  const [deployer, buyer] = await ethers.getSigners();
  
  const PixelCanvas = await ethers.getContractFactory("PixelCanvasV1");
  const pixelCanvas = PixelCanvas.attach(CONTRACT_ADDRESS);
  
  console.log("Testing basic contract interaction...");
  
  try {
    // Test basic view functions
    console.log("Width:", await pixelCanvas.width());
    console.log("Height:", await pixelCanvas.height());
    console.log("Base price:", ethers.formatEther(await pixelCanvas.basePrice()));
    
    const [red, blue] = await pixelCanvas.getTeamCounts();
    console.log("Team counts - Red:", red, "Blue:", blue);
    
    console.log("✅ Basic contract interaction working!");
    
  } catch (error) {
    console.error("❌ Contract interaction failed:", error.message);
  }
}

main().catch(console.error);
