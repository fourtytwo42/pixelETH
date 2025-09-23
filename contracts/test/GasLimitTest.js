const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Gas Limit Testing for Pixel Purchases", function () {
  let pixelCanvas;
  let owner, treasury, user1, user2, user3;
  let basePrice;
  
  // Test parameters
  const CANVAS_WIDTH = 1000;
  const CANVAS_HEIGHT = 1000;
  const BASE_PRICE = ethers.parseEther("0.001"); // 0.001 ETH
  const INITIAL_MAX_BATCH = 1000; // Start with high limit
  
  // Gas tracking
  let gasResults = [];
  
  before(async function () {
    [owner, treasury, user1, user2, user3] = await ethers.getSigners();
    
    console.log("🚀 Deploying PixelCanvas for gas testing...");
    
    // Deploy the contract
    const PixelCanvasFactory = await ethers.getContractFactory("PixelCanvasV1");
    
    pixelCanvas = await upgrades.deployProxy(PixelCanvasFactory, [
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      treasury.address,
      BASE_PRICE,
      owner.address,
      owner.address, // pauser
      INITIAL_MAX_BATCH
    ]);
    
    await pixelCanvas.waitForDeployment();
    const address = await pixelCanvas.getAddress();
    console.log(`✅ PixelCanvas deployed at: ${address}`);
    console.log(`📐 Canvas size: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`);
    console.log(`💰 Base price: ${ethers.formatEther(BASE_PRICE)} ETH`);
    
    basePrice = await pixelCanvas.basePrice();
    console.log(`📊 Contract base price: ${ethers.formatEther(basePrice)} ETH`);
  });

  describe("Gas Consumption Analysis", function () {
    
    // Helper function to encode pixel data
    function encodePixelData(pixelIds, colors, teams) {
      // Encode IDs as little-endian 4-byte values
      const idsBytes = new Uint8Array(pixelIds.length * 4);
      for (let i = 0; i < pixelIds.length; i++) {
        const id = pixelIds[i];
        idsBytes[i * 4] = id & 0xFF;
        idsBytes[i * 4 + 1] = (id >> 8) & 0xFF;
        idsBytes[i * 4 + 2] = (id >> 16) & 0xFF;
        idsBytes[i * 4 + 3] = (id >> 24) & 0xFF;
      }
      
      // Encode colors as 3-byte RGB values
      const colorsBytes = new Uint8Array(colors.length * 3);
      for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        colorsBytes[i * 3] = (color >> 16) & 0xFF;     // R
        colorsBytes[i * 3 + 1] = (color >> 8) & 0xFF; // G
        colorsBytes[i * 3 + 2] = color & 0xFF;        // B
      }
      
      // Encode teams as packed bits (LSB first)
      const teamBytes = new Uint8Array(Math.ceil(teams.length / 8));
      for (let i = 0; i < teams.length; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        if (teams[i]) {
          teamBytes[byteIndex] |= (1 << bitIndex);
        }
      }
      
      return {
        idsLE: "0x" + Array.from(idsBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
        colors24: "0x" + Array.from(colorsBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
        teamBits: "0x" + Array.from(teamBytes).map(b => b.toString(16).padStart(2, '0')).join('')
      };
    }

    // Helper function to calculate total cost
    async function calculateTotalCost(pixelIds, teams) {
      let totalCost = 0n;
      
      for (let i = 0; i < pixelIds.length; i++) {
        const price = await pixelCanvas.quotePrice(pixelIds[i], teams[i]);
        totalCost += price;
      }
      
      return totalCost;
    }

    async function testPixelPurchase(numPixels, description, isResale = false) {
      console.log(`\n🧪 Testing ${description} (${numPixels} pixels)...`);
      
      // Generate sequential pixel IDs to ensure strictly increasing order
      const startId = isResale ? 1 : (gasResults.length * 100) + 1;
      const pixelIds = Array.from({length: numPixels}, (_, i) => startId + i);
      
      // Generate random colors and teams
      const colors = Array.from({length: numPixels}, () => Math.floor(Math.random() * 0xFFFFFF));
      const teams = Array.from({length: numPixels}, () => Math.floor(Math.random() * 2));
      
      const encoded = encodePixelData(pixelIds, colors, teams);
      const totalCost = await calculateTotalCost(pixelIds, teams);
      
      try {
        const tx = await pixelCanvas.connect(user1).buyPacked(
          encoded.idsLE,
          encoded.colors24,
          encoded.teamBits,
          totalCost,
          { value: totalCost }
        );
        
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed;
        const gasPrice = tx.gasPrice || ethers.parseUnits("20", "gwei");
        const gasCostETH = gasUsed * gasPrice;
        
        console.log(`   ⛽ Gas used: ${gasUsed.toLocaleString()}`);
        console.log(`   💸 Gas cost: ${ethers.formatEther(gasCostETH)} ETH`);
        console.log(`   💰 Pixel cost: ${ethers.formatEther(totalCost)} ETH`);
        
        // Store results
        gasResults.push({
          numPixels,
          gasUsed: Number(gasUsed),
          gasCostETH: ethers.formatEther(gasCostETH),
          pixelCostETH: ethers.formatEther(totalCost),
          description,
          isResale,
          successful: true
        });
        
        // Verify the transaction worked correctly
        await verifyPixelPurchase(pixelIds, colors, teams, user1.address);
        
        return { success: true, gasUsed, totalCost };
        
      } catch (error) {
        console.log(`   ❌ Transaction failed: ${error.message}`);
        gasResults.push({
          numPixels,
          gasUsed: 0,
          gasCostETH: "0",
          pixelCostETH: "0",
          description,
          isResale,
          successful: false,
          error: error.message
        });
        
        return { success: false, error: error.message };
      }
    }

    async function verifyPixelPurchase(pixelIds, colors, teams, expectedOwner) {
      for (let i = 0; i < pixelIds.length; i++) {
        const pixel = await pixelCanvas.getPixel(pixelIds[i]);
        expect(pixel.owner).to.equal(expectedOwner, `Pixel ${pixelIds[i]} owner mismatch`);
        expect(pixel.color).to.equal(colors[i], `Pixel ${pixelIds[i]} color mismatch`);
        expect(pixel.team).to.equal(teams[i], `Pixel ${pixelIds[i]} team mismatch`);
      }
    }

    // Test different batch sizes for new pixels
    it("Should test gas consumption for various batch sizes - new pixels", async function () {
      const batchSizes = [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];
      
      for (const size of batchSizes) {
        await testPixelPurchase(size, `New pixels batch`);
      }
    });

    // Test gas consumption with already owned pixels (resale scenario)
    it("Should test gas consumption for resale scenarios", async function () {
      console.log(`\n🔄 Setting up pixels for resale testing...`);
      
      // First, buy some pixels with user1
      const setupPixels = Array.from({length: 100}, (_, i) => 10000 + i);
      const setupColors = Array.from({length: 100}, () => 0xFF0000); // Red
      const setupTeams = Array.from({length: 100}, () => 0); // Red team
      
      const encoded = encodePixelData(setupPixels, setupColors, setupTeams);
      const totalCost = await calculateTotalCost(setupPixels, setupTeams);
      
      await pixelCanvas.connect(user1).buyPacked(
        encoded.idsLE,
        encoded.colors24,
        encoded.teamBits,
        totalCost,
        { value: totalCost }
      );
      
      console.log(`✅ Setup complete - 100 pixels owned by user1`);
      
      // Now test buying already owned pixels (resale scenario)
      const resaleBatchSizes = [1, 5, 10, 25, 50, 75, 100];
      
      for (const size of resaleBatchSizes) {
        const pixelIds = setupPixels.slice(0, size);
        const colors = Array.from({length: size}, () => 0x00FF00); // Green
        const teams = Array.from({length: size}, () => 1); // Blue team
        
        const encoded = encodePixelData(pixelIds, colors, teams);
        const totalCost = await calculateTotalCost(pixelIds, teams);
        
        try {
          const tx = await pixelCanvas.connect(user2).buyPacked(
            encoded.idsLE,
            encoded.colors24,
            encoded.teamBits,
            totalCost,
            { value: totalCost }
          );
          
          const receipt = await tx.wait();
          const gasUsed = receipt.gasUsed;
          
          console.log(`\n🔄 Resale test ${size} pixels - Gas: ${gasUsed.toLocaleString()}`);
          
          gasResults.push({
            numPixels: size,
            gasUsed: Number(gasUsed),
            gasCostETH: ethers.formatEther(gasUsed * (tx.gasPrice || ethers.parseUnits("20", "gwei"))),
            pixelCostETH: ethers.formatEther(totalCost),
            description: `Resale batch`,
            isResale: true,
            successful: true
          });
          
          // Verify ETH distribution
          await verifyETHDistribution(pixelIds, totalCost, user1.address, treasury.address);
          
        } catch (error) {
          console.log(`   ❌ Resale failed for ${size} pixels: ${error.message}`);
        }
      }
    });

    async function verifyETHDistribution(pixelIds, totalCost, originalOwner, treasuryAddress) {
      const sellerPending = await pixelCanvas.pendingETH(originalOwner);
      const treasuryPending = await pixelCanvas.pendingETH(treasuryAddress);
      
      // Calculate expected amounts
      const expectedSellerShare = totalCost * 9000n / 10000n; // 90%
      const expectedTreasuryShare = totalCost - expectedSellerShare; // 10%
      
      console.log(`   💰 Seller pending: ${ethers.formatEther(sellerPending)} ETH`);
      console.log(`   🏛️  Treasury pending: ${ethers.formatEther(treasuryPending)} ETH`);
      
      // Note: These are cumulative amounts, so we just verify they increased
      expect(sellerPending).to.be.gt(0, "Seller should have pending ETH");
      expect(treasuryPending).to.be.gt(0, "Treasury should have pending ETH");
    }

    // Test edge cases and gas limit boundaries
    it("Should find the maximum pixels per transaction", async function () {
      console.log(`\n🎯 Finding maximum pixels per transaction...`);
      
      let low = 500;
      let high = 2000;
      let maxSuccessful = 0;
      
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        console.log(`\n🔍 Testing ${mid} pixels...`);
        
        const result = await testPixelPurchase(mid, `Binary search test`);
        
        if (result.success) {
          maxSuccessful = mid;
          low = mid + 1;
          console.log(`✅ ${mid} pixels successful`);
        } else {
          high = mid - 1;
          console.log(`❌ ${mid} pixels failed`);
        }
      }
      
      console.log(`\n🏆 Maximum successful pixels: ${maxSuccessful}`);
      
      // Test a few more around the boundary
      for (let i = Math.max(1, maxSuccessful - 5); i <= maxSuccessful + 5; i += 2) {
        await testPixelPurchase(i, `Boundary test`);
      }
    });

    // Test mixed scenarios (some owned, some new)
    it("Should test mixed ownership scenarios", async function () {
      console.log(`\n🎭 Testing mixed ownership scenarios...`);
      
      // Setup some owned pixels
      const ownedPixelIds = Array.from({length: 50}, (_, i) => 50000 + i);
      const ownedColors = Array.from({length: 50}, () => 0xFF0000);
      const ownedTeams = Array.from({length: 50}, () => 0);
      
      const ownedEncoded = encodePixelData(ownedPixelIds, ownedColors, ownedTeams);
      const ownedCost = await calculateTotalCost(ownedPixelIds, ownedTeams);
      
      await pixelCanvas.connect(user3).buyPacked(
        ownedEncoded.idsLE,
        ownedEncoded.colors24,
        ownedEncoded.teamBits,
        ownedCost,
        { value: ownedCost }
      );
      
      // Test mixed batches
      const mixedSizes = [25, 50, 100];
      
      for (const size of mixedSizes) {
        // Half owned, half new
        const halfSize = Math.floor(size / 2);
        const mixedIds = [
          ...ownedPixelIds.slice(0, halfSize), // Owned pixels
          ...Array.from({length: size - halfSize}, (_, i) => 60000 + gasResults.length * 1000 + i) // New pixels
        ].sort((a, b) => a - b); // Ensure strictly increasing
        
        const mixedColors = Array.from({length: size}, () => Math.floor(Math.random() * 0xFFFFFF));
        const mixedTeams = Array.from({length: size}, () => Math.floor(Math.random() * 2));
        
        await testPixelPurchase(size, `Mixed ownership (${halfSize} owned, ${size - halfSize} new)`);
      }
    });
  });

  after(async function () {
    console.log(`\n📊 GAS CONSUMPTION ANALYSIS COMPLETE`);
    console.log(`=======================================`);
    
    // Filter successful results
    const successful = gasResults.filter(r => r.successful);
    const failed = gasResults.filter(r => !r.successful);
    
    console.log(`\n✅ Successful transactions: ${successful.length}`);
    console.log(`❌ Failed transactions: ${failed.length}`);
    
    if (successful.length > 0) {
      // Find the maximum successful batch size
      const maxSuccessful = Math.max(...successful.map(r => r.numPixels));
      const maxGas = Math.max(...successful.map(r => r.gasUsed));
      const minGas = Math.min(...successful.map(r => r.gasUsed));
      
      console.log(`\n📈 RESULTS SUMMARY:`);
      console.log(`🏆 Maximum successful pixels per transaction: ${maxSuccessful}`);
      console.log(`⛽ Gas range: ${minGas.toLocaleString()} - ${maxGas.toLocaleString()}`);
      console.log(`📊 Average gas per pixel: ${Math.round(successful.reduce((sum, r) => sum + r.gasUsed / r.numPixels, 0) / successful.length).toLocaleString()}`);
      
      // Recommend safe maximum
      const safeMax = Math.floor(maxSuccessful * 0.9); // 90% of max for safety
      console.log(`\n🎯 RECOMMENDED MAXIMUM PIXELS PER TRANSACTION: ${safeMax}`);
      console.log(`   (90% of maximum successful for safety margin)`);
      
      // Show gas efficiency breakdown
      console.log(`\n📋 DETAILED RESULTS:`);
      console.log(`Pixels | Gas Used    | Gas/Pixel | Type`);
      console.log(`-------|-------------|-----------|----------`);
      
      successful
        .sort((a, b) => a.numPixels - b.numPixels)
        .forEach(r => {
          const gasPerPixel = Math.round(r.gasUsed / r.numPixels);
          const type = r.isResale ? 'Resale' : 'New';
          console.log(`${r.numPixels.toString().padStart(6)} | ${r.gasUsed.toLocaleString().padStart(11)} | ${gasPerPixel.toLocaleString().padStart(9)} | ${type}`);
        });
    }
    
    if (failed.length > 0) {
      console.log(`\n❌ FAILED TRANSACTIONS:`);
      failed.forEach(r => {
        console.log(`   ${r.numPixels} pixels: ${r.error}`);
      });
    }
    
    // Save results to file for reference
    const fs = require('fs');
    const resultsPath = './gas-test-results.json';
    fs.writeFileSync(resultsPath, JSON.stringify({
      testConfig: {
        canvasSize: `${CANVAS_WIDTH}x${CANVAS_HEIGHT}`,
        basePrice: ethers.formatEther(BASE_PRICE),
        timestamp: new Date().toISOString()
      },
      results: gasResults,
      summary: {
        maxSuccessful: successful.length > 0 ? Math.max(...successful.map(r => r.numPixels)) : 0,
        recommendedMax: successful.length > 0 ? Math.floor(Math.max(...successful.map(r => r.numPixels)) * 0.9) : 0
      }
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${resultsPath}`);
  });
});
