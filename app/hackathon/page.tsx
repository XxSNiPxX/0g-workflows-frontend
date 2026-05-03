"use client";
import { useState, useEffect } from "react";
import { ExternalLink, Copy, Check, Loader2 } from "lucide-react";
import MeshBackground from "@/components/MeshBackground";
import Nav from "@/components/Nav";
import { useWallet } from "@/context/WalletContext";
import { CONTRACTS, ABIs } from "@/lib/contracts";
import { Contract, JsonRpcProvider, formatEther } from "ethers";

const EXPLORER = "https://chainscan-galileo.0g.ai";
const READ_RPC = "https://evmrpc-testnet.0g.ai/";

function explorerAddr(addr: string) {
  return `${EXPLORER}/address/${addr}`;
}

function AddrRow({
  label,
  sublabel,
  address,
  note,
}: {
  label: string;
  sublabel?: string;
  address: string;
  note?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-start justify-between py-3.5 border-b border-black/[0.05] last:border-0 gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        {sublabel && (
          <div className="text-[11px] text-neutral-500 mt-0.5">{sublabel}</div>
        )}
        {note && (
          <div className="text-[11px] text-neutral-400 mt-0.5 italic">
            {note}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="font-mono text-[11px] text-neutral-500 hidden sm:block">
          {address.slice(0, 10)}…{address.slice(-6)}
        </span>
        <button
          onClick={copy}
          title="Copy"
          className="p-1.5 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
        >
          {copied ? (
            <Check size={12} className="text-emerald-600" />
          ) : (
            <Copy size={12} />
          )}
        </button>
        <a
          href={explorerAddr(address)}
          target="_blank"
          rel="noopener noreferrer"
          title="View on explorer"
          className="p-1.5 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
        >
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

function Card({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string | number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl bg-white border border-black/[0.06]"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/[0.06] bg-neutral-50/70">
        <span className="text-[11px] uppercase tracking-widest text-neutral-500 font-medium">
          {title}
        </span>
        {badge !== undefined && (
          <span className="font-mono text-[10px] bg-black text-white rounded-full px-2 py-0.5">
            {badge}
          </span>
        )}
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

function KV({ k, v, link }: { k: string; v: string; link?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-black/[0.05] last:border-0 gap-4">
      <span className="text-[13px] font-medium">{k}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] text-neutral-600 hover:text-black flex items-center gap-1"
        >
          {v} <ExternalLink size={10} />
        </a>
      ) : (
        <span className="font-mono text-[11px] text-neutral-600">{v}</span>
      )}
    </div>
  );
}

export default function HackathonPage() {
  const { address } = useWallet();
  const readProvider = new JsonRpcProvider(READ_RPC);

  const [agents, setAgents] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Load all agents from registry
      try {
        const registry = new Contract(
          CONTRACTS.agentRegistry,
          ABIs.agentRegistry,
          readProvider,
        );
        const nextId = Number(await registry.nextAgentId());
        const loaded: any[] = [];
        for (let i = 1; i < nextId; i++) {
          try {
            const a = await registry.getAgent(i);
            loaded.push({
              id: Number(a.agentId),
              name: a.name || `Agent #${i}`,
              address: a.agentAddress as string,
              creator: a.creator as string,
              costPerReq: formatEther(a.costPerRequest ?? 0n),
              active: Boolean(a.active),
              ready: Boolean(a.workflowReady),
            });
          } catch {
            /* skip */
          }
        }
        setAgents(loaded);
      } catch {
        /* ok */
      }

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!address) {
      setWorkflows([]);
      return;
    }
    (async () => {
      try {
        const factory = new Contract(
          CONTRACTS.workflowFactory,
          ABIs.workflowFactory,
          readProvider,
        );
        const addrs: string[] = await factory.getUserWorkflows(address);
        setWorkflows(addrs);
      } catch {
        /* ok */
      }
    })();
  }, [address]);

  return (
    <div className="min-h-screen bg-white text-black">
      <MeshBackground />
      <Nav />
      <main className="max-w-[1400px] mx-auto px-8 pt-12 pb-24">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
          0G Hackathon
        </div>
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <h1 className="font-serif text-[52px] tracking-tight leading-none">
            Contracts
          </h1>
          <a
            href={EXPLORER}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/[0.08] text-[12px] text-neutral-600 hover:text-black hover:border-black/20 transition-colors mb-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Galileo Testnet Explorer
            <ExternalLink size={11} />
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Protocol Core */}
          <Card title="Protocol — Core Contracts">
            <AddrRow
              label="Agent Registry"
              sublabel="Indexes all AI agents on-chain"
              address={CONTRACTS.agentRegistry}
            />
            <AddrRow
              label="Workflow Factory"
              sublabel="Deploys WorkflowInstance contracts"
              address={CONTRACTS.workflowFactory}
            />
            <AddrRow
              label="iNFT"
              sublabel="Identity NFT — ERC-721 wallet key for AI access control"
              address={CONTRACTS.inft}
            />
            <AddrRow
              label="Workflow Registry"
              sublabel="Global index of all deployed workflows"
              address={CONTRACTS.workflowRegistry}
            />
          </Card>

          {/* Network */}
          <Card title="Network">
            <KV k="Chain" v="0G Galileo Testnet" />
            <KV k="Chain ID" v="16602" />
            <KV
              k="RPC"
              v="evmrpc-testnet.0g.ai"
              link="https://evmrpc-testnet.0g.ai/"
            />
            <KV k="Explorer" v="chainscan-galileo.0g.ai" link={EXPLORER} />
            <KV
              k="Storage Indexer"
              v="indexer-storage-testnet-turbo.0g.ai"
              link="https://indexer-storage-testnet-turbo.0g.ai"
            />
            <KV
              k="Helius (Solana RPC)"
              v="mainnet.helius-rpc.com"
              link="https://mainnet.helius-rpc.com"
            />
          </Card>

          {/* Agents */}
          <Card title="Registered Agents" badge={loading ? "…" : agents.length}>
            {loading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-[13px] text-neutral-400">
                <Loader2 size={14} className="animate-spin" /> Loading from
                AgentRegistry…
              </div>
            ) : agents.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-neutral-400">
                No agents found
              </div>
            ) : (
              agents.map((a) => (
                <AddrRow
                  key={a.id}
                  label={a.name}
                  sublabel={`Agent #${a.id} · Diamond proxy · ${a.costPerReq} 0G / request`}
                  note={`Creator: ${a.creator.slice(0, 10)}…${a.creator.slice(-6)} · ${a.active ? "✓ active" : "✗ inactive"} · ${a.ready ? "workflow-ready" : "not ready"}`}
                  address={a.address}
                />
              ))
            )}
          </Card>

          {/* User Workflows */}
          <Card
            title="Your Deployed Workflows"
            badge={!address ? "—" : workflows.length}
          >
            {!address ? (
              <div className="py-8 text-center text-[13px] text-neutral-400">
                Connect wallet to see your deployed workflows
              </div>
            ) : workflows.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-neutral-400">
                No workflows deployed yet
              </div>
            ) : (
              workflows.map((addr, i) => (
                <AddrRow
                  key={addr}
                  label={`Workflow ${addr.slice(0, 6)}`}
                  sublabel={`WorkflowInstance · deployed by ${address?.slice(0, 8)}…`}
                  address={addr}
                />
              ))
            )}
          </Card>
        </div>

        {/* Architecture */}
        <div className="mt-6 rounded-2xl border border-black/[0.06] bg-neutral-50/60 p-6">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-4">
            Architecture
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[13px] text-neutral-600 leading-relaxed">
            <div>
              <div className="font-semibold text-black mb-1.5">
                Agent Diamonds
              </div>
              Each agent is an EIP-2535 Diamond proxy. The
              <code className="font-mono text-[11px] bg-neutral-200 px-1 rounded mx-1">
                AgentExecutionFacet
              </code>
              handles request/complete lifecycle. Workers poll
              <code className="font-mono text-[11px] bg-neutral-200 px-1 rounded mx-1">
                getPendingRequests()
              </code>
              and resolve input pointers via
              <code className="font-mono text-[11px] bg-neutral-200 px-1 rounded mx-1">
                StepRequested
              </code>
              event logs.
            </div>
            <div>
              <div className="font-semibold text-black mb-1.5">
                Workflow Pipeline
              </div>
              Each workflow is an immutable
              <code className="font-mono text-[11px] bg-neutral-200 px-1 rounded mx-1">
                WorkflowInstance
              </code>
              with a fixed agent sequence. Funds are escrowed in
              <code className="font-mono text-[11px] bg-neutral-200 px-1 rounded mx-1">
                ProtocolTreasury
              </code>
              and released per-step as agents call
              <code className="font-mono text-[11px] bg-neutral-200 px-1 rounded mx-1">
                complete()
              </code>
              .
            </div>
            <div>
              <div className="font-semibold text-black mb-1.5">Data Layer</div>
              Inputs/outputs are referenced by
              <code className="font-mono text-[11px] bg-neutral-200 px-1 rounded mx-1">
                bytes32
              </code>
              keccak256 content pointers. Data lives in 0G decentralised
              storage. Agents 1+2 fetch live Solana wallet data via Helius and
              generate LaTeX PDF reports.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
