"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Copy,
  Check,
  Loader2,
  ArrowRight,
  AlertCircle,
  Box,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
} from "lucide-react";
import MeshBackground from "@/components/MeshBackground";
import Nav from "@/components/Nav";
import { useWallet } from "@/context/WalletContext";
import { CONTRACTS, ABIs, GALILEO_CHAINID } from "@/lib/contracts";
import {
  Contract,
  JsonRpcProvider,
  formatEther,
  AbiCoder,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import type { WorkflowMeta, RunMeta } from "@/lib/types";

const READ_RPC = "https://evmrpc-testnet.0g.ai/";
const readProvider = new JsonRpcProvider(READ_RPC);
const ZERO_BYTES32 = "0x" + "0".repeat(64);

function useSession<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(fallback);
  useEffect(() => {
    try {
      const s = sessionStorage.getItem(key);
      if (s) setVal(JSON.parse(s));
    } catch {
      /* ok */
    }
  }, [key]);
  const set = (v: T) => {
    setVal(v);
    sessionStorage.setItem(key, JSON.stringify(v));
  };
  return [val, set];
}

function encodePermission() {
  const expiry = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  return AbiCoder.defaultAbiCoder().encode(
    ["tuple(bool,bool,bool,bytes32[],uint256[],uint64)"],
    [[true, true, true, [], [], expiry]],
  );
}

// ── Run card ──────────────────────────────────────────────────────────────────
function RunCard({
  run,
  copied,
  onCopy,
}: {
  run: RunMeta;
  copied: string | null;
  onCopy: (t: string, k: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [outputPointer, setOutputPointer] = useState<string | null>(null);
  const [outputType, setOutputType] = useState<"json" | "pdf" | null>(null);
  const [outputData, setOutputData] = useState<string | null>(null);
  const [outputLoading, setOutputLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDone = run.status === "done";

  useEffect(() => {
    if (!isDone) return;
    let attempts = 0;

    const poll = async () => {
      attempts++;
      if (attempts > 40) {
        setOutputLoading(false);
        clearInterval(pollRef.current!);
        return;
      }

      try {
        // Get output pointer from the run API
        const res = await fetch(
          `/api/runs/${run.id}?workflow=${run.workflowAddress}`,
        );
        const json = await res.json();
        const ptr = json.outputPointer as string | null;
        if (!ptr) return;

        setOutputPointer(ptr);

        // Fetch the actual data
        const dataRes = await fetch(
          `/api/og/get?pointer=${encodeURIComponent(ptr)}`,
        );
        const dataJson = await dataRes.json();
        if (dataJson?.data) {
          setOutputType(dataJson.type ?? "json");
          setOutputData(dataJson.data);
        }

        setOutputLoading(false);
        clearInterval(pollRef.current!);
      } catch {
        /* keep trying */
      }
    };

    setOutputLoading(true);
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isDone, run.id, run.workflowAddress]);

  return (
    <div
      className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[11px] text-neutral-400 flex-shrink-0">
            #{run.id}
          </span>
          <span className="text-[13px] font-medium truncate">
            {run.workflowLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {isDone ? (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
              complete
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">
              <Loader2 size={10} className="animate-spin" />
              step {run.currentStep + 1}/{run.steps.length || "?"}
            </span>
          )}
          {run.steps.length > 0 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-neutral-400 hover:text-black"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Step strip */}
      {run.steps.length > 0 && expanded && (
        <div className="flex gap-1 px-5 pb-3">
          {run.steps.map((step, i) => {
            const done = i < run.currentStep || isDone;
            const active = i === run.currentStep && !isDone;
            return (
              <div key={i} className="flex-1 min-w-0">
                <div
                  className={`h-1 rounded-full ${done ? "bg-black" : active ? "bg-neutral-400 animate-pulse" : "bg-neutral-100"}`}
                />
                <div className="mt-1 text-[10px] truncate text-neutral-500">
                  {step.name}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Output section */}
      {isDone ? (
        <div className="mx-5 mb-4 space-y-2">
          {outputPointer ? (
            <>
              {/* Output pointer */}
              <div className="rounded-xl bg-neutral-50 border border-black/[0.06] p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                    <FileText size={10} /> Output pointer
                  </span>
                  <button
                    onClick={() => onCopy(outputPointer, `ptr-${run.id}`)}
                    className="flex items-center gap-1 text-[10px] text-neutral-600 hover:text-black"
                  >
                    {copied === `ptr-${run.id}` ? (
                      <>
                        <Check size={10} className="text-emerald-600" /> copied
                      </>
                    ) : (
                      <>
                        <Copy size={10} /> copy
                      </>
                    )}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-black break-all">
                  {outputPointer}
                </div>
              </div>

              {/* Download + preview */}
              {outputType === "pdf" ? (
                <div className="rounded-xl bg-black text-white p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium mb-0.5">
                      Wallet Report
                    </div>
                    <div className="text-[10px] text-white/50">
                      LaTeX-generated PDF
                    </div>
                  </div>
                  <a
                    href={`/api/og/get?pointer=${encodeURIComponent(outputPointer)}&download=1`}
                    download="wallet-report.pdf"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white text-black text-[11px] font-medium hover:bg-neutral-100 transition-colors"
                  >
                    <Download size={12} /> Download PDF
                  </a>
                </div>
              ) : outputData ? (
                <div className="rounded-xl bg-neutral-950 text-white p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-white/50">
                      Wallet Data
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onCopy(outputData, `data-${run.id}`)}
                        className="flex items-center gap-1 text-[10px] text-white/60 hover:text-white"
                      >
                        {copied === `data-${run.id}` ? (
                          <>
                            <Check size={10} /> copied
                          </>
                        ) : (
                          <>
                            <Copy size={10} /> copy
                          </>
                        )}
                      </button>
                      <a
                        href={`/api/og/get?pointer=${encodeURIComponent(outputPointer)}&download=1`}
                        download="wallet-data.json"
                        className="flex items-center gap-1 text-[10px] text-white/60 hover:text-white"
                      >
                        <Download size={10} /> download
                      </a>
                    </div>
                  </div>
                  <pre className="font-mono text-[11px] text-white/90 whitespace-pre-wrap break-all max-h-48 overflow-y-auto leading-relaxed">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(outputData), null, 2);
                      } catch {
                        return outputData;
                      }
                    })()}
                  </pre>
                </div>
              ) : outputLoading ? (
                <div className="rounded-xl bg-neutral-50 border border-dashed border-black/10 p-3 flex items-center gap-2 text-[11px] text-neutral-500">
                  <Loader2 size={11} className="animate-spin flex-shrink-0" />{" "}
                  Fetching output data…
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl bg-neutral-50 border border-dashed border-black/10 p-3 flex items-center gap-2 text-[11px] text-neutral-500">
              <Loader2 size={11} className="animate-spin flex-shrink-0" />
              {outputLoading
                ? "Waiting for worker to process…"
                : "No output available"}
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 pb-4 text-[11px] text-neutral-400 font-mono">
          input → {run.inputPreview}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RunsPage() {
  const router = useRouter();
  const { address, provider, chainId, connect } = useWallet();

  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([]);
  const [wfLoading, setWfLoading] = useState(false);
  const [runs, setRuns] = useSession<RunMeta[]>("myRuns", []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const pollRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const wf = workflows.find((w) => w.id === selectedId) ?? workflows[0] ?? null;
  useEffect(() => {
    if (workflows.length && !selectedId) setSelectedId(workflows[0].id);
  }, [workflows]);

  // Load workflows
  useEffect(() => {
    if (!address) return;
    setWfLoading(true);
    (async () => {
      const factory = new Contract(
        CONTRACTS.workflowFactory,
        ABIs.workflowFactory,
        readProvider,
      );
      let addresses: string[] = [];
      try {
        addresses = await factory.getUserWorkflows(address);
      } catch {
        setWfLoading(false);
        return;
      }
      const valid: WorkflowMeta[] = [];
      for (const addr of addresses) {
        try {
          if ((await readProvider.getCode(addr)) === "0x") continue;
          const c = new Contract(addr, ABIs.workflow, readProvider);
          await c.nextRunId();
          let totalCost = "0";
          try {
            totalCost = formatEther(await c.totalCost());
          } catch {
            /* ok */
          }
          valid.push({
            id: addr,
            address: addr,
            label: `Workflow ${addr.slice(0, 6)}`,
            steps: [],
            totalCost,
            createdAt: 0,
          });
        } catch {
          /* skip */
        }
      }
      setWorkflows(valid);
      setWfLoading(false);
    })();
  }, [address]);

  // Load runs from chain
  useEffect(() => {
    if (!address || !workflows.length) return;
    (async () => {
      const all: RunMeta[] = [];
      for (const wf of workflows) {
        const c = new Contract(wf.address, ABIs.workflow, readProvider);
        let ids: bigint[] = [];
        try {
          ids = await c.getUserRuns(address);
        } catch {
          continue;
        }
        for (const id of ids) {
          try {
            const r = await c.getRun(id);
            all.push({
              id: id.toString(),
              workflowAddress: wf.address,
              workflowLabel: wf.label,
              steps: [],
              currentStep: Number(r.currentStepIndex),
              status: Number(r.status) === 2 ? "done" : "running",
              inputPreview: "(on-chain)",
              cost: 0,
              finalPointer: null,
              startedAt: 0,
            });
          } catch {
            /* skip */
          }
        }
      }
      setRuns((prev) => {
        const ids = new Set(all.map((r) => `${r.workflowAddress}-${r.id}`));
        return [
          ...all,
          ...prev.filter((r) => !ids.has(`${r.workflowAddress}-${r.id}`)),
        ];
      });
    })();
  }, [address, workflows]);

  // Poll running runs
  const pollRun = async (run: RunMeta) => {
    try {
      const res = await fetch(
        `/api/runs/${run.id}?workflow=${run.workflowAddress}`,
      );
      const data = await res.json();
      if (!data.success) return;
      setRuns((prev) =>
        prev.map((x) => {
          if (x.workflowAddress !== run.workflowAddress || x.id !== run.id)
            return x;
          if (data.run.status === "done") {
            clearInterval(pollRef.current[run.id]);
            delete pollRef.current[run.id];
            return {
              ...x,
              currentStep: data.run.currentStepIndex,
              status: "done" as const,
            };
          }
          return { ...x, currentStep: data.run.currentStepIndex };
        }),
      );
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    runs
      .filter((r) => r.status === "running")
      .forEach((r) => {
        if (pollRef.current[r.id]) return;
        pollRef.current[r.id] = setInterval(() => pollRun(r), 3000);
      });
    return () => Object.values(pollRef.current).forEach(clearInterval);
  }, []); // eslint-disable-line

  // Start run
  const handleStart = async () => {
    if (!address) {
      connect();
      return;
    }
    if (chainId !== GALILEO_CHAINID) {
      alert("Switch to 0G Galileo Testnet");
      return;
    }
    if (!wf || !input.trim()) return;

    setStarting(true);
    setStartError(null);
    try {
      const signer = await provider!.getSigner();
      const inft = new Contract(CONTRACTS.inft, ABIs.inft, signer);
      const wfContract = new Contract(wf.address, ABIs.workflow, signer);

      if ((await provider!.getCode(wf.address)) === "0x")
        throw new Error("Workflow not deployed");

      // Store the wallet address as input
      const ogRes = await fetch("/api/og/put", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: input.trim(),
          type: "text",
          filename: "input.txt",
        }),
      });
      const ogJson = await ogRes.json();
      if (!ogRes.ok || !ogJson.pointer)
        throw new Error(ogJson.error || "Storage write failed");

      const inputPointer = ogJson.pointer as string;
      // Consistency check
      if (
        keccak256(toUtf8Bytes(input.trim())).toLowerCase() !==
        inputPointer.toLowerCase()
      )
        throw new Error("Pointer mismatch — aborting");

      const cost = await wfContract.totalCost();
      let tokenId = await inft.tokenIdOf(address);
      if (tokenId === 0n) {
        await (
          await inft.mint(address, ZERO_BYTES32, "0x6b6579", "ipfs://dummy")
        ).wait();
        tokenId = await inft.tokenIdOf(address);
      }
      await (
        await inft.authorizeUsage(tokenId, wf.address, encodePermission())
      ).wait();

      const startTx = await wfContract.start(tokenId, inputPointer, {
        value: cost,
      });
      await startTx.wait();

      const nextId = await wfContract.nextRunId();
      let runId: string | null = null;
      for (let i = Number(nextId); i >= Math.max(1, Number(nextId) - 20); i--) {
        const c = await wfContract.getRun(i);
        if (
          c.currentInputPointer.toLowerCase() === inputPointer.toLowerCase()
        ) {
          runId = String(i);
          break;
        }
      }
      if (!runId) throw new Error("Run ID resolution failed");

      const newRun: RunMeta = {
        id: runId,
        workflowAddress: wf.address,
        workflowLabel: wf.label,
        steps: wf.steps,
        currentStep: 0,
        status: "running",
        inputPreview: input.slice(0, 20) + (input.length > 20 ? "…" : ""),
        cost: Number(cost) / 1e18,
        finalPointer: null,
        startedAt: Date.now(),
      };
      setRuns((prev) =>
        prev.some(
          (r) =>
            r.workflowAddress === newRun.workflowAddress && r.id === newRun.id,
        )
          ? prev
          : [newRun, ...prev],
      );
      setInput("");
      pollRef.current[runId] = setInterval(() => pollRun(newRun), 3000);
    } catch (e: any) {
      console.error("START FAILED:", e);
      setStartError(e?.reason ?? e?.message ?? "Transaction failed");
    } finally {
      setStarting(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  // ── Loading / empty states ─────────────────────────────────────────────────
  if (address && wfLoading)
    return (
      <div className="min-h-screen bg-white text-black">
        <MeshBackground />
        <Nav />
        <main className="max-w-[1400px] mx-auto px-8 pt-12 pb-24">
          <h1 className="font-serif text-[52px] tracking-tight leading-none mb-10">
            Runs
          </h1>
          <div className="rounded-3xl border border-dashed border-black/10 p-20 text-center">
            <Loader2
              size={28}
              className="animate-spin text-neutral-300 mx-auto mb-4"
            />
            <div className="text-[14px] text-neutral-500">
              Loading your workflows…
            </div>
          </div>
        </main>
      </div>
    );

  if (!address)
    return (
      <div className="min-h-screen bg-white text-black">
        <MeshBackground />
        <Nav />
        <main className="max-w-[1400px] mx-auto px-8 pt-12 pb-24">
          <h1 className="font-serif text-[52px] tracking-tight leading-none mb-10">
            Runs
          </h1>
          <div className="rounded-3xl border border-dashed border-black/15 p-20 text-center bg-white/60">
            <h2 className="font-serif text-[28px] tracking-tight mb-2">
              Connect your wallet
            </h2>
            <p className="text-[14px] text-neutral-500 max-w-sm mx-auto mb-8">
              Connect to load your deployed workflows.
            </p>
            <button
              onClick={connect}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black text-white text-[13px] font-medium hover:bg-neutral-800"
            >
              Connect wallet
            </button>
          </div>
        </main>
      </div>
    );

  if (!wfLoading && !workflows.length)
    return (
      <div className="min-h-screen bg-white text-black">
        <MeshBackground />
        <Nav />
        <main className="max-w-[1400px] mx-auto px-8 pt-12 pb-24">
          <h1 className="font-serif text-[52px] tracking-tight leading-none mb-10">
            Runs
          </h1>
          <div className="rounded-3xl border border-dashed border-black/15 p-20 text-center bg-white/60">
            <Box
              size={24}
              className="text-neutral-400 mx-auto mb-4"
              strokeWidth={1.5}
            />
            <h2 className="font-serif text-[28px] tracking-tight mb-2">
              No workflows yet
            </h2>
            <button
              onClick={() => router.push("/builder")}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black text-white text-[13px] font-medium hover:bg-neutral-800"
            >
              Open builder <ArrowRight size={14} />
            </button>
          </div>
        </main>
      </div>
    );

  return (
    <div className="min-h-screen bg-white text-black">
      <MeshBackground />
      <Nav />
      <main className="max-w-[1400px] mx-auto px-8 pt-12 pb-24">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
          Execute
        </div>
        <h1 className="font-serif text-[52px] tracking-tight leading-none mb-10">
          Runs
        </h1>

        <div className="grid grid-cols-12 gap-6">
          {/* Left */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="rounded-2xl bg-white border border-black/[0.06] p-5">
              <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-3">
                Workflow
              </div>
              <div className="space-y-2">
                {workflows.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedId(w.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === w.id ? "border-black bg-neutral-50" : "border-black/[0.06] hover:border-black/15"}`}
                  >
                    <div className="font-medium text-[13px] mb-1">
                      {w.label}
                    </div>
                    <div className="font-mono text-[10px] text-neutral-500 truncate">
                      {w.address}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1">
                      {w.totalCost} 0G / run
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {wf && (
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5">
                <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1">
                  Input
                </div>
                <p className="text-[11px] text-neutral-400 mb-3">
                  Solana wallet address
                </p>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g. 9WzD...Xk2F"
                  className="w-full bg-neutral-50 border border-black/[0.06] rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-black/25 font-mono"
                />
                {startError && (
                  <div className="mt-2 text-[11px] text-red-600 flex items-start gap-1.5">
                    <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                    {startError}
                  </div>
                )}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-[11px] text-neutral-500">
                    cost{" "}
                    <span className="font-mono text-neutral-800">
                      {wf.totalCost} 0G
                    </span>
                  </div>
                  <button
                    onClick={handleStart}
                    disabled={!input.trim() || starting}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium ${input.trim() && !starting ? "bg-black text-white hover:bg-neutral-800" : "bg-neutral-100 text-neutral-400 cursor-not-allowed"}`}
                  >
                    {starting ? (
                      <>
                        <Loader2 size={12} className="animate-spin" /> Starting…
                      </>
                    ) : (
                      <>
                        <Play size={12} /> Analyze wallet
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right */}
          <div className="col-span-12 lg:col-span-8">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[11px] uppercase tracking-widest text-neutral-500">
                {runs.length} run{runs.length !== 1 ? "s" : ""}
              </div>
              <div className="text-[11px] text-neutral-400">
                {runs.filter((r) => r.status === "done").length} complete
              </div>
            </div>
            {runs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 p-12 text-center text-[13px] text-neutral-500">
                Enter a Solana wallet address and click "Analyze wallet"
              </div>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <RunCard
                    key={`${run.workflowAddress}-${run.id}`}
                    run={run}
                    copied={copied}
                    onCopy={copy}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
