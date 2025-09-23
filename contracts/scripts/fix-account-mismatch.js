const { ethers } = require('hardhat');

async function fixAccountMismatch() {
  console.log('🔧 Fixing Account Mismatch Issue...\n');
  
  try {
    // Get the accounts available on Hardhat
    const accounts = await ethers.getSigners();
    
    console.log('📋 Available Hardhat Accounts:');
    for (let i = 0; i < Math.min(accounts.length, 5); i++) {
      const balance = await ethers.provider.getBalance(accounts[i].address);
      console.log(`${i}: ${accounts[i].address} (${ethers.formatEther(balance)} ETH)`);
    }
    
    console.log('\n❌ Problem Account:');
    console.log('MetaMask trying to use: 0x9099d24D55c105818b4e9eE117d87BC11063CF10');
    
    // Check if this account exists on Hardhat
    try {
      const problemBalance = await ethers.provider.getBalance('0x9099d24D55c105818b4e9eE117d87BC11063CF10');
      console.log(`Balance: ${ethers.formatEther(problemBalance)} ETH`);
      
      if (problemBalance === 0n) {
        console.log('🚨 This account has 0 ETH on this network!');
      }
    } catch (error) {
      console.log('🚨 This account might not exist on this network!');
    }
    
    console.log('\n💡 SOLUTIONS:');
    console.log('=============');
    
    console.log('\n🔧 Option 1: Use Hardhat Account (RECOMMENDED)');
    console.log('1. In MetaMask, click the account dropdown');
    console.log('2. Click "Import Account"');
    console.log('3. Use this private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    console.log('4. This will give you account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    console.log('5. Switch to this account in MetaMask');
    
    console.log('\n🔄 Option 2: Reset MetaMask State');
    console.log('1. MetaMask → Settings → Advanced → Reset Account');
    console.log('2. This clears transaction history and nonce data');
    console.log('3. Then switch to the correct account');
    
    console.log('\n⚙️ Option 3: Fund Your Current Account');
    console.log('We can send ETH to your current account...');
    
    // Send ETH to the problem account
    const [deployer] = await ethers.getSigners();
    const tx = await deployer.sendTransaction({
      to: '0x9099d24D55c105818b4e9eE117d87BC11063CF10',
      value: ethers.parseEther('100.0') // Send 100 ETH
    });
    
    await tx.wait();
    console.log('✅ Sent 100 ETH to your MetaMask account!');
    
    const newBalance = await ethers.provider.getBalance('0x9099d24D55c105818b4e9eE117d87BC11063CF10');
    console.log(`New balance: ${ethers.formatEther(newBalance)} ETH`);
    
    console.log('\n🧪 Testing contract call with your account...');
    
    // Test the contract call with the funded account
    const contractAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
    const PixelCanvas = await ethers.getContractFactory('PixelCanvasV1');
    const pixelCanvas = PixelCanvas.attach(contractAddress);
    
    // Create a signer for the user's account
    const userSigner = await ethers.getImpersonatedSigner('0x9099d24D55c105818b4e9eE117d87BC11063CF10');
    const contractWithUserSigner = pixelCanvas.connect(userSigner);
    
    try {
      const price = await contractWithUserSigner.quotePrice(29013, 0);
      console.log('✅ Contract call successful! Price:', ethers.formatEther(price), 'ETH');
      console.log('\n🎉 Your account should now work! Try refreshing the page.');
    } catch (error) {
      console.log('❌ Contract call still failing:', error.message);
      console.log('Use Option 1 (import the Hardhat account) instead.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixAccountMismatch();
