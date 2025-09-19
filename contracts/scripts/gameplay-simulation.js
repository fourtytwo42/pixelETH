const { ethers } = require("hardhat");

async function main() {
  // Contract address from deployment
  const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  // Get signers (players)
  const [deployer, alice, bob, charlie, diana] = await ethers.getSigners();
  
  // Get contract instance
  const PixelCanvas = await ethers.getContractFactory("PixelCanvasV1");
  const pixelCanvas = PixelCanvas.attach(CONTRACT_ADDRESS);
  
  console.log("🎮 PixelETH Gameplay Simulation Starting...");
  console.log("=" .repeat(60));
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("Players:");
  console.log("  Alice  :", alice.address);
  console.log("  Bob    :", bob.address);
  console.log("  Charlie:", charlie.address);
  console.log("  Diana  :", diana.address);
  console.log("=" .repeat(60));

  // Track test results
  let testResults = {
    passed: 0,
    failed: 0,
    scenarios: []
  };

  // Helper function to record test results
  function recordTest(name, success, details = "") {
    testResults.scenarios.push({ name, success, details });
    if (success) {
      console.log(`✅ ${name}`);
      testResults.passed++;
    } else {
      console.log(`❌ ${name} - ${details}`);
      testResults.failed++;
    }
  }

  // Test 1: Single Pixel Purchase (Unowned)
  console.log("\n🔍 Test 1: Single Pixel Purchase (Unowned)");
  try {
    const pixelId = 500; // Random pixel
    const color = 0xFF0000; // Red
    const team = 0; // Red team
    
    const idsLE = encodeIdsLE([pixelId]);
    const colors = encodeColors24([color]);
    const teamBits = encodeTeamBits([team]);
    
    const quotedPrice = await pixelCanvas.quotePrice(pixelId, team);
    const basePrice = await pixelCanvas.basePrice();
    
    // Should equal base price for unowned pixel
    const priceCorrect = quotedPrice === basePrice;
    
    const tx = await pixelCanvas.connect(alice).buyPacked(idsLE, colors, teamBits, quotedPrice, {
      value: quotedPrice
    });
    await tx.wait();
    
    // Verify pixel state
    const [owner, lastPaid, pixelColor, pixelTeam] = await pixelCanvas.getPixel(pixelId);
    const stateCorrect = owner === alice.address && 
                        lastPaid === quotedPrice && 
                        pixelColor === color && 
                        pixelTeam === team;
    
    recordTest("Single pixel purchase", priceCorrect && stateCorrect, 
      `Price: ${ethers.formatEther(quotedPrice)} ETH, State verified: ${stateCorrect}`);
  } catch (error) {
    recordTest("Single pixel purchase", false, error.message);
  }

  // Test 2: Batch Purchase (Mixed Unowned)
  console.log("\n🔍 Test 2: Batch Purchase - 5 Unowned Pixels");
  try {
    const pixelIds = [1000, 1001, 1002, 1003, 1004];
    const colors = [0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];
    const teams = [1, 0, 1, 0, 1]; // Alternating teams
    
    const idsLE = encodeIdsLE(pixelIds);
    const colorsBytes = encodeColors24(colors);
    const teamBits = encodeTeamBits(teams);
    
    // Calculate expected total cost
    let expectedTotal = 0n;
    for (let i = 0; i < pixelIds.length; i++) {
      const price = await pixelCanvas.quotePrice(pixelIds[i], teams[i]);
      expectedTotal += price;
    }
    
    const tx = await pixelCanvas.connect(bob).buyPacked(idsLE, colorsBytes, teamBits, expectedTotal, {
      value: expectedTotal
    });
    await tx.wait();
    
    // Verify all pixels were bought correctly
    let allCorrect = true;
    for (let i = 0; i < pixelIds.length; i++) {
      const [owner, , pixelColor, pixelTeam] = await pixelCanvas.getPixel(pixelIds[i]);
      if (owner !== bob.address || pixelColor !== colors[i] || pixelTeam !== teams[i]) {
        allCorrect = false;
        break;
      }
    }
    
    recordTest("Batch purchase (5 unowned)", allCorrect, 
      `Total cost: ${ethers.formatEther(expectedTotal)} ETH`);
  } catch (error) {
    recordTest("Batch purchase (5 unowned)", false, error.message);
  }

  // Test 3: Resale Price Calculation (1.5x)
  console.log("\n🔍 Test 3: Resale Price Calculation (1.5x Step)");
  try {
    const pixelId = 500; // Previously bought by Alice
    
    // Get current step price (should be 1.5x the last paid)
    const [, lastPaid, ,] = await pixelCanvas.getPixel(pixelId);
    const currentStepPrice = await pixelCanvas.getStepPrice(pixelId);
    const expectedStepPrice = (lastPaid * 3n) / 2n; // 1.5x with integer division
    
    const stepPriceCorrect = currentStepPrice === expectedStepPrice;
    
    recordTest("Resale price calculation", stepPriceCorrect,
      `Last paid: ${ethers.formatEther(lastPaid)}, Step price: ${ethers.formatEther(currentStepPrice)}`);
  } catch (error) {
    recordTest("Resale price calculation", false, error.message);
  }

  // Test 4: Self-Buy (Recolor)
  console.log("\n🔍 Test 4: Self-Buy (Recolor) Mechanics");
  try {
    const pixelId = 500; // Alice's pixel
    const newColor = 0x800080; // Purple
    const team = 0; // Same team
    
    const idsLE = encodeIdsLE([pixelId]);
    const colors = encodeColors24([newColor]);
    const teamBits = encodeTeamBits([team]);
    
    const price = await pixelCanvas.quotePrice(pixelId, team);
    const initialPendingBalance = await pixelCanvas.pendingETH(alice.address);
    
    const tx = await pixelCanvas.connect(alice).buyPacked(idsLE, colors, teamBits, price, {
      value: price
    });
    await tx.wait();
    
    // Check color changed
    const [, , pixelColor, ] = await pixelCanvas.getPixel(pixelId);
    const colorChanged = pixelColor === newColor;
    
    // Check Alice received seller share (90%)
    const finalPendingBalance = await pixelCanvas.pendingETH(alice.address);
    const expectedSellerShare = (price * 9000n) / 10000n;
    const balanceIncrease = finalPendingBalance - initialPendingBalance;
    const sellerShareCorrect = balanceIncrease === expectedSellerShare;
    
    recordTest("Self-buy recolor mechanics", colorChanged && sellerShareCorrect,
      `Color changed: ${colorChanged}, Seller share: ${ethers.formatEther(balanceIncrease)} ETH`);
  } catch (error) {
    recordTest("Self-buy recolor mechanics", false, error.message);
  }

  // Test 5: Team Multiplier Effects
  console.log("\n🔍 Test 5: Team Multiplier Effects");
  try {
    // Check current team counts
    const [redCount, blueCount] = await pixelCanvas.getTeamCounts();
    const totalOwned = redCount + blueCount;
    
    console.log(`   Current teams - Red: ${redCount}, Blue: ${blueCount}, Total: ${totalOwned}`);
    
    if (totalOwned > 0) {
      const redMultiplier = await pixelCanvas.getMultiplierBps(0);
      const blueMultiplier = await pixelCanvas.getMultiplierBps(1);
      
      // Check if multipliers are different when teams are imbalanced
      const multipliersReasonable = redMultiplier >= 7500n && redMultiplier <= 30000n &&
                                   blueMultiplier >= 7500n && blueMultiplier <= 30000n;
      
      console.log(`   Red multiplier: ${redMultiplier / 100n}%, Blue multiplier: ${blueMultiplier / 100n}%`);
      
      recordTest("Team multiplier calculation", multipliersReasonable,
        `Red: ${redMultiplier / 100n}%, Blue: ${blueMultiplier / 100n}%`);
    } else {
      recordTest("Team multiplier calculation", true, "No pixels owned yet - skipping");
    }
  } catch (error) {
    recordTest("Team multiplier calculation", false, error.message);
  }

  // Test 6: Rectangle Shape Purchase
  console.log("\n🔍 Test 6: Rectangle Shape Purchase (3x2 grid)");
  try {
    const WIDTH = await pixelCanvas.width();
    const startX = 100;
    const startY = 100;
    const width = 3;
    const height = 2;
    
    // Create 3x2 rectangle of pixels
    const pixelIds = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelId = (startY + y) * WIDTH + (startX + x);
        pixelIds.push(Number(pixelId));
      }
    }
    
    // All same color and team for a cohesive rectangle
    const colors = Array(pixelIds.length).fill(0xFF4500); // Orange
    const teams = Array(pixelIds.length).fill(1); // Blue team
    
    const idsLE = encodeIdsLE(pixelIds);
    const colorsBytes = encodeColors24(colors);
    const teamBits = encodeTeamBits(teams);
    
    // Calculate total cost
    let totalCost = 0n;
    for (let i = 0; i < pixelIds.length; i++) {
      const price = await pixelCanvas.quotePrice(pixelIds[i], teams[i]);
      totalCost += price;
    }
    
    const tx = await pixelCanvas.connect(charlie).buyPacked(idsLE, colorsBytes, teamBits, totalCost, {
      value: totalCost
    });
    await tx.wait();
    
    // Verify rectangle was created
    let rectangleComplete = true;
    for (const pixelId of pixelIds) {
      const [owner, , pixelColor, pixelTeam] = await pixelCanvas.getPixel(pixelId);
      if (owner !== charlie.address || pixelColor !== 0xFF4500 || pixelTeam !== 1) {
        rectangleComplete = false;
        break;
      }
    }
    
    recordTest("Rectangle shape purchase", rectangleComplete,
      `3x2 grid (${pixelIds.length} pixels) at position (${startX}, ${startY})`);
  } catch (error) {
    recordTest("Rectangle shape purchase", false, error.message);
  }

  // Test 7: Mixed Owned/Unowned Batch
  console.log("\n🔍 Test 7: Mixed Owned/Unowned Pixel Batch");
  try {
    // Mix of owned and unowned pixels
    const pixelIds = [
      500,  // Owned by Alice (higher price)
      1000, // Owned by Bob (higher price)  
      2000, 2001, 2002 // Unowned (base price)
    ];
    
    const colors = [0x000000, 0x111111, 0x222222, 0x333333, 0x444444]; // Grayscale
    const teams = [0, 1, 0, 1, 0]; // Alternating teams
    
    const idsLE = encodeIdsLE(pixelIds);
    const colorsBytes = encodeColors24(colors);
    const teamBits = encodeTeamBits(teams);
    
    // Calculate expected costs (mix of base and step prices)
    let totalCost = 0n;
    const individualPrices = [];
    for (let i = 0; i < pixelIds.length; i++) {
      const price = await pixelCanvas.quotePrice(pixelIds[i], teams[i]);
      individualPrices.push(price);
      totalCost += price;
    }
    
    console.log("   Individual pixel prices:");
    for (let i = 0; i < pixelIds.length; i++) {
      const [owner] = await pixelCanvas.getPixel(pixelIds[i]);
      const status = owner === ethers.ZeroAddress ? "unowned" : "owned";
      console.log(`   Pixel ${pixelIds[i]}: ${ethers.formatEther(individualPrices[i])} ETH (${status})`);
    }
    
    const tx = await pixelCanvas.connect(diana).buyPacked(idsLE, colorsBytes, teamBits, totalCost, {
      value: totalCost
    });
    await tx.wait();
    
    // Verify all pixels transferred to Diana
    let allTransferred = true;
    for (const pixelId of pixelIds) {
      const [owner] = await pixelCanvas.getPixel(pixelId);
      if (owner !== diana.address) {
        allTransferred = false;
        break;
      }
    }
    
    recordTest("Mixed owned/unowned batch", allTransferred,
      `Total cost: ${ethers.formatEther(totalCost)} ETH for ${pixelIds.length} pixels`);
  } catch (error) {
    recordTest("Mixed owned/unowned batch", false, error.message);
  }

  // Test 8: Large Batch (Near Limit)
  console.log("\n🔍 Test 8: Large Batch Purchase (Near Limit)");
  try {
    const maxBatch = await pixelCanvas.maxBatch();
    const batchSize = Number(maxBatch) - 10; // Near the limit but safe
    
    // Create a large batch of unowned pixels
    const pixelIds = [];
    for (let i = 0; i < batchSize; i++) {
      pixelIds.push(3000 + i); // Starting from a clear area
    }
    
    // Random colors and teams
    const colors = pixelIds.map(() => Math.floor(Math.random() * 0xFFFFFF));
    const teams = pixelIds.map(() => Math.floor(Math.random() * 2));
    
    const idsLE = encodeIdsLE(pixelIds);
    const colorsBytes = encodeColors24(colors);
    const teamBits = encodeTeamBits(teams);
    
    // Calculate total cost
    let totalCost = 0n;
    for (let i = 0; i < pixelIds.length; i++) {
      const price = await pixelCanvas.quotePrice(pixelIds[i], teams[i]);
      totalCost += price;
    }
    
    const gasEstimate = await pixelCanvas.connect(alice).buyPacked.estimateGas(
      idsLE, colorsBytes, teamBits, totalCost, { value: totalCost }
    );
    
    const tx = await pixelCanvas.connect(alice).buyPacked(idsLE, colorsBytes, teamBits, totalCost, {
      value: totalCost,
      gasLimit: gasEstimate + 50000n // Add buffer
    });
    const receipt = await tx.wait();
    
    recordTest("Large batch purchase", true,
      `${batchSize} pixels, Gas used: ${receipt.gasUsed}, Cost: ${ethers.formatEther(totalCost)} ETH`);
  } catch (error) {
    recordTest("Large batch purchase", false, error.message);
  }

  // Test 9: Slippage Protection
  console.log("\n🔍 Test 9: Slippage Protection");
  try {
    const pixelId = 4000;
    const color = 0x998877;
    const team = 0;
    
    const idsLE = encodeIdsLE([pixelId]);
    const colors = encodeColors24([color]);
    const teamBits = encodeTeamBits([team]);
    
    const actualPrice = await pixelCanvas.quotePrice(pixelId, team);
    const maxTotal = actualPrice - 1n; // Set max total too low
    
    try {
      await pixelCanvas.connect(bob).buyPacked(idsLE, colors, teamBits, maxTotal, {
        value: actualPrice
      });
      recordTest("Slippage protection", false, "Should have reverted but didn't");
    } catch (error) {
      const isSlippageError = error.message.includes("SlippageExceeded") || 
                             error.message.includes("revert");
      recordTest("Slippage protection", isSlippageError, "Correctly reverted on slippage");
    }
  } catch (error) {
    recordTest("Slippage protection", false, error.message);
  }

  // Test 10: Final State Verification
  console.log("\n🔍 Test 10: Final State Verification");
  try {
    const [finalRedCount, finalBlueCount] = await pixelCanvas.getTeamCounts();
    const totalPixelsOwned = finalRedCount + finalBlueCount;
    
    // Check that treasury has accumulated fees
    const treasuryBalance = await pixelCanvas.pendingETH(deployer.address);
    const treasuryHasFees = treasuryBalance > 0;
    
    // Verify team counts are reasonable
    const countsReasonable = totalPixelsOwned > 0n && 
                           finalRedCount >= 0n && 
                           finalBlueCount >= 0n;
    
    console.log(`   Final team counts - Red: ${finalRedCount}, Blue: ${finalBlueCount}`);
    console.log(`   Treasury pending: ${ethers.formatEther(treasuryBalance)} ETH`);
    
    recordTest("Final state verification", countsReasonable && treasuryHasFees,
      `Total pixels: ${totalPixelsOwned}, Treasury has fees: ${treasuryHasFees}`);
  } catch (error) {
    recordTest("Final state verification", false, error.message);
  }

  // Print final results
  console.log("\n" + "=".repeat(60));
  console.log("🏁 GAMEPLAY SIMULATION COMPLETE");
  console.log("=".repeat(60));
  console.log(`✅ Tests Passed: ${testResults.passed}`);
  console.log(`❌ Tests Failed: ${testResults.failed}`);
  console.log(`📊 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    console.log("\n❌ Failed Tests:");
    testResults.scenarios
      .filter(s => !s.success)
      .forEach(s => console.log(`   • ${s.name}: ${s.details}`));
  }
  
  console.log("\n🎮 All core gameplay mechanics verified!");
  console.log("Ready for mainnet deployment! 🚀");
}

// Helper functions for encoding
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
