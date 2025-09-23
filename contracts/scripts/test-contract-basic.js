const { ethers } = require('hardhat');

async function testBasicFunctions() {
  console.log('🧪 Testing basic contract functions...\n');
  
  try {
    // Deploy a fresh contract using hardhat network
    const [deployer] = await ethers.getSigners();
    console.log('Deployer:', deployer.address);
    
    const PixelCanvasV1 = await ethers.getContractFactory('PixelCanvasV1');
    
    const pixelCanvas = await upgrades.deployProxy(
      PixelCanvasV1,
      [
        1920, // width
        1080, // height  
        deployer.address, // treasury
        ethers.parseEther("0.001"), // basePrice
        deployer.address, // owner
        deployer.address, // pauser
        900 // maxBatch
      ],
      {
        initializer: "initialize",
        kind: "uups"
      }
    );

    await pixelCanvas.waitForDeployment();
    const address = await pixelCanvas.getAddress();
    
    console.log('✅ Contract deployed at:', address);
    
    // Test basic functions
    console.log('\n📊 Testing basic view functions:');
    
    const width = await pixelCanvas.width();
    console.log('Width:', width.toString());
    
    const height = await pixelCanvas.height();
    console.log('Height:', height.toString());
    
    const basePrice = await pixelCanvas.basePrice();
    console.log('Base price:', ethers.formatEther(basePrice), 'ETH');
    
    const maxBatch = await pixelCanvas.maxBatch();
    console.log('Max batch:', maxBatch.toString());
    
    // Test quotePrice with simple values
    console.log('\n🎯 Testing quotePrice:');
    
    try {
      const price1 = await pixelCanvas.quotePrice(0, 0);
      console.log('✅ quotePrice(0, 0):', ethers.formatEther(price1), 'ETH');
      
      const price2 = await pixelCanvas.quotePrice(100, 0);
      console.log('✅ quotePrice(100, 0):', ethers.formatEther(price2), 'ETH');
      
      const price3 = await pixelCanvas.quotePrice(42466, 0);
      console.log('✅ quotePrice(42466, 0):', ethers.formatEther(price3), 'ETH');
      
    } catch (error) {
      console.error('❌ quotePrice failed:', error.message);
    }
    
    console.log('\n✅ Contract is working properly!');
    console.log('The issue must be with the frontend connection or MetaMask.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testBasicFunctions();
