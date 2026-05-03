"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, ExternalLink } from "lucide-react";
import MeshBackground from "@/components/MeshBackground";
import Nav from "@/components/Nav";
import { useWallet } from "@/context/WalletContext";
import { CONTRACTS, ABIs } from "@/lib/contracts";
import { Contract, JsonRpcProvider, formatEther } from "ethers";

const READ_RPC = "https://evmrpc-testnet.0g.ai/";
const readProvider = new JsonRpcProvider(READ_RPC);

interface WfSummary {
  address: string;
  label: string;
  totalCost: string;
  runCount: number;
  doneCount: number;
}

interface RunSummary {
  id: string;
  workflowLabel: string;
  workflowAddress: string;
  status: "done" | "running";
  currentStep: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { address } = useWallet();

  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<WfSummary[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);

  useEffect(() => {
    if (!address) return;
    setLoading(true);

    (async () => {
      // 1. Get workflow addresses from factory
      const factory = new Contract(
        CONTRACTS.workflowFactory,
        ABIs.workflowFactory,
        readProvider,
      );
      let addresses: string[] = [];
      try {
        addresses = await factory.getUserWorkflows(address);
      } catch {
        /* ok */
      }

      const wfSummaries: WfSummary[] = [];
      const allRuns: RunSummary[] = [];

      for (const addr of addresses) {
        try {
          const c = new Contract(addr, ABIs.workflow, readProvider);

          // Validate
          const nextId = await c.nextRunId();
          let totalCost = "0";
          try {
            totalCost = formatEther(await c.totalCost());
          } catch {
            /* ok */
          }

          // Get user runs for this workflow
          let runIds: bigint[] = [];
          try {
            runIds = await c.getUserRuns(address);
          } catch {
            /* ok */
          }

          let doneCount = 0;
          for (const id of runIds) {
            try {
              const r = await c.getRun(id);
              const done = Number(r.status) === 2;
              if (done) doneCount++;
              allRuns.push({
                id: id.toString(),
                workflowLabel: `Workflow ${addr.slice(0, 6)}`,
                workflowAddress: addr,
                status: done ? "done" : "running",
                currentStep: Number(r.currentStepIndex),
              });
            } catch {
              /* skip */
            }
          }

          wfSummaries.push({
            address: addr,
            label: `Workflow ${addr.slice(0, 6)}`,
            totalCost,
            runCount: runIds.length,
            doneCount,
          });
        } catch {
          /* skip invalid */
        }
      }

      // Sort runs newest first (highest id = most recent)
      allRuns.sort((a, b) => Number(b.id) - Number(a.id));

      setWorkflows(wfSummaries);
      setRuns(allRuns);
      setLoading(false);
    })();
  }, [address]);

  const totalSpent = workflows.reduce(
    (s, w) => s + parseFloat(w.totalCost) * w.runCount,
    0,
  );
  const totalRuns = runs.length;
  const totalDone = runs.filter((r) => r.status === "done").length;

  const stats = [
    { k: "Workflows", v: loading ? "…" : String(workflows.length) },
    { k: "Runs", v: loading ? "…" : String(totalRuns) },
    { k: "Completed", v: loading ? "…" : String(totalDone) },
    { k: "Spent (0G)", v: loading ? "…" : totalSpent.toFixed(4) },
  ];

  return (
    <div className="min-h-screen bg-white text-black">
      <MeshBackground />
      <Nav />
      <main className="max-w-[1400px] mx-auto px-8 pt-12 pb-24">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
          Overview
        </div>
        <h1 className="font-serif text-[52px] tracking-tight leading-none mb-10">
          Dashboard
        </h1>

        {!address ? (
          <div className="rounded-3xl border border-dashed border-black/15 p-20 text-center bg-white/60">
            <h2 className="font-serif text-[28px] tracking-tight mb-2">
              Connect your wallet
            </h2>
            <p className="text-[14px] text-neutral-500 max-w-sm mx-auto">
              Connect to see your on-chain workflows and run history.
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {stats.map((s) => (
                <div
                  key={s.k}
                  className="rounded-2xl bg-white border border-black/[0.06] p-5"
                >
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                    {s.k}
                  </div>
                  <div className="font-serif text-[36px] tracking-tight leading-none mt-2 flex items-center gap-2">
                    {loading ? (
                      <Loader2
                        size={20}
                        className="animate-spin text-neutral-300"
                      />
                    ) : (
                      s.v
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-12 gap-5">
              {/* Workflows */}
              <div className="col-span-12 lg:col-span-7">
                <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-3">
                  Your workflows
                </div>
                {loading ? (
                  <div className="rounded-2xl border border-black/[0.06] p-10 flex items-center justify-center gap-2 text-[13px] text-neutral-400">
                    <Loader2 size={14} className="animate-spin" /> Loading from
                    chain…
                  </div>
                ) : workflows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 p-10 text-center text-[13px] text-neutral-500">
                    No workflows deployed yet.{" "}
                    <button
                      onClick={() => router.push("/builder")}
                      className="text-black underline"
                    >
                      Build one
                    </button>
                    .
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04]">
                    {workflows.map((w) => (
                      <div
                        key={w.address}
                        className="p-4 flex items-center justify-between hover:bg-neutral-50/60 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[13px]">
                            {w.label}
                          </div>
                          <div className="font-mono text-[10px] text-neutral-500 truncate">
                            {w.address}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                              runs
                            </div>
                            <div className="font-mono text-[12px]">
                              {w.runCount}{" "}
                              <span className="text-neutral-400">
                                ({w.doneCount} done)
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                              cost/run
                            </div>
                            <div className="font-mono text-[12px]">
                              {w.totalCost} 0G
                            </div>
                          </div>
                          <button
                            onClick={() => router.push("/runs")}
                            className="text-neutral-400 hover:text-black transition-colors"
                          >
                            <ArrowUpRight size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity */}
              <div className="col-span-12 lg:col-span-5">
                <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-3">
                  Recent runs
                </div>
                {loading ? (
                  <div className="rounded-2xl border border-black/[0.06] p-10 flex items-center justify-center gap-2 text-[13px] text-neutral-400">
                    <Loader2 size={14} className="animate-spin" /> Loading…
                  </div>
                ) : runs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 p-10 text-center text-[13px] text-neutral-500">
                    No runs yet.{" "}
                    <button
                      onClick={() => router.push("/runs")}
                      className="text-black underline"
                    >
                      Start one
                    </button>
                    .
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04]">
                    {runs.slice(0, 8).map((r) => (
                      <div
                        key={`${r.workflowAddress}-${r.id}`}
                        className="p-4 flex items-center justify-between text-[12px] hover:bg-neutral-50/60 transition-colors cursor-pointer"
                        onClick={() => router.push("/runs")}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {r.status === "done" ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          ) : (
                            <Loader2
                              size={11}
                              className="animate-spin text-blue-500 flex-shrink-0"
                            />
                          )}
                          <span className="font-mono text-neutral-400">
                            #{r.id}
                          </span>
                          <span className="text-neutral-700 truncate">
                            {r.workflowLabel}
                          </span>
                        </div>
                        <span
                          className={`text-[11px] flex-shrink-0 ml-2 ${r.status === "done" ? "text-emerald-600" : "text-blue-600"}`}
                        >
                          {r.status === "done"
                            ? "complete"
                            : `step ${r.currentStep + 1}`}
                        </span>
                      </div>
                    ))}
                    {runs.length > 8 && (
                      <div className="p-3 text-center">
                        <button
                          onClick={() => router.push("/runs")}
                          className="text-[11px] text-neutral-500 hover:text-black flex items-center gap-1 mx-auto"
                        >
                          View all {runs.length} runs <ExternalLink size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
