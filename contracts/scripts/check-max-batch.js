const { ethers } = require('hardhat');

async function main() {
  // Contract address from the error
  const contractAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
  
  console.log('🔍 Checking current maxBatch setting...');
  
  try {
    // Get contract instance
    const PixelCanvas = await ethers.getContractFactory('PixelCanvasV1');
    const pixelCanvas = PixelCanvas.attach(contractAddress);
    
    // Check current maxBatch
    const maxBatch = await pixelCanvas.maxBatch();
    console.log(`📊 Current maxBatch: ${maxBatch}`);
    console.log(`🎯 Recommended maxBatch: 900 (from testing)`);
    console.log(`❌ Your transaction: 478 pixels (REJECTED)`);
    
    if (maxBatch < 478) {
      console.log(`\n💡 SOLUTION OPTIONS:`);
      console.log(`1. Update maxBatch to 900: await contract.setMaxBatch(900)`);
      console.log(`2. Split transaction into batches of ${maxBatch} or less`);
      console.log(`3. Reduce your purchase to ${maxBatch} pixels or less`);
    }
    
    // Check other parameters
    const basePrice = await pixelCanvas.basePrice();
    const width = await pixelCanvas.width();
    const height = await pixelCanvas.height();
    const treasury = await pixelCanvas.treasury();
    
    console.log(`\n📋 Contract Info:`);
    console.log(`   Canvas: ${width}×${height}`);
    console.log(`   Base Price: ${ethers.formatEther(basePrice)} ETH`);
    console.log(`   Treasury: ${treasury}`);
    
  } catch (error) {
    console.error('❌ Error checking contract:', error.message);
  }
}

main().catch(console.error);
