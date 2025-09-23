# 🦊 MetaMask Setup Guide - Fix Connection Issues

## ✅ Problem Identified

The smart contract and ABI are working perfectly. The issue is **MetaMask connectivity** to your local Hardhat network.

## 🔧 Step-by-Step Solution

### Step 1: Add Hardhat Network to MetaMask

1. **Open MetaMask**
2. **Click network dropdown** (top center)
3. **Click "Add Network"** → **"Add a network manually"**
4. **Enter these details:**
   ```
   Network Name: Hardhat Local
   New RPC URL: http://127.0.0.1:8545
   Chain ID: 31337
   Currency Symbol: ETH
   Block Explorer URL: (leave empty)
   ```
5. **Click "Save"**

### Step 2: Import Test Account

1. **Click account icon** (top right)
2. **"Add account or hardware wallet"** → **"Import Account"**
3. **Enter this private key:**
   ```
   0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
4. **Click "Import"**

This account address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

### Step 3: Switch to Hardhat Network

1. **Click network dropdown**
2. **Select "Hardhat Local"**
3. **Verify you see "Connected" status**

### Step 4: Verify Setup

Your MetaMask should show:
- ✅ **Network**: Hardhat Local (31337)
- ✅ **Account**: 0xf39F...2266 
- ✅ **Balance**: ~10,000 ETH
- ✅ **Status**: Connected

## 🧪 Test the Connection

1. **Refresh your browser** on http://localhost:3000
2. **Connect wallet** → Choose MetaMask
3. **Try coloring a pixel** - it should work now!

## 🎯 Contract Details

- **Address**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- **Network**: Hardhat Local (http://127.0.0.1:8545)
- **Chain ID**: 31337
- **Max Batch**: 900 pixels ✅
- **Status**: Fresh, empty canvas ✅

## ❓ Troubleshooting

### If you still get errors:

1. **Clear MetaMask cache:**
   - Settings → Advanced → Clear activity and nonce data

2. **Reset account:**
   - Settings → Advanced → Reset account

3. **Check Hardhat node:**
   ```bash
   # Make sure it's running:
   cd /home/hendo420/Framework/contracts
   ps aux | grep "hardhat node"
   ```

4. **Restart browser** and try again

## ✅ Expected Result

After following these steps:
- ✅ No more "missing revert data" errors
- ✅ Pixel coloring works smoothly  
- ✅ Price quotes load correctly
- ✅ Your 478 pixel transaction will succeed
- ✅ Clean canvas ready for artwork

**The contract is working perfectly - this is purely a MetaMask connection issue!** 🎨
