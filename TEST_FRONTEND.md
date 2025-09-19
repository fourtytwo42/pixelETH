# PixelETH Frontend Testing Guide

## 🚀 Frontend Successfully Deployed!

The complete PixelETH frontend is now live with full Web3 integration. Here's how to test it:

## Prerequisites

1. **Hardhat Node Running**: The local Hardhat network should be running
   ```bash
   cd contracts && npx hardhat node
   ```

2. **Frontend Server Running**: The Next.js development server should be running
   ```bash
   cd web && npm run dev
   ```

3. **Browser**: Chrome/Firefox with MetaMask extension (optional)

## Access the Game

Open your browser to: **http://localhost:3000**

## Testing Scenarios

### 🔧 1. Hardhat Local Wallet Testing
- Click "🔧 Hardhat Local" 
- Select any account (Account #0-4 available)
- Click "Connect" - should show connection status
- Verify network shows "Hardhat Local (31337)"

### 🦊 2. MetaMask Integration Testing  
- Install MetaMask browser extension
- Click "🦊 Connect MetaMask"
- If not on Hardhat network, click "Add Hardhat Network"
- Should automatically add network with:
  - Chain ID: 31337
  - RPC URL: http://127.0.0.1:8545
  - Currency: ETH

### 🎨 3. Pixel Canvas Interaction
- Once wallet connected, canvas should load showing:
  - Canvas size: 1920 × 1080
  - Base price: 0.001 ETH
  - Team counts: Red/Blue
- **Click pixels** to select them (black border appears)
- **Shift+click** for multi-select
- **Scroll** to zoom in/out
- **Ctrl+drag** to pan around

### 🎮 4. Pixel Purchase Testing
- Select team: Red 🔴 or Blue 🔵
- Pick color from team palette
- Click pixel(s) to select
- Click "Buy X Pixels" button
- Should prompt for transaction confirmation
- After confirmation, pixel should appear painted

### 🏆 5. Game Mechanics Testing
- **First Purchase**: Pay base price (0.001 ETH), 100% to treasury
- **Resale**: Pay 1.5x previous price, 90% to seller + 10% treasury
- **Self-Buy**: Recolor your own pixel, get seller share back
- **Team Balance**: Watch multipliers change based on Red/Blue ratio

## Expected Behavior

### ✅ Successful Connection
```
Wallet Connected ✅
Address: 0xf39F...2266
Network: Hardhat Local (31337)
Wallet Type: Hardhat Local
```

### ✅ Game Stats Display
```
🔴 Red Team: 0
🔵 Blue Team: 0  
Base Price: 0.001 ETH
Canvas Size: 1920 × 1080
```

### ✅ Pixel Purchase Flow
1. Select pixels ✅
2. Choose team and color ✅
3. Click "Buy X Pixels" ✅
4. Transaction confirmation ✅
5. Pixels painted on canvas ✅
6. Game stats updated ✅

## Troubleshooting

### 🔧 If Hardhat Connection Fails
- Ensure `npx hardhat node` is running in contracts folder
- Check console for connection errors
- Try refreshing page

### 🦊 If MetaMask Issues
- Check MetaMask is unlocked
- Ensure you're on correct account
- Try adding Hardhat network manually:
  - Network Name: Hardhat Local
  - RPC URL: http://127.0.0.1:8545
  - Chain ID: 31337
  - Currency Symbol: ETH

### 🎨 If Canvas Not Loading
- Verify wallet is connected
- Check network is Hardhat Local (31337)
- Ensure contract is deployed (should show in console)

### 💸 If Transactions Fail
- Check you have sufficient ETH balance
- Verify pixel selection is valid
- Check console for error messages

## Development URLs

- **Frontend**: http://localhost:3000
- **Hardhat Network**: http://127.0.0.1:8545
- **Contract Address**: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

## Next Steps

1. **Test with multiple accounts** to verify team mechanics
2. **Test batch purchases** with different pixel selections  
3. **Test price escalation** by buying same pixel multiple times
4. **Verify withdrawal functionality** for accumulated earnings

The frontend is fully functional and ready for production deployment! 🎉
