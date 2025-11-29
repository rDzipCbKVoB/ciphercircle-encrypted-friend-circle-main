import {
  createInstance,
  initSDK,
  SepoliaConfig,
  type FheInstance,
} from "@zama-fhe/relayer-sdk/web";
import { BrowserProvider, Contract, getAddress, parseEther } from "ethers";

let fheInstance: FheInstance | null = null;
let initPromise: Promise<FheInstance> | null = null;

export async function initializeFHE(): Promise<FheInstance> {
  if (fheInstance) return fheInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log("Initializing FHE SDK...");
      await initSDK();
      console.log("SDK initialized, creating instance with SepoliaConfig...");
      
      // Use the SDK-provided Sepolia configuration preset
      const instance = await createInstance(SepoliaConfig);
      console.log("FHE instance created successfully");
      fheInstance = instance;
      return instance;
    } catch (error: any) {
      console.error("FHE initialization error details:", {
        message: error.message,
        error: error.toString(),
        stack: error.stack,
      });
      throw new Error(`Failed to initialize FHE: ${error.message || error}`);
    }
  })();

  return initPromise;
}

export type EncryptUintType = "uint8" | "uint16" | "uint32" | "uint64";

export interface EncryptedValue {
  handle: string;
  proof: string;
}

export async function encryptValueForContract(params: {
  value: number | bigint;
  type: EncryptUintType;
  contractAddress: string;
  userAddress: string;
}): Promise<EncryptedValue> {
  const { value, type, contractAddress, userAddress } = params;

  const fhe = await initializeFHE();
  const contractAddr = getAddress(contractAddress) as `0x${string}`;

  const input = fhe.createEncryptedInput(contractAddr, userAddress);

  switch (type) {
    case "uint8":
      input.add8(Number(value));
      break;
    case "uint16":
      input.add16(Number(value));
      break;
    case "uint32":
      input.add32(Number(value));
      break;
    case "uint64":
      input.add64(BigInt(value));
      break;
    default:
      throw new Error("Unsupported encrypt type");
  }

  const { handles, inputProof } = await input.encrypt();

  return {
    handle: handles[0],
    proof: inputProof,
  };
}

export async function connectWalletWithContract<T extends Contract = Contract>(
  contractAddress: string,
  abi: any[],
): Promise<{ provider: BrowserProvider; signer: any; contract: T; userAddress: string }> {
  if (!(window as any).ethereum) {
    throw new Error("Wallet not detected. Please install MetaMask or a compatible wallet.");
  }

  const provider = new BrowserProvider((window as any).ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  const contract = new Contract(contractAddress, abi, signer) as T;

  return {
    provider,
    signer,
    contract,
    userAddress,
  };
}

export async function encryptEthAmountForContract(params: {
  amountEth: string;
  contractAddress: string;
  userAddress: string;
}): Promise<EncryptedValue> {
  const amountWei = parseEther(params.amountEth || "0");
  return encryptValueForContract({
    value: amountWei,
    type: "uint64",
    contractAddress: params.contractAddress,
    userAddress: params.userAddress,
  });
}


