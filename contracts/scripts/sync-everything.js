const { ethers } = require('hardhat');

async function syncEverything() {
  console.log('🔄 Synchronizing Everything - MetaMask, Frontend, Backend...\n');
  
  try {
    // 1. Check current Hardhat node status
    console.log('📊 CURRENT HARDHAT NODE STATUS:');
    console.log('=================================');
    
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    
    console.log(`✅ Hardhat node running on http://127.0.0.1:8545`);
    console.log(`✅ Chain ID: ${network.chainId}`);
    console.log(`✅ Current block: ${blockNumber}`);
    
    // 2. Check contract deployment
    const contractAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
    const code = await provider.getCode(contractAddress);
    console.log(`✅ Contract deployed: ${code.length > 10 ? 'YES' : 'NO'}`);
    
    // 3. Check your account balance
    const userAccount = '0x9099d24D55c105818b4e9eE117d87BC11063CF10';
    const balance = await provider.getBalance(userAccount);
    console.log(`✅ Your account balance: ${ethers.formatEther(balance)} ETH`);
    
    // 4. Test contract function
    const PIXEL_CANVAS_ABI = [
      'function quotePrice(uint32 id, uint8 team) view returns (uint256)',
      'function maxBatch() view returns (uint256)',
      'function width() view returns (uint32)',
      'function height() view returns (uint32)',
    ];
    
    const contract = new ethers.Contract(contractAddress, PIXEL_CANVAS_ABI, provider);
    
    try {
      const price = await contract.quotePrice(56105, 0); // 0xdb29 in decimal
      const maxBatch = await contract.maxBatch();
      console.log(`✅ Contract working: quotePrice = ${ethers.formatEther(price)} ETH`);
      console.log(`✅ Max batch: ${maxBatch} pixels`);
    } catch (error) {
      console.log(`❌ Contract call failed: ${error.message}`);
    }
    
    console.log('\n🔧 METAMASK SYNCHRONIZATION STEPS:');
    console.log('===================================');
    console.log('1. Open MetaMask');
    console.log('2. Settings → Advanced → Reset Account (clears cache)');
    console.log('3. Make sure network is: "Localhost 8545" with Chain ID 31337');
    console.log('4. If network does not exist, add it:');
    console.log('   - Network Name: Localhost 8545');
    console.log('   - RPC URL: http://127.0.0.1:8545');
    console.log('   - Chain ID: 31337');
    console.log('   - Symbol: ETH');
    console.log('5. Refresh the browser page');
    console.log('6. Reconnect wallet');
    
    console.log('\n💰 ACCOUNT BALANCE FIX:');
    console.log('========================');
    
    if (balance < ethers.parseEther('50')) {
      console.log('Your balance is low. Adding more ETH...');
      
      // Fund the account again
      const [deployer] = await ethers.getSigners();
      const tx = await deployer.sendTransaction({
        to: userAccount,
        value: ethers.parseEther('200.0') // Send 200 ETH
      });
      
      await tx.wait();
      
      const newBalance = await provider.getBalance(userAccount);
      console.log(`✅ Added 200 ETH. New balance: ${ethers.formatEther(newBalance)} ETH`);
    } else {
      console.log(`✅ Balance is sufficient: ${ethers.formatEther(balance)} ETH`);
    }
    
    console.log('\n🌐 FRONTEND CONNECTION INFO:');
    console.log('=============================');
    console.log(`Contract Address: ${contractAddress}`);
    console.log(`Network: http://127.0.0.1:8545`);
    console.log(`Chain ID: 31337`);
    console.log(`Your Account: ${userAccount}`);
    console.log(`Expected Balance: ${ethers.formatEther(await provider.getBalance(userAccount))} ETH`);
    
    console.log('\n🎯 VERIFICATION CHECKLIST:');
    console.log('===========================');
    console.log('After following the MetaMask steps above:');
    console.log('✓ MetaMask should show 31337 as Chain ID');
    console.log('✓ MetaMask should show ~300 ETH balance');
    console.log('✓ Frontend should connect without errors');
    console.log('✓ Pixel coloring should work perfectly');
    
    console.log('\n🚀 READY TO TEST:');
    console.log('==================');
    console.log('1. Reset MetaMask account (clears state)');
    console.log('2. Verify network is Localhost 8545 (31337)');
    console.log('3. Refresh browser page');
    console.log('4. Connect wallet');
    console.log('5. Try coloring pixels!');
    
  } catch (error) {
    console.error('❌ Sync error:', error.message);
  }
}

syncEverything();
