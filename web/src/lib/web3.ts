import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';

// Network configurations
export const NETWORKS = {
  hardhat: {
    chainId: '0x7A69', // 31337 in hex
    chainName: 'Hardhat Local',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['http://127.0.0.1:8545'],
    blockExplorerUrls: null,
  },
  sepolia: {
    chainId: '0xAA36A7', // 11155111 in hex
    chainName: 'Sepolia Test Network',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  base: {
    chainId: '0x2105', // 8453 in hex
    chainName: 'Base',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },
};

// Contract addresses per network
export const CONTRACT_ADDRESSES = {
  31337: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // Hardhat local
  11155111: '', // Sepolia (to be deployed)
  8453: '', // Base (to be deployed)
};

// PixelCanvas ABI (essential functions)
export const PIXEL_CANVAS_ABI = [
  // View functions
  'function width() view returns (uint32)',
  'function height() view returns (uint32)',
  'function basePrice() view returns (uint128)',
  'function maxBatch() view returns (uint256)',
  'function getPixel(uint32 id) view returns (address owner, uint128 lastPaid, uint24 color, uint8 team)',
  'function getStepPrice(uint32 id) view returns (uint128)',
  'function getMultiplierBps(uint8 team) view returns (uint16)',
  'function quotePrice(uint32 id, uint8 team) view returns (uint128)',
  'function getTeamCounts() view returns (uint32 redCount, uint32 blueCount)',
  'function pendingETH(address account) view returns (uint256)',
  'function isPaused() view returns (bool)',
  
  // Write functions
  'function buyPacked(bytes calldata idsLE, bytes calldata colors24, bytes calldata teamBits, uint256 maxTotal) payable',
  'function withdraw()',
  
  // Events
  'event PixelBought(uint32 indexed id, address from, address to, uint128 pricePaid, uint24 color, uint8 team)',
  'event Withdraw(address to, uint256 amount)',
];

// Hardhat local accounts (for development)
export const HARDHAT_ACCOUNTS = [
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    name: 'Account #0 (Deployer)',
  },
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    name: 'Account #1 (Alice)',
  },
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    name: 'Account #2 (Bob)',
  },
  {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    name: 'Account #3 (Charlie)',
  },
  {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
    name: 'Account #4 (Diana)',
  },
];

export type WalletType = 'metamask' | 'hardhat-local';

export interface WalletConnection {
  address: string;
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider;
  signer: ethers.JsonRpcSigner;
  chainId: number;
  type: WalletType;
}

// MetaMask connection
export async function connectMetaMask(): Promise<WalletConnection> {
  const provider = await detectEthereumProvider();
  
  if (!provider) {
    throw new Error('MetaMask not found. Please install MetaMask.');
  }

  const ethereum = provider as any;
  
  // Request account access
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found. Please connect your MetaMask wallet.');
  }

  const browserProvider = new ethers.BrowserProvider(ethereum);
  const signer = await browserProvider.getSigner();
  const network = await browserProvider.getNetwork();

  return {
    address: accounts[0],
    provider: browserProvider,
    signer,
    chainId: Number(network.chainId),
    type: 'metamask',
  };
}

// Hardhat local connection
export async function connectHardhatLocal(accountIndex: number = 0): Promise<WalletConnection> {
  if (accountIndex >= HARDHAT_ACCOUNTS.length) {
    throw new Error(`Account index ${accountIndex} is out of range. Available accounts: 0-${HARDHAT_ACCOUNTS.length - 1}`);
  }

  const account = HARDHAT_ACCOUNTS[accountIndex];
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  
  try {
    // Test connection
    await provider.getBlockNumber();
  } catch (error) {
    throw new Error('Cannot connect to Hardhat local network. Make sure it\'s running on http://127.0.0.1:8545');
  }

  const wallet = new ethers.Wallet(account.privateKey, provider);

  return {
    address: account.address,
    provider,
    signer: wallet,
    chainId: 31337,
    type: 'hardhat-local',
  };
}

// Add Hardhat network to MetaMask
export async function addHardhatNetworkToMetaMask(): Promise<void> {
  const provider = await detectEthereumProvider();
  
  if (!provider) {
    throw new Error('MetaMask not found');
  }

  const ethereum = provider as any;

  try {
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [NETWORKS.hardhat],
    });
  } catch (error: any) {
    if (error.code === 4902) {
      throw new Error('Failed to add Hardhat network to MetaMask');
    }
    throw error;
  }
}

// Switch to a specific network in MetaMask
export async function switchNetwork(chainId: string): Promise<void> {
  const provider = await detectEthereumProvider();
  
  if (!provider) {
    throw new Error('MetaMask not found');
  }

  const ethereum = provider as any;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  } catch (error: any) {
    if (error.code === 4902) {
      // Network not added, try to add it
      const networkConfig = Object.values(NETWORKS).find(n => n.chainId === chainId);
      if (networkConfig) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [networkConfig],
        });
      }
    }
    throw error;
  }
}

// Get PixelCanvas contract instance
export function getPixelCanvasContract(connection: WalletConnection): ethers.Contract {
  const contractAddress = CONTRACT_ADDRESSES[connection.chainId as keyof typeof CONTRACT_ADDRESSES];
  
  if (!contractAddress) {
    throw new Error(`PixelCanvas contract not deployed on network ${connection.chainId}`);
  }

  return new ethers.Contract(contractAddress, PIXEL_CANVAS_ABI, connection.signer);
}

// Utility functions for encoding pixel data
export function encodeIdsLE(ids: number[]): string {
  const buffer = new ArrayBuffer(ids.length * 4);
  const view = new DataView(buffer);
  
  for (let i = 0; i < ids.length; i++) {
    view.setUint32(i * 4, ids[i], true); // true for little-endian
  }
  
  return '0x' + Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function encodeColors24(colors: number[]): string {
  const buffer = new ArrayBuffer(colors.length * 3);
  const view = new DataView(buffer);
  
  for (let i = 0; i < colors.length; i++) {
    const color = colors[i];
    view.setUint8(i * 3, (color >> 16) & 0xFF);     // R
    view.setUint8(i * 3 + 1, (color >> 8) & 0xFF); // G
    view.setUint8(i * 3 + 2, color & 0xFF);        // B
  }
  
  return '0x' + Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function encodeTeamBits(teams: number[]): string {
  const numBytes = Math.ceil(teams.length / 8);
  const buffer = new Uint8Array(numBytes);
  
  for (let i = 0; i < teams.length; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitIndex = i % 8;
    if (teams[i] === 1) {
      buffer[byteIndex] |= (1 << bitIndex);
    }
  }
  
  return '0x' + Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Utility to format Wei to ETH
export function formatEther(wei: bigint): string {
  return ethers.formatEther(wei);
}

// Utility to parse ETH to Wei
export function parseEther(eth: string): bigint {
  return ethers.parseEther(eth);
}

// Get provider from wallet connection
export function getProvider(connection: WalletConnection): ethers.BrowserProvider | ethers.JsonRpcProvider {
  return connection.provider;
}
