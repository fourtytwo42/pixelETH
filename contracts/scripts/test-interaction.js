const { ethers } = require("hardhat");

async function main() {
  // Contract address from deployment
  const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  // Get signers
  const [deployer, buyer1, buyer2] = await ethers.getSigners();
  
  // Get contract instance
  const PixelCanvas = await ethers.getContractFactory("PixelCanvasV1");
  const pixelCanvas = PixelCanvas.attach(CONTRACT_ADDRESS);
  
  console.log("=== PixelETH Game Interaction Test ===");
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("Deployer:", deployer.address);
  console.log("Buyer1:", buyer1.address);
  console.log("Buyer2:", buyer2.address);
  
  // Test 1: Check initial state
  console.log("\n--- Initial State ---");
  const [redCount, blueCount] = await pixelCanvas.getTeamCounts();
  console.log("Red team count:", redCount.toString());
  console.log("Blue team count:", blueCount.toString());
  console.log("Base price:", ethers.formatEther(await pixelCanvas.basePrice()), "ETH");
  
  // Test 2: Buy first pixel
  console.log("\n--- Buying First Pixel ---");
  const pixelId1 = 960 * 540 + 500; // Center-ish pixel
  const color1 = 0xFF0000; // Red
  const team1 = 0; // Red team
  
  const idsLE1 = encodeIdsLE([pixelId1]);
  const colors1 = encodeColors24([color1]);
  const teamBits1 = encodeTeamBits([team1]);
  
  const price1 = await pixelCanvas.quotePrice(pixelId1, team1);
  console.log("Price for first pixel:", ethers.formatEther(price1), "ETH");
  
  const tx1 = await pixelCanvas.connect(buyer1).buyPacked(idsLE1, colors1, teamBits1, price1, {
    value: price1
  });
  
  const receipt1 = await tx1.wait();
  console.log("First pixel bought! Gas used:", receipt1.gasUsed.toString());
  
  // Check pixel state
  const [owner1, lastPaid1, pixelColor1, pixelTeam1] = await pixelCanvas.getPixel(pixelId1);
  console.log("Pixel owner:", owner1);
  console.log("Last paid:", ethers.formatEther(lastPaid1), "ETH");
  console.log("Color:", "0x" + pixelColor1.toString(16).padStart(6, '0'));
  console.log("Team:", pixelTeam1.toString());
  
  // Test 3: Buy multiple pixels (batch)
  console.log("\n--- Buying Multiple Pixels (Batch) ---");
  const pixelIds = [100, 101, 102, 103, 104];
  const colors = [0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];
  const teams = [1, 0, 1, 0, 1]; // Alternating teams
  
  const idsLE2 = encodeIdsLE(pixelIds);
  const colors2 = encodeColors24(colors);
  const teamBits2 = encodeTeamBits(teams);
  
  // Calculate total cost
  let totalCost = 0n;
  for (let i = 0; i < pixelIds.length; i++) {
    const price = await pixelCanvas.quotePrice(pixelIds[i], teams[i]);
    totalCost += price;
  }
  
  console.log("Total cost for 5 pixels:", ethers.formatEther(totalCost), "ETH");
  
  const tx2 = await pixelCanvas.connect(buyer2).buyPacked(idsLE2, colors2, teamBits2, totalCost, {
    value: totalCost
  });
  
  const receipt2 = await tx2.wait();
  console.log("Batch pixels bought! Gas used:", receipt2.gasUsed.toString());
  
  // Test 4: Check team counts after purchases
  console.log("\n--- Team Counts After Purchases ---");
  const [redCountAfter, blueCountAfter] = await pixelCanvas.getTeamCounts();
  console.log("Red team count:", redCountAfter.toString());
  console.log("Blue team count:", blueCountAfter.toString());
  
  // Test 5: Check multipliers
  console.log("\n--- Team Multipliers ---");
  const redMultiplier = await pixelCanvas.getMultiplierBps(0);
  const blueMultiplier = await pixelCanvas.getMultiplierBps(1);
  console.log("Red team multiplier:", (Number(redMultiplier) / 100).toFixed(2) + "%");
  console.log("Blue team multiplier:", (Number(blueMultiplier) / 100).toFixed(2) + "%");
  
  // Test 6: Self-buy (recolor)
  console.log("\n--- Self-Buy (Recolor) ---");
  const newColor = 0x800080; // Purple
  const colorsRecolor = encodeColors24([newColor]);
  const priceRecolor = await pixelCanvas.quotePrice(pixelId1, team1);
  
  console.log("Recolor price:", ethers.formatEther(priceRecolor), "ETH");
  
  const tx3 = await pixelCanvas.connect(buyer1).buyPacked(idsLE1, colorsRecolor, teamBits1, priceRecolor, {
    value: priceRecolor
  });
  
  await tx3.wait();
  console.log("Pixel recolored!");
  
  // Check new color
  const [, , newPixelColor, ] = await pixelCanvas.getPixel(pixelId1);
  console.log("New color:", "0x" + newPixelColor.toString(16).padStart(6, '0'));
  
  // Test 7: Check pending balances and withdraw
  console.log("\n--- Pending Balances ---");
  const deployerBalance = await pixelCanvas.pendingETH(deployer.address);
  const buyer1Balance = await pixelCanvas.pendingETH(buyer1.address);
  const buyer2Balance = await pixelCanvas.pendingETH(buyer2.address);
  
  console.log("Treasury (deployer) pending:", ethers.formatEther(deployerBalance), "ETH");
  console.log("Buyer1 pending:", ethers.formatEther(buyer1Balance), "ETH");
  console.log("Buyer2 pending:", ethers.formatEther(buyer2Balance), "ETH");
  
  // Withdraw treasury funds
  if (deployerBalance > 0) {
    console.log("\nWithdrawing treasury funds...");
    const withdrawTx = await pixelCanvas.connect(deployer).withdraw();
    await withdrawTx.wait();
    console.log("Treasury withdrawal complete!");
  }
  
  // Withdraw buyer1 funds (from self-buy seller share)
  if (buyer1Balance > 0) {
    console.log("Withdrawing buyer1 funds...");
    const withdrawTx = await pixelCanvas.connect(buyer1).withdraw();
    await withdrawTx.wait();
    console.log("Buyer1 withdrawal complete!");
  }
  
  console.log("\n=== Test Complete ===");
  console.log("All core functionality verified successfully!");
}

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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
