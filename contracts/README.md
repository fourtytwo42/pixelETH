# PixelETH - Smart Contract System

A decentralized pixel canvas game built on Ethereum with dynamic pricing and team-based multipliers.

## 🎯 Project Overview

PixelETH is a crypto pixel game where users can purchase pixels on a canvas, with prices that increase based on demand and team dynamics. The system implements:

- **Single Write-Path**: Only `buyPacked()` function modifies state
- **Deterministic Pricing**: Base price + 1.5x step multiplier + team bias
- **Sparse Storage**: Only stores pixels that have been purchased
- **UUPS Upgradeable**: Future-proof with proxy pattern
- **Team Dynamics**: Red vs Blue teams with bias multipliers

## 🏗️ Architecture

### Core Contracts

1. **PixelCanvasV1.sol** - Main game contract
   - Canvas: 1920×1080 pixels (Full HD)
   - Batch pixel purchases with gas optimization
   - Dynamic pricing with team multipliers
   - Pull-payment pattern for ETH distribution

2. **AdminRoles.sol** - Access control
   - Owner role (upgrade + parameter admin)
   - Pauser role (emergency stops)

3. **BuyCalldataPacking.sol** - Calldata utilities
   - Little-endian ID encoding
   - RGB color packing
   - Team bitfield handling

4. **IPixelCanvas.sol** - Interface definition

### Key Features

- **Batch Purchases**: Buy up to 250 pixels in one transaction
- **Team Multipliers**: Dynamic pricing based on Red/Blue team balance
- **Self-Buy Allowed**: Recolor pixels by buying from yourself
- **Pausable**: Emergency stop functionality
- **Upgradeable**: UUPS proxy pattern for future improvements

## 💰 Economics

### Pricing Formula
```
Price = StepPrice × TeamMultiplier
```

- **Step Price**: Base price for new pixels, 1.5× last price for resales
- **Team Multiplier**: 1.0 + α × D (where D is team imbalance)
- **Payouts**: First mint → 100% treasury, Resale → 90% seller, 10% treasury

### Default Parameters
- Base Price: 0.001 ETH
- Team Multiplier Range: 0.75× to 3.0×
- Alpha (bias factor): 1.0
- Max Batch Size: 250 pixels

## 🧪 Testing

Comprehensive test suite covering:

- ✅ Unit tests for all functions
- ✅ Batch purchase mechanics
- ✅ Team multiplier calculations
- ✅ Pause/unpause functionality
- ✅ Withdrawal mechanics
- ✅ Access control
- ✅ Edge cases and error conditions

### Run Tests
```bash
npm run test
```

### Gas Reporting
```bash
npm run test:gas
```

## 🚀 Deployment

### Local Network
```bash
# Start local node
npm run node

# Deploy to localhost
npm run deploy:localhost
```

### Sepolia Testnet
```bash
# Set environment variables in .env
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key

# Deploy to Sepolia
npm run deploy:sepolia

# Verify contract
npm run verify:sepolia <contract_address>
```

### Base Mainnet
```bash
# Set environment variables in .env
BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_private_key_here
BASESCAN_API_KEY=your_basescan_api_key

# Deploy to Base
npm run deploy:base

# Verify contract
npm run verify:base <contract_address>
```

## 📋 Deployment Checklist

### Pre-Deploy
- [ ] Set correct canvas dimensions
- [ ] Configure base price appropriately
- [ ] Set treasury address
- [ ] Configure team multiplier parameters
- [ ] Set appropriate batch size limit

### Post-Deploy
- [ ] Verify contract on block explorer
- [ ] Test basic functionality (buy pixel)
- [ ] Verify pause/unpause works
- [ ] Check team multiplier calculations
- [ ] Test batch purchases
- [ ] Verify withdrawal functionality

## 🔐 Security Features

- **Reentrancy Protection**: Pull-payment pattern prevents reentrancy
- **Input Validation**: Strict validation of pixel IDs, colors, and teams
- **Slippage Protection**: Buyers set maximum total cost
- **Pause Mechanism**: Emergency stop for incidents
- **Access Control**: Role-based permissions
- **Upgrade Safety**: UUPS pattern with timelock

## 📊 Gas Optimization

- **Packed Calldata**: Efficient encoding reduces transaction size
- **Batch Operations**: Multiple pixels in single transaction
- **Sparse Storage**: Only store purchased pixels
- **Single Storage Slot**: Pixel data fits in 32 bytes
- **Optimized Multiplier**: Pre-calculated team bias

## 🛠️ Development Setup

```bash
# Install dependencies
npm install

# Compile contracts
npm run build

# Run tests
npm run test

# Start local node
npm run node

# Deploy locally
npm run deploy:localhost
```

## 📈 Future Improvements (v2+)

- Batch summary events (reduce log gas)
- Rectangle/run claims for mass minting
- Palette mode for calldata reduction
- Rational bias mode for extreme imbalances
- NFT integration for pixel ownership
- Layer 2 deployment options

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

---

Built with ❤️ for the Ethereum ecosystem
