#!/usr/bin/env node

/**
 * Gas Testing Script Runner
 * 
 * This script:
 * 1. Starts a dedicated Hardhat node for gas testing
 * 2. Runs comprehensive gas limit tests
 * 3. Provides a recommended maximum pixels per transaction
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Gas Limit Testing Suite...\n');

// Configuration
const GAS_TEST_CONFIG = 'hardhat.gas-test.config.js';
const TEST_FILE = 'test/GasLimitTest.js';
const NODE_PORT = 8546;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  let hardhatNode = null;
  
  try {
    // Step 1: Start dedicated Hardhat node
    log('📡 Starting dedicated Hardhat node for gas testing...', colors.yellow);
    
    hardhatNode = spawn('npx', ['hardhat', 'node', '--config', GAS_TEST_CONFIG, '--port', NODE_PORT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });
    
    // Wait for node to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Hardhat node startup timeout')), 30000);
      
      hardhatNode.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Started HTTP and WebSocket JSON-RPC server')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      
      hardhatNode.stderr.on('data', (data) => {
        console.error('Hardhat node error:', data.toString());
      });
      
      hardhatNode.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    log('✅ Hardhat node started successfully!', colors.green);
    
    // Wait a bit more to ensure node is fully ready
    await sleep(2000);
    
    // Step 2: Run the gas tests
    log('\n🧪 Running comprehensive gas limit tests...', colors.cyan);
    log('This may take several minutes...', colors.yellow);
    
    const testProcess = spawn('npx', ['hardhat', 'test', TEST_FILE, '--config', GAS_TEST_CONFIG, '--network', 'hardhat'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    await new Promise((resolve, reject) => {
      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Test process exited with code ${code}`));
        }
      });
      
      testProcess.on('error', (error) => {
        reject(error);
      });
    });
    
    log('\n✅ Gas testing completed!', colors.green);
    
    // Step 3: Read and display results
    const resultsPath = path.join(process.cwd(), 'gas-test-results.json');
    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      
      log('\n📊 FINAL RECOMMENDATIONS:', colors.bright + colors.green);
      log('=' .repeat(50), colors.green);
      
      if (results.summary.recommendedMax > 0) {
        log(`🎯 RECOMMENDED MAX PIXELS PER TRANSACTION: ${results.summary.recommendedMax}`, colors.bright + colors.cyan);
        log(`   Based on ${results.summary.maxSuccessful} maximum successful pixels`, colors.cyan);
        log(`   (90% safety margin applied)`, colors.cyan);
      } else {
        log('❌ No successful transactions found. Check test results.', colors.red);
      }
      
      log('\n📋 Quick Summary:', colors.yellow);
      log(`   Canvas Size: ${results.testConfig.canvasSize}`, colors.reset);
      log(`   Base Price: ${results.testConfig.basePrice} ETH`, colors.reset);
      log(`   Total Tests: ${results.results.length}`, colors.reset);
      log(`   Successful: ${results.results.filter(r => r.successful).length}`, colors.green);
      log(`   Failed: ${results.results.filter(r => !r.successful).length}`, colors.red);
      
      log(`\n💾 Detailed results saved to: ${resultsPath}`, colors.blue);
    } else {
      log('⚠️  Results file not found. Check test output above.', colors.yellow);
    }
    
  } catch (error) {
    log(`\n❌ Error during gas testing: ${error.message}`, colors.red);
    process.exit(1);
  } finally {
    // Cleanup: Stop Hardhat node
    if (hardhatNode) {
      log('\n🛑 Stopping Hardhat node...', colors.yellow);
      hardhatNode.kill('SIGTERM');
      
      // Give it a moment to stop gracefully
      await sleep(2000);
      
      if (!hardhatNode.killed) {
        hardhatNode.kill('SIGKILL');
      }
      
      log('✅ Hardhat node stopped.', colors.green);
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n🛑 Interrupted by user. Cleaning up...', colors.yellow);
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
});
