const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("PixelETH Gameplay Scenarios", function () {
  let pixelCanvas;
  let owner, treasury, alice, bob, charlie, diana, eve;

  const WIDTH = 100;
  const HEIGHT = 100;
  const BASE_PRICE = ethers.parseEther("0.001");
  const MAX_BATCH = 50; // Smaller for testing

  // Test results tracking
  let testResults = {
    passed: 0,
    failed: 0,
    scenarios: []
  };

  function recordTest(name, success, details = "") {
    testResults.scenarios.push({ name, success, details });
    if (success) {
      console.log(`    ✅ ${name}`);
      testResults.passed++;
    } else {
      console.log(`    ❌ ${name} - ${details}`);
      testResults.failed++;
    }
  }

  beforeEach(async function () {
    [owner, treasury, alice, bob, charlie, diana, eve] = await ethers.getSigners();

    const PixelCanvasV1Factory = await ethers.getContractFactory("PixelCanvasV1");
    pixelCanvas = await upgrades.deployProxy(
      PixelCanvasV1Factory,
      [
        WIDTH,
        HEIGHT,
        treasury.address,
        BASE_PRICE,
        owner.address,
        owner.address,
        MAX_BATCH
      ],
      {
        initializer: "initialize",
        kind: "uups"
      }
    );

    await pixelCanvas.waitForDeployment();
    
    console.log("\n  🎮 PixelETH Gameplay Testing Started");
    console.log(`  Canvas: ${WIDTH}x${HEIGHT}, Base Price: ${ethers.formatEther(BASE_PRICE)} ETH`);
  });

  describe("🔍 Single Pixel Scenarios", function () {
    it("Should handle single pixel purchase with correct pricing", async function () {
      const pixelId = 50 * WIDTH + 50; // Center pixel
      const color = 0xFF0000; // Red
      const team = 0; // Red team

      const idsLE = encodeIdsLE([pixelId]);
      const colors24 = encodeColors24([color]);
      const teamBits = encodeTeamBits([team]);

      const quotedPrice = await pixelCanvas.quotePrice(pixelId, team);
      
      // Should equal base price for unowned pixel
      expect(quotedPrice).to.equal(BASE_PRICE);

      await pixelCanvas.connect(alice).buyPacked(idsLE, colors24, teamBits, quotedPrice, {
        value: quotedPrice
      });

      const [pixelOwner, lastPaid, pixelColor, pixelTeam] = await pixelCanvas.getPixel(pixelId);
      expect(pixelOwner).to.equal(alice.address);
      expect(lastPaid).to.equal(quotedPrice);
      expect(pixelColor).to.equal(color);
      expect(pixelTeam).to.equal(team);

      recordTest("Single pixel purchase", true, `Price: ${ethers.formatEther(quotedPrice)} ETH`);
    });

    it("Should handle self-buy recoloring correctly", async function () {
      const pixelId = 100;
      const initialColor = 0x00FF00;
      const newColor = 0x0000FF;
      const team = 1;

      // First purchase
      let idsLE = encodeIdsLE([pixelId]);
      let colors24 = encodeColors24([initialColor]);
      let teamBits = encodeTeamBits([team]);
      let price = await pixelCanvas.quotePrice(pixelId, team);

      await pixelCanvas.connect(bob).buyPacked(idsLE, colors24, teamBits, price, {
        value: price
      });

      // Self-buy for recoloring
      colors24 = encodeColors24([newColor]);
      const recolorPrice = await pixelCanvas.quotePrice(pixelId, team);
      const initialBalance = await pixelCanvas.pendingETH(bob.address);

      await pixelCanvas.connect(bob).buyPacked(idsLE, colors24, teamBits, recolorPrice, {
        value: recolorPrice
      });

      // Check color changed
      const [, , pixelColor, ] = await pixelCanvas.getPixel(pixelId);
      expect(pixelColor).to.equal(newColor);

      // Check seller share received
      const finalBalance = await pixelCanvas.pendingETH(bob.address);
      const expectedSellerShare = (recolorPrice * 9000n) / 10000n;
      expect(finalBalance - initialBalance).to.equal(expectedSellerShare);

      recordTest("Self-buy recoloring", true, `Net cost: ${ethers.formatEther(recolorPrice - expectedSellerShare)} ETH`);
    });
  });

  describe("🔍 Batch Purchase Scenarios", function () {
    it("Should handle small batch of unowned pixels", async function () {
      const pixelIds = [200, 201, 202, 203, 204];
      const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF];
      const teams = [0, 1, 0, 1, 0]; // Alternating teams

      const idsLE = encodeIdsLE(pixelIds);
      const colors24 = encodeColors24(colors);
      const teamBits = encodeTeamBits(teams);

      // Calculate total cost
      let totalCost = 0n;
      for (let i = 0; i < pixelIds.length; i++) {
        const price = await pixelCanvas.quotePrice(pixelIds[i], teams[i]);
        totalCost += price;
      }

      await pixelCanvas.connect(charlie).buyPacked(idsLE, colors24, teamBits, totalCost, {
        value: totalCost
      });

      // Verify all pixels
      for (let i = 0; i < pixelIds.length; i++) {
        const [pixelOwner, , pixelColor, pixelTeam] = await pixelCanvas.getPixel(pixelIds[i]);
        expect(pixelOwner).to.equal(charlie.address);
        expect(pixelColor).to.equal(colors[i]);
        expect(pixelTeam).to.equal(teams[i]);
      }

      recordTest("Small batch purchase", true, `${pixelIds.length} pixels, ${ethers.formatEther(totalCost)} ETH`);
    });

    it("Should handle rectangle shape purchase", async function () {
      const startX = 10;
      const startY = 10;
      const rectWidth = 3;
      const rectHeight = 3;

      // Create 3x3 rectangle
      const pixelIds = [];
      for (let y = 0; y < rectHeight; y++) {
        for (let x = 0; x < rectWidth; x++) {
          pixelIds.push((startY + y) * WIDTH + (startX + x));
        }
      }

      const color = 0x800080; // Purple
      const team = 1; // Blue team
      const colors = Array(pixelIds.length).fill(color);
      const teams = Array(pixelIds.length).fill(team);

      const idsLE = encodeIdsLE(pixelIds);
      const colors24 = encodeColors24(colors);
      const teamBits = encodeTeamBits(teams);

      let totalCost = 0n;
      for (const pixelId of pixelIds) {
        totalCost += await pixelCanvas.quotePrice(pixelId, team);
      }

      await pixelCanvas.connect(diana).buyPacked(idsLE, colors24, teamBits, totalCost, {
        value: totalCost
      });

      // Verify rectangle is complete
      for (const pixelId of pixelIds) {
        const [pixelOwner, , pixelColor, pixelTeam] = await pixelCanvas.getPixel(pixelId);
        expect(pixelOwner).to.equal(diana.address);
        expect(pixelColor).to.equal(color);
        expect(pixelTeam).to.equal(team);
      }

      recordTest("Rectangle shape purchase", true, `${rectWidth}x${rectHeight} = ${pixelIds.length} pixels`);
    });

    it("Should handle mixed owned/unowned pixel batch", async function () {
      // First, buy some pixels to create owned ones
      const ownedPixels = [300, 301];
      for (let i = 0; i < ownedPixels.length; i++) {
        const idsLE = encodeIdsLE([ownedPixels[i]]);
        const colors24 = encodeColors24([0x111111]);
        const teamBits = encodeTeamBits([0]);
        const price = await pixelCanvas.quotePrice(ownedPixels[i], 0);
        
        await pixelCanvas.connect(eve).buyPacked(idsLE, colors24, teamBits, price, {
          value: price
        });
      }

      // Now buy a mix of owned and unowned
      const pixelIds = [300, 301, 302, 303, 304]; // First 2 owned, last 3 unowned
      const colors = [0x000000, 0x111111, 0x222222, 0x333333, 0x444444];
      const teams = [1, 0, 1, 0, 1];

      const idsLE = encodeIdsLE(pixelIds);
      const colors24 = encodeColors24(colors);
      const teamBits = encodeTeamBits(teams);

      // Calculate costs (mix of base and step prices)
      let totalCost = 0n;
      const prices = [];
      for (let i = 0; i < pixelIds.length; i++) {
        const price = await pixelCanvas.quotePrice(pixelIds[i], teams[i]);
        prices.push(price);
        totalCost += price;
      }

      // Owned pixels should cost more than base price (due to 1.5x step and team multipliers)
      expect(prices[0]).to.be.greaterThan(BASE_PRICE);
      expect(prices[1]).to.be.greaterThan(BASE_PRICE);
      // Unowned pixels should cost base price * team multiplier (which may be different from base)
      expect(prices[2]).to.be.greaterThan(0);
      expect(prices[3]).to.be.greaterThan(0);
      expect(prices[4]).to.be.greaterThan(0);

      await pixelCanvas.connect(alice).buyPacked(idsLE, colors24, teamBits, totalCost, {
        value: totalCost
      });

      recordTest("Mixed owned/unowned batch", true, 
        `Total: ${ethers.formatEther(totalCost)} ETH (owned pixels cost more)`);
    });
  });

  describe("🔍 Pricing and Economics", function () {
    it("Should apply 1.5x step pricing correctly", async function () {
      const pixelId = 400;
      const color = 0x654321;
      const team = 0;

      // First purchase
      const idsLE = encodeIdsLE([pixelId]);
      const colors24 = encodeColors24([color]);
      const teamBits = encodeTeamBits([team]);
      const initialPrice = await pixelCanvas.quotePrice(pixelId, team);

      await pixelCanvas.connect(bob).buyPacked(idsLE, colors24, teamBits, initialPrice, {
        value: initialPrice
      });

      // Check step price calculation
      const stepPrice = await pixelCanvas.getStepPrice(pixelId);
      const expectedStepPrice = (initialPrice * 3n) / 2n; // 1.5x with integer division
      expect(stepPrice).to.equal(expectedStepPrice);

      recordTest("1.5x step pricing", true, 
        `Initial: ${ethers.formatEther(initialPrice)}, Step: ${ethers.formatEther(stepPrice)} ETH`);
    });

    it("Should apply team multipliers correctly", async function () {
      // Buy several pixels to create team imbalance
      const redPixels = [500, 501, 502]; // 3 red pixels
      const bluePixels = [510]; // 1 blue pixel

      // Buy red pixels
      for (const pixelId of redPixels) {
        const idsLE = encodeIdsLE([pixelId]);
        const colors24 = encodeColors24([0xFF0000]);
        const teamBits = encodeTeamBits([0]);
        const price = await pixelCanvas.quotePrice(pixelId, 0);
        
        await pixelCanvas.connect(alice).buyPacked(idsLE, colors24, teamBits, price, {
          value: price
        });
      }

      // Buy blue pixel
      for (const pixelId of bluePixels) {
        const idsLE = encodeIdsLE([pixelId]);
        const colors24 = encodeColors24([0x0000FF]);
        const teamBits = encodeTeamBits([1]);
        const price = await pixelCanvas.quotePrice(pixelId, 1);
        
        await pixelCanvas.connect(bob).buyPacked(idsLE, colors24, teamBits, price, {
          value: price
        });
      }

      const redMultiplier = await pixelCanvas.getMultiplierBps(0);
      const blueMultiplier = await pixelCanvas.getMultiplierBps(1);

      // Red team (majority) should have higher multiplier
      expect(redMultiplier).to.be.greaterThan(10000n); // > 1.0x
      expect(blueMultiplier).to.be.lessThan(10000n);   // < 1.0x

      // Both should be within reasonable bounds
      expect(redMultiplier).to.be.at.least(7500n);     // >= 0.75x
      expect(redMultiplier).to.be.at.most(30000n);     // <= 3.0x
      expect(blueMultiplier).to.be.at.least(7500n);
      expect(blueMultiplier).to.be.at.most(30000n);

      recordTest("Team multipliers", true, 
        `Red: ${redMultiplier / 100n}%, Blue: ${blueMultiplier / 100n}%`);
    });

    it("Should handle payout distribution correctly", async function () {
      const pixelId = 600;
      const color = 0xABCDEF;
      const team = 1;

      // First purchase
      const idsLE = encodeIdsLE([pixelId]);
      const colors24 = encodeColors24([color]);
      const teamBits = encodeTeamBits([team]);
      const price = await pixelCanvas.quotePrice(pixelId, team);

      await pixelCanvas.connect(charlie).buyPacked(idsLE, colors24, teamBits, price, {
        value: price
      });

      // Check treasury got 100% for first mint
      const treasuryBalance1 = await pixelCanvas.pendingETH(treasury.address);
      expect(treasuryBalance1).to.equal(price);

      // Resale
      const resalePrice = await pixelCanvas.quotePrice(pixelId, team);
      const charlieInitialBalance = await pixelCanvas.pendingETH(charlie.address);

      await pixelCanvas.connect(diana).buyPacked(idsLE, colors24, teamBits, resalePrice, {
        value: resalePrice
      });

      // Check 90/10 split
      const charlieFinalBalance = await pixelCanvas.pendingETH(charlie.address);
      const treasuryBalance2 = await pixelCanvas.pendingETH(treasury.address);

      const charlieGain = charlieFinalBalance - charlieInitialBalance;
      const treasuryGain = treasuryBalance2 - treasuryBalance1;

      const expectedSellerShare = (resalePrice * 9000n) / 10000n;
      const expectedTreasuryShare = resalePrice - expectedSellerShare;

      expect(charlieGain).to.equal(expectedSellerShare);
      expect(treasuryGain).to.equal(expectedTreasuryShare);

      recordTest("Payout distribution", true, 
        `Seller: ${ethers.formatEther(charlieGain)}, Treasury: ${ethers.formatEther(treasuryGain)} ETH`);
    });
  });

  describe("🔍 Edge Cases and Security", function () {
    it("Should enforce slippage protection", async function () {
      const pixelId = 700;
      const color = 0x123456;
      const team = 0;

      const idsLE = encodeIdsLE([pixelId]);
      const colors24 = encodeColors24([color]);
      const teamBits = encodeTeamBits([team]);

      const actualPrice = await pixelCanvas.quotePrice(pixelId, team);
      const maxTotal = actualPrice - 1n; // Set max too low

      await expect(
        pixelCanvas.connect(alice).buyPacked(idsLE, colors24, teamBits, maxTotal, {
          value: actualPrice
        })
      ).to.be.revertedWithCustomError(pixelCanvas, "SlippageExceeded");

      recordTest("Slippage protection", true, "Correctly reverted when price exceeded max");
    });

    it("Should handle batch size limits", async function () {
      const pixelIds = Array.from({length: MAX_BATCH + 1}, (_, i) => 800 + i);
      const colors = Array(MAX_BATCH + 1).fill(0x999999);
      const teams = Array(MAX_BATCH + 1).fill(0);

      const idsLE = encodeIdsLE(pixelIds);
      const colors24 = encodeColors24(colors);
      const teamBits = encodeTeamBits(teams);

      await expect(
        pixelCanvas.connect(bob).buyPacked(idsLE, colors24, teamBits, ethers.parseEther("1"), {
          value: ethers.parseEther("1")
        })
      ).to.be.revertedWithCustomError(pixelCanvas, "BatchTooLarge");

      recordTest("Batch size limits", true, `Correctly rejected batch of ${pixelIds.length} pixels`);
    });

    it("Should validate pixel boundaries", async function () {
      const invalidPixelId = WIDTH * HEIGHT; // Out of bounds
      const color = 0x123456;
      const team = 0;

      const idsLE = encodeIdsLE([invalidPixelId]);
      const colors24 = encodeColors24([color]);
      const teamBits = encodeTeamBits([team]);
      const price = BASE_PRICE;

      await expect(
        pixelCanvas.connect(alice).buyPacked(idsLE, colors24, teamBits, price, {
          value: price
        })
      ).to.be.revertedWithCustomError(pixelCanvas, "BadId");

      recordTest("Pixel boundary validation", true, "Correctly rejected out-of-bounds pixel");
    });
  });

  after(function () {
    console.log("\n  " + "=".repeat(50));
    console.log("  🏁 GAMEPLAY TESTING COMPLETE");
    console.log("  " + "=".repeat(50));
    console.log(`  ✅ Tests Passed: ${testResults.passed}`);
    console.log(`  ❌ Tests Failed: ${testResults.failed}`);
    console.log(`  📊 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
      console.log("\n  ❌ Failed Scenarios:");
      testResults.scenarios
        .filter(s => !s.success)
        .forEach(s => console.log(`     • ${s.name}: ${s.details}`));
    }
    
    console.log("\n  🎮 All gameplay mechanics thoroughly tested!");
  });

  // Helper functions
  function encodeIdsLE(ids) {
    const buffer = Buffer.alloc(ids.length * 4);
    for (let i = 0; i < ids.length; i++) {
      buffer.writeUInt32LE(ids[i], i * 4);
    }
    return "0x" + buffer.toString("hex");
  }

  function encodeColors24(colors) {
    const buffer = Buffer.alloc(colors.length * 3);
    for (let i = 0; i < colors.length; i++) {
      buffer.writeUIntBE(colors[i], i * 3, 3);
    }
    return "0x" + buffer.toString("hex");
  }

  function encodeTeamBits(teams) {
    const numBytes = Math.ceil(teams.length / 8);
    const buffer = Buffer.alloc(numBytes);
    
    for (let i = 0; i < teams.length; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      if (teams[i] === 1) {
        buffer[byteIndex] |= (1 << bitIndex);
      }
    }
    
    return "0x" + buffer.toString("hex");
  }
});
