const { ethers } = require('hardhat');

async function testQuotePrice() {
  console.log('🧪 Testing quotePrice function directly...\n');
  
  const contractAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
  
  try {
    // Connect to contract
    const PixelCanvas = await ethers.getContractFactory('PixelCanvasV1');
    const pixelCanvas = PixelCanvas.attach(contractAddress);
    
    const pixelId = 42466; // 0xa5e2 in decimal
    const team = 0;
    
    console.log(`Testing quotePrice(${pixelId}, ${team})...`);
    
    // Test the call directly
    const price = await pixelCanvas.quotePrice(pixelId, team);
    console.log(`✅ Success! Price: ${ethers.formatEther(price)} ETH`);
    
    // Test other related functions
    console.log('\n🔍 Testing related functions:');
    
    const stepPrice = await pixelCanvas.getStepPrice(pixelId);
    console.log(`Step price: ${ethers.formatEther(stepPrice)} ETH`);
    
    const multiplier = await pixelCanvas.getMultiplierBps(team);
    console.log(`Multiplier: ${multiplier} bps (${Number(multiplier) / 100}%)`);
    
    const basePrice = await pixelCanvas.basePrice();
    console.log(`Base price: ${ethers.formatEther(basePrice)} ETH`);
    
    const maxBatch = await pixelCanvas.maxBatch();
    console.log(`Max batch: ${maxBatch} pixels`);
    
    // Test pixel state
    const pixel = await pixelCanvas.getPixel(pixelId);
    console.log(`Pixel state: Owner=${pixel.owner}, LastPaid=${pixel.lastPaid}, Color=0x${pixel.color.toString(16)}, Team=${pixel.team}`);
    
    console.log('\n✅ All contract calls successful!');
    console.log('The issue must be in the frontend ABI or connection.');
    
  } catch (error) {
    console.error('❌ Contract call failed:', error.message);
    
    if (error.message.includes('call revert exception')) {
      console.log('\nThis indicates a contract-level revert. Possible causes:');
      console.log('- Pixel ID out of bounds');
      console.log('- Invalid team value');
      console.log('- Contract paused');
      console.log('- Arithmetic error in calculations');
    }
  }
}

testQuotePrice();
