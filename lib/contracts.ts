import {
  Contract,
  JsonRpcProvider,
  formatEther,
  keccak256,
  toUtf8Bytes,
} from "ethers";

/* ── Network ───────────────────────────────────────── */
export const GALILEO_CHAINID = 16602;
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://evmrpc-testnet.0g.ai/";

/* ── Addresses (UPDATED) ───────────────────────────── */
export const CONTRACTS = {
  agentRegistry: "0x81b2eD520FbE9282Cba226fDBCD0FddD37EB0637",
  workflowFactory: "0x8eD4f182897f2Ee6883310cF5AA6Be53fF5E0bEd",
  inft: "0xA3C32446ca641eEa625D4027E3582b671ae6d746",
  workflowRegistry: "0x0Bf5A41f2F92A8CBDacCfb88dd69A67e7eE64917",
} as const;

/* ── ABIs ─────────────────────────────────────────── */
export const ABIs = {
  agentRegistry: [
    "function nextAgentId() view returns (uint256)",
    "function getAgent(uint256) view returns (tuple(uint256 agentId, address agentAddress, address creator, address admin, address payoutAddress, bytes32[] inputTypes, bytes32 outputType, uint256 costPerRequest, bool workflowReady, bool active, uint64 createdAt, uint64 updatedAt, string name, string description, bytes32 manifestHash))",
  ],
  workflowFactory: [
    "function createWorkflow((address agent, bytes32 inputType, bytes32 outputType)[] steps, string, string, address) returns (address)",
    "function getUserWorkflows(address) view returns (address[])",
  ],
  workflow: [
    "function totalCost() view returns (uint256)",
    "function nextRunId() view returns (uint256)",
    "function start(uint256, bytes32) payable",
    "function getRun(uint256) view returns (tuple(address user, uint256 tokenId, uint256 currentStepIndex, bytes32 currentInputPointer, bytes32 currentInputType, uint8 status))",
    "function getStepKey(uint256, uint256) view returns (bytes32)",
    "function getStepCount() view returns (uint256)",
    "function getUserRuns(address) view returns (uint256[])",
    "function getStep(uint256) view returns (tuple(address agent, bytes32 inputType, bytes32 outputType, uint256 cost, address payoutAddress))",
  ],
  inft: [
    "function tokenIdOf(address) view returns (uint256)",
    "function mint(address, bytes32, bytes, string) returns (uint256)",
    "function authorizeUsage(uint256, address, bytes)",
  ],
} as const;

/* ── Provider ─────────────────────────────────────── */
let _provider: JsonRpcProvider | null = null;
export function getProvider() {
  if (!_provider) _provider = new JsonRpcProvider(RPC_URL);
  return _provider;
}

/* ── Contract factories ───────────────────────────── */
export const getAgentRegistryContract = (p = getProvider()) =>
  new Contract(CONTRACTS.agentRegistry, ABIs.agentRegistry, p);

export const getWorkflowFactoryContract = (p = getProvider()) =>
  new Contract(CONTRACTS.workflowFactory, ABIs.workflowFactory, p);

export const getWorkflowContract = (addr: string, p = getProvider()) =>
  new Contract(addr, ABIs.workflow, p);

export const getINFTContract = (p = getProvider()) =>
  new Contract(CONTRACTS.inft, ABIs.inft, p);

/* ── TYPE SYSTEM (FIXED) ─────────────────────────── */
export function typeToBytes32(type: string): string {
  return keccak256(toUtf8Bytes(type));
}

const TYPE_MAP: Record<string, string> = {
  [typeToBytes32("wallet_address")]: "wallet_address",
  [typeToBytes32("wallet_analysis")]: "wallet_analysis",
  [typeToBytes32("pdf_report")]: "pdf_report",
};

function resolveType(hash: any): string {
  if (typeof hash !== "string" || !hash.startsWith("0x")) return "";
  return TYPE_MAP[hash] ?? hash.slice(0, 10);
}

/* ── Mappers ─────────────────────────────────────── */
export function mapAgent(raw: any, fallbackId: number) {
  return {
    id: Number(raw.agentId ?? fallbackId),
    name: raw.name || `Agent #${fallbackId}`,
    description: raw.description || "",
    address: raw.agentAddress as string,
    creator: raw.creator as string,
    inputTypes: (raw.inputTypes ?? []).map(resolveType),
    outputType: resolveType(raw.outputType),
    costPerRequest: formatEther(raw.costPerRequest ?? 0n),
    workflowReady: Boolean(raw.workflowReady),
    active: Boolean(raw.active),
  };
}

export function mapRun(raw: any, id: number | string) {
  return {
    id: String(id),
    user: raw.user as string,
    tokenId: raw.tokenId.toString() as string,
    currentStepIndex: Number(raw.currentStepIndex),
    currentInputPointer: raw.currentInputPointer as string,
    currentInputType: resolveType(raw.currentInputType),
    status: (Number(raw.status) === 2 ? "done" : "active") as "done" | "active",
  };
}
