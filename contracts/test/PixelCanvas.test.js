const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("PixelCanvasV1", function () {
  let pixelCanvas;
  let owner, treasury, buyer1, buyer2;

  const WIDTH = 100;
  const HEIGHT = 100;
  const BASE_PRICE = ethers.parseEther("0.001");
  const MAX_BATCH = 10;

  beforeEach(async function () {
    [owner, treasury, buyer1, buyer2] = await ethers.getSigners();

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
  });

  describe("Deployment", function () {
    it("Should set the right parameters", async function () {
      expect(await pixelCanvas.width()).to.equal(WIDTH);
      expect(await pixelCanvas.height()).to.equal(HEIGHT);
      expect(await pixelCanvas.basePrice()).to.equal(BASE_PRICE);
      expect(await pixelCanvas.treasury()).to.equal(treasury.address);
      expect(await pixelCanvas.maxBatch()).to.equal(MAX_BATCH);
      expect(await pixelCanvas.owner()).to.equal(owner.address);
    });

    it("Should have initial team counts of zero", async function () {
      const [redCount, blueCount] = await pixelCanvas.getTeamCounts();
      expect(redCount).to.equal(0);
      expect(blueCount).to.equal(0);
    });

    it("Should have correct default bias parameters", async function () {
      expect(await pixelCanvas.biasLinearAlphaBps()).to.equal(10000); // α = 1.0
      expect(await pixelCanvas.minMultBps()).to.equal(7500); // 0.75x
      expect(await pixelCanvas.maxMultBps()).to.equal(30000); // 3.0x
    });
  });

  describe("Single Pixel Purchase", function () {
    it("Should allow buying a single unowned pixel", async function () {
      const pixelId = 50 * WIDTH + 50; // Center pixel
      const color = 0xFF0000; // Red color
      const team = 0; // Red team

      // Encode inputs
      const idsLE = encodeIdsLE([pixelId]);
      const colors24 = encodeColors24([color]);
      const teamBits = encodeTeamBits([team]);

      const price = await pixelCanvas.quotePrice(pixelId, team);
      
      await expect(
        pixelCanvas.connect(buyer1).buyPacked(idsLE, colors24, teamBits, price, {
          value: price
        })
      ).to.emit(pixelCanvas, "PixelBought")
        .withArgs(pixelId, ethers.ZeroAddress, buyer1.address, price, color, team);

      // Check pixel state
      const [pixelOwner, lastPaid, pixelColor, pixelTeam] = await pixelCanvas.getPixel(pixelId);
      expect(pixelOwner).to.equal(buyer1.address);
      expect(lastPaid).to.equal(price);
      expect(pixelColor).to.equal(color);
      expect(pixelTeam).to.equal(team);

      // Check team counts
      const [redCount, blueCount] = await pixelCanvas.getTeamCounts();
      expect(redCount).to.equal(1);
      expect(blueCount).to.equal(0);

      // Check treasury pending balance
      expect(await pixelCanvas.pendingETH(treasury.address)).to.equal(price);
    });

    it("Should calculate correct step price for resale", async function () {
      const pixelId = 0;
      const color = 0x00FF00;
      const team = 1; // Blue team

      // First purchase
      const idsLE = encodeIdsLE([pixelId]);
      const colors24 = encodeColors24([color]);
      const teamBits = encodeTeamBits([team]);

      const initialPrice = await pixelCanvas.quotePrice(pixelId, team);
      
      await pixelCanvas.connect(buyer1).buyPacked(idsLE, colors24, teamBits, initialPrice, {
        value: initialPrice
      });

      // Check step price calculation for resale (should be 1.5x)
      const expectedStepPrice = (initialPrice * 3n) / 2n;
      const actualStepPrice = await pixelCanvas.getStepPrice(pixelId);
      expect(actualStepPrice).to.equal(expectedStepPrice);
    });
  });

  describe("Batch Purchase", function () {
    it("Should allow buying multiple pixels", async function () {
      const pixelIds = [0, 1, 2];
      const colors = [0xFF0000, 0x00FF00, 0x0000FF];
      const teams = [0, 1, 0]; // Red, Blue, Red

      const idsLE = encodeIdsLE(pixelIds);
      const colors24 = encodeColors24(colors);
      const teamBits = encodeTeamBits(teams);

      // Calculate total cost
      let totalCost = 0n;
      for (let i = 0; i < pixelIds.length; i++) {
        const price = await pixelCanvas.quotePrice(pixelIds[i], teams[i]);
        totalCost += price;
      }

      await pixelCanvas.connect(buyer1).buyPacked(idsLE, colors24, teamBits, totalCost, {
        value: totalCost
      });

      // Check all pixels were bought
      for (let i = 0; i < pixelIds.length; i++) {
        const [pixelOwner, , pixelColor, pixelTeam] = await pixelCanvas.getPixel(pixelIds[i]);
        expect(pixelOwner).to.equal(buyer1.address);
        expect(pixelColor).to.equal(colors[i]);
        expect(pixelTeam).to.equal(teams[i]);
      }

      // Check team counts
      const [redCount, blueCount] = await pixelCanvas.getTeamCounts();
      expect(redCount).to.equal(2); // pixels 0 and 2
      expect(blueCount).to.equal(1); // pixel 1
    });

    it("Should enforce batch size limit", async function () {
      const pixelIds = Array.from({length: MAX_BATCH + 1}, (_, i) => i);
      const colors = Array(MAX_BATCH + 1).fill(0xFF0000);
      const teams = Array(MAX_BATCH + 1).fill(0);

      const idsLE = encodeIdsLE(pixelIds);
      const colors24 = encodeColors24(colors);
      const teamBits = encodeTeamBits(teams);

      await expect(
        pixelCanvas.connect(buyer1).buyPacked(idsLE, colors24, teamBits, ethers.parseEther("10"), {
          value: ethers.parseEther("10")
        })
      ).to.be.revertedWithCustomError(pixelCanvas, "BatchTooLarge");
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow pauser to pause and unpause", async function () {
      await pixelCanvas.connect(owner).pause();
      expect(await pixelCanvas.isPaused()).to.be.true;

      // Should revert when paused
      const idsLE = encodeIdsLE([0]);
      const colors24 = encodeColors24([0xFF0000]);
      const teamBits = encodeTeamBits([0]);
      const price = BASE_PRICE;

      await expect(
        pixelCanvas.connect(buyer1).buyPacked(idsLE, colors24, teamBits, price, {
          value: price
        })
      ).to.be.reverted;

      // Unpause
      await pixelCanvas.connect(owner).unpause();
      expect(await pixelCanvas.isPaused()).to.be.false;

      // Should work again
      await expect(
        pixelCanvas.connect(buyer1).buyPacked(idsLE, colors24, teamBits, price, {
          value: price
        })
      ).to.not.be.reverted;
    });
  });

  describe("Withdraw", function () {
    it("Should allow withdrawing pending ETH", async function () {
      const pixelId = 0;
      const idsLE = encodeIdsLE([pixelId]);
      const colors24 = encodeColors24([0xFF0000]);
      const teamBits = encodeTeamBits([0]);
      const price = await pixelCanvas.quotePrice(pixelId, 0);

      // Buy pixel
      await pixelCanvas.connect(buyer1).buyPacked(idsLE, colors24, teamBits, price, {
        value: price
      });

      // Treasury should have pending balance
      const pendingBalance = await pixelCanvas.pendingETH(treasury.address);
      expect(pendingBalance).to.equal(price);

      // Withdraw
      const initialBalance = await ethers.provider.getBalance(treasury.address);
      const tx = await pixelCanvas.connect(treasury).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const finalBalance = await ethers.provider.getBalance(treasury.address);
      expect(finalBalance).to.equal(initialBalance + pendingBalance - gasUsed);

      // Pending balance should be zero
      expect(await pixelCanvas.pendingETH(treasury.address)).to.equal(0);
    });
  });

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
});
