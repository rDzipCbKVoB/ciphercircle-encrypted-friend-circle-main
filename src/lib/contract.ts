import { Contract, BrowserProvider, id } from "ethers";

export const DEFAULT_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS;

// CipherCircle contract ABI (only the functions we use)
// Note: externalEuint32/externalEuint64 are encoded as bytes32
export const CipherCircleABI = [
  "function createPost(uint256 postId) external",
  "function like(uint256 postId, bytes32 encryptedOne, bytes calldata inputProof) external",
  "function tip(uint256 postId, bytes32 encryptedAmount, bytes calldata inputProof) external",
  "function getEncryptedStats(uint256 postId) external view returns (bytes32, bytes32)",
  "function authorOf(uint256 postId) external view returns (address)",
  "function grantStatsAccess(uint256 postId, address viewer) external",
  "event PostCreated(uint256 indexed postId, address indexed author)",
  "event Liked(uint256 indexed postId, address indexed from)",
  "event Tipped(uint256 indexed postId, address indexed from)",
] as const;

// Sepolia network chain ID
const SEPOLIA_CHAIN_ID = 11155111n;

export async function checkNetwork(provider: BrowserProvider): Promise<void> {
  const network = await provider.getNetwork();
  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Wrong network detected. Current chain ID: ${network.chainId}, expected Sepolia (${SEPOLIA_CHAIN_ID}). Please switch your wallet to Sepolia.`
    );
  }
}

export async function verifyContract(provider: BrowserProvider, contractAddress: string): Promise<void> {
  const code = await provider.getCode(contractAddress);
  if (!code || code === "0x") {
    throw new Error(
      `No contract code found at ${contractAddress}. Ensure the contract is deployed, the address is correct, and you're on Sepolia.`
    );
  }
  console.log("✓ Contract code exists at address:", contractAddress);
}

export async function getCipherCircleContract(contractAddress: string) {
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error("Wallet not detected. Please install MetaMask or a compatible wallet extension.");
  }

  const provider = new BrowserProvider(ethereum);
  await provider.send("eth_requestAccounts", []);
  
  await checkNetwork(provider);
  
  await verifyContract(provider, contractAddress);
  
  const signer = await provider.getSigner();

  return new Contract(contractAddress, CipherCircleABI, signer);
}

export function generatePostId(text: string, ipfsHash?: string): bigint {
  const content = `${text}${ipfsHash || ""}${Date.now()}`;
  const hash = id(content);
  // Take the first 16 bytes as postId to avoid uint256 overflow
  return BigInt(hash.slice(0, 34)); // 0x + 32 hex chars = 16 bytes
}

