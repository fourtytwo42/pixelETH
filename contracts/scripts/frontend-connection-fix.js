const { ethers } = require('ethers');

async function testFrontendConnection() {
  console.log('🔧 Testing Frontend Connection to Localhost...\n');
  
  try {
    // Test connection the same way the frontend does
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    
    // Test basic connection
    const blockNumber = await provider.getBlockNumber();
    console.log('✅ Connected to Hardhat node, block:', blockNumber);
    
    // Test contract connection
    const contractAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
    
    // Use the exact ABI from frontend
    const PIXEL_CANVAS_ABI = [
      'function width() view returns (uint32)',
      'function height() view returns (uint32)', 
      'function basePrice() view returns (uint128)',
      'function maxBatch() view returns (uint256)',
      'function getPixel(uint32 id) view returns (address owner, uint64 lastPaid, uint24 color, uint8 team)',
      'function getStepPrice(uint32 id) view returns (uint256)',
      'function getMultiplierBps(uint8 team) view returns (uint256)',
      'function quotePrice(uint32 id, uint8 team) view returns (uint256)',
      'function getTeamCounts() view returns (uint32 redCount, uint32 blueCount)',
      'function pendingETH(address account) view returns (uint256)',
      'function isPaused() view returns (bool)',
      'function buyPacked(bytes calldata idsLE, bytes calldata colors24, bytes calldata teamBits, uint256 maxTotal) payable',
      'function withdraw()',
      'event PixelBought(uint32 indexed id, address from, address to, uint128 pricePaid, uint24 color, uint8 team)',
      'event Withdraw(address to, uint256 amount)',
    ];
    
    const contract = new ethers.Contract(contractAddress, PIXEL_CANVAS_ABI, provider);
    
    console.log('🧪 Testing contract functions with frontend ABI:');
    
    // Test the same call that's failing
    const pixelId = 42466; // 0xa5e2
    const team = 0;
    
    try {
      const price = await contract.quotePrice(pixelId, team);
      console.log('✅ quotePrice(' + pixelId + ', ' + team + '):', ethers.formatEther(price), 'ETH');
      
      // Test other functions
      const width = await contract.width();
      console.log('✅ width:', width.toString());
      
      const maxBatch = await contract.maxBatch(); 
      console.log('✅ maxBatch:', maxBatch.toString());
      
      console.log('\n🎉 ALL FRONTEND ABI TESTS PASSED!');
      console.log('\n💡 SOLUTION:');
      console.log('The contract is working. The issue is likely:');
      console.log('1. MetaMask not connected to localhost:8545');
      console.log('2. Wrong account selected in MetaMask');
      console.log('3. Frontend not using the correct provider');
      console.log('\n📋 Next steps:');
      console.log('1. In MetaMask, make sure you are on "Localhost 8545" network');
      console.log('2. Import account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      console.log('3. Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
      
    } catch (error) {
      console.error('❌ Contract call failed:', error.message);
      
      if (error.message.includes('could not decode result data')) {
        console.log('\n🔍 This suggests:');
        console.log('- ABI mismatch (but we just updated it)');
        console.log('- Contract not properly deployed');
        console.log('- Network connection issue');
      }
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

testFrontendConnection();
