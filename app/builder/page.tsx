"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  ArrowRight,
  Trash2,
  Loader2,
  Sparkles,
  Network,
  CircleDot,
  Search,
  AlertCircle,
  Check,
} from "lucide-react";
import MeshBackground from "@/components/MeshBackground";
import Nav from "@/components/Nav";
import TypePill from "@/components/TypePill";
import { useWallet } from "@/context/WalletContext";
import {
  CONTRACTS,
  ABIs,
  typeToBytes32,
  GALILEO_CHAINID,
} from "@/lib/contracts";
import { Contract, ZeroAddress } from "ethers";
import type { Agent, GraphNode, GraphEdge, WorkflowMeta } from "@/lib/types";

const NODE_W = 240;

// ── cubic bezier path ─────────────────────────────────────────────────────
function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export default function BuilderPage() {
  const router = useRouter();
  const { address, provider, chainId, connect } = useWallet();

  // agents
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentSearch, setAgentSearch] = useState("");

  // graph
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  // drag
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    id: string;
    ox: number;
    oy: number;
  } | null>(null);

  // connection
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);

  // deploy
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);

  // load agents
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => {})
      .finally(() => setAgentsLoading(false));
  }, []);

  // load queued nodes from Agents page
  useEffect(() => {
    const raw = sessionStorage.getItem("builderNodes");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as any[];
      if (parsed.length) {
        setNodes(
          parsed.map((n) => ({
            id: n.nodeId,
            name: n.name,
            address: n.address,
            input: n.input,
            output: n.output,
            cost: n.cost,
            x: n.x,
            y: n.y,
          })),
        );
        sessionStorage.removeItem("builderNodes");
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── ordered steps ─────────────────────────────────────────────────────────
  const orderedSteps = useMemo(() => {
    if (!nodes.length) return [];
    const incoming = new Set(edges.map((e) => e.to));
    const start = nodes.find((n) => !incoming.has(n.id));
    if (!start) return [];
    const result: GraphNode[] = [];
    let cur: GraphNode | undefined = start;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      result.push(cur);
      const next = edges.find((e) => e.from === cur!.id);
      cur = next ? nodes.find((n) => n.id === next.to) : undefined;
    }
    return result;
  }, [nodes, edges]);

  const isLinear = orderedSteps.length === nodes.length && nodes.length > 0;
  const totalCost = orderedSteps.reduce(
    (s, n) => s + parseFloat(n.cost || "0"),
    0,
  );

  // ── add agent ─────────────────────────────────────────────────────────────
  const addAgent = useCallback(
    (a: Agent) => {
      const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const offset = nodes.length * 30;
      setNodes((prev) => [
        ...prev,
        {
          id,
          name: a.name,
          address: a.address,
          input: a.inputTypes[0] ?? "txt",
          output: a.outputType,
          cost: a.costPerRequest,
          x: 120 + offset,
          y: 120 + offset,
        },
      ]);
    },
    [nodes.length],
  );

  const removeNode = useCallback(
    (id: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
      if (connectFrom === id) setConnectFrom(null);
    },
    [connectFrom],
  );

  // ── drag ──────────────────────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent, node: GraphNode) => {
      if (
        (e.target as HTMLElement).closest("[data-port]") ||
        (e.target as HTMLElement).closest("[data-action]")
      )
        return;
      const rect = canvasRef.current!.getBoundingClientRect();
      setDrag({
        id: node.id,
        ox: e.clientX - rect.left - node.x,
        oy: e.clientY - rect.top - node.y,
      });
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(rect.width - NODE_W, e.clientX - rect.left - drag.ox),
      );
      const y = Math.max(
        0,
        Math.min(rect.height - 100, e.clientY - rect.top - drag.oy),
      );
      setNodes((prev) =>
        prev.map((n) => (n.id === drag.id ? { ...n, x, y } : n)),
      );
    },
    [drag],
  );

  const onPointerUp = useCallback(() => setDrag(null), []);

  // ── port connection ───────────────────────────────────────────────────────
  const handlePortClick = useCallback(
    (nodeId: string, side: "in" | "out") => {
      if (side === "out") {
        setConnectFrom(nodeId);
      } else if (connectFrom && connectFrom !== nodeId) {
        const src = nodes.find((n) => n.id === connectFrom);
        const tgt = nodes.find((n) => n.id === nodeId);
        if (src && tgt && src.output === tgt.input) {
          const srcHasOut = edges.some((e) => e.from === src.id);
          const tgtHasIn = edges.some((e) => e.to === tgt.id);
          if (!srcHasOut && !tgtHasIn) {
            setEdges((prev) => [...prev, { from: src.id, to: tgt.id }]);
          }
        }
        setConnectFrom(null);
      }
    },
    [connectFrom, nodes, edges],
  );

  // ── deploy ────────────────────────────────────────────────────────────────
  const handleDeploy = async () => {
    if (!address) {
      connect();
      return;
    }
    if (chainId !== GALILEO_CHAINID) {
      alert("Switch to 0G Galileo Testnet");
      return;
    }
    if (!isLinear) return;
    setDeploying(true);
    setDeployError(null);
    setDeploySuccess(null);
    try {
      const signer = await provider!.getSigner();
      const factory = new Contract(
        CONTRACTS.workflowFactory,
        ABIs.workflowFactory,
        signer,
      );
      const steps = orderedSteps.map((s) => ({
        agent: s.address,
        inputType: typeToBytes32(s.input),
        outputType: typeToBytes32(s.output),
      }));
      const tx = await factory.createWorkflow(steps, "", "", ZeroAddress);
      const receipt = await tx.wait();
      const wfAddr = (receipt?.logs?.[0] as any)?.address ?? "unknown";

      const wf: WorkflowMeta = {
        id: wfAddr.toLowerCase(),
        address: wfAddr,
        label: orderedSteps.map((s) => s.name).join(" → "),
        steps: orderedSteps.map((s) => ({
          name: s.name,
          agent: s.address,
          inputType: s.input,
          outputType: s.output,
        })),
        totalCost: totalCost.toFixed(4),
        createdAt: Date.now(),
      };
      const prev: WorkflowMeta[] = JSON.parse(
        sessionStorage.getItem("myWorkflows") ?? "[]",
      );
      sessionStorage.setItem("myWorkflows", JSON.stringify([wf, ...prev]));
      setDeploySuccess(wfAddr);
      setNodes([]);
      setEdges([]);
    } catch (e: any) {
      setDeployError(e?.reason ?? e?.message ?? "Transaction failed");
    } finally {
      setDeploying(false);
    }
  };

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().includes(agentSearch.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-screen bg-white text-black overflow-hidden">
      <MeshBackground />
      <Nav />

      <div
        className="flex flex-1 overflow-hidden"
        style={{ height: "calc(100vh - 64px)" }}
      >
        {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
        <aside className="w-[280px] flex-shrink-0 bg-white border-r border-black/[0.06] flex flex-col">
          <div className="px-4 pt-4 pb-3 border-b border-black/[0.05]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-widest text-neutral-500">
                Agents
              </div>
              <span className="text-[11px] text-neutral-400 font-mono">
                {agents.length}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-neutral-50 border border-black/[0.06] rounded-xl px-3 py-2">
              <Search size={13} className="text-neutral-400" />
              <input
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="Filter…"
                className="bg-transparent outline-none text-[12px] flex-1 placeholder:text-neutral-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
            {agentsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={20} className="animate-spin text-neutral-300" />
              </div>
            ) : (
              filteredAgents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => addAgent(a)}
                  className="w-full text-left p-3 rounded-xl border border-black/[0.05] hover:border-black/15 hover:bg-neutral-50/70 transition-all group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-[12px] truncate flex-1 pr-2">
                      {a.name}
                    </span>
                    <Plus
                      size={12}
                      className="text-neutral-400 group-hover:text-black transition-colors flex-shrink-0"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TypePill type={a.inputTypes[0] ?? "txt"} size="xs" />
                    <ArrowRight size={9} className="text-neutral-300" />
                    <TypePill type={a.outputType} size="xs" />
                    <span className="ml-auto font-mono text-[10px] text-neutral-400">
                      {a.costPerRequest} 0G
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── CENTER CANVAS ─────────────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col overflow-hidden">
          {/* canvas top-bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] bg-white/60 flex-shrink-0">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-neutral-500">canvas</span>
              {connectFrom && (
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] flex items-center gap-1">
                  <CircleDot size={10} /> click an input port to connect
                  <button
                    onClick={() => setConnectFrom(null)}
                    className="ml-1 hover:text-blue-900"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <span>
                {nodes.length} nodes · {edges.length} edges
              </span>
              {nodes.length > 0 && (
                <button
                  onClick={() => {
                    setNodes([]);
                    setEdges([]);
                    setConnectFrom(null);
                    setDeploySuccess(null);
                    setDeployError(null);
                  }}
                  className="text-neutral-500 hover:text-black flex items-center gap-1"
                >
                  <Trash2 size={11} /> clear
                </button>
              )}
            </div>
          </div>

          {/* deploy messages */}
          {deployError && (
            <div className="mx-5 mt-3 flex-shrink-0 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 flex items-center gap-2 text-[12px] text-red-700">
              <AlertCircle size={14} className="flex-shrink-0" />
              {deployError}
              <button onClick={() => setDeployError(null)} className="ml-auto">
                <X size={12} />
              </button>
            </div>
          )}
          {deploySuccess && (
            <div className="mx-5 mt-3 flex-shrink-0 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 flex items-center gap-2 text-[12px] text-emerald-700">
              <Check size={14} className="flex-shrink-0" /> Deployed!{" "}
              {deploySuccess.slice(0, 20)}…
              <button
                onClick={() => router.push("/runs")}
                className="ml-auto font-medium underline"
              >
                Go to Runs →
              </button>
            </div>
          )}

          {/* canvas */}
          <div
            ref={canvasRef}
            className="flex-1 relative overflow-auto"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              minHeight: "400px",
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onClick={(e) => {
              if (e.target === canvasRef.current) setConnectFrom(null);
            }}
          >
            {/* empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <Network
                    size={20}
                    className="text-neutral-400"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="text-[14px] text-neutral-700">
                  Click an agent to add it
                </div>
                <div className="text-[12px] text-neutral-500 mt-1">
                  Connect output → input ports to chain them
                </div>
              </div>
            )}

            {/* SVG edges */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ overflow: "visible" }}
            >
              {edges.map((edge, i) => {
                const src = nodes.find((n) => n.id === edge.from);
                const tgt = nodes.find((n) => n.id === edge.to);
                if (!src || !tgt) return null;
                const x1 = src.x + NODE_W,
                  y1 = src.y + 38,
                  x2 = tgt.x,
                  y2 = tgt.y + 38;
                const isHover = hoverEdge === i;
                return (
                  <g key={i}>
                    <path
                      d={edgePath(x1, y1, x2, y2)}
                      fill="none"
                      stroke={isHover ? "#000" : "rgba(0,0,0,0.25)"}
                      strokeWidth={isHover ? 2 : 1.5}
                      onMouseEnter={() => setHoverEdge(i)}
                      onMouseLeave={() => setHoverEdge(null)}
                      style={{ pointerEvents: "stroke" }}
                    />
                    {isHover && (
                      <foreignObject
                        x={(x1 + x2) / 2 - 12}
                        y={(y1 + y2) / 2 - 12}
                        width="24"
                        height="24"
                        style={{ pointerEvents: "auto" }}
                      >
                        <button
                          onClick={() =>
                            setEdges((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="w-6 h-6 rounded-full bg-white border border-black/20 flex items-center justify-center hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all"
                          style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}
                        >
                          <X size={11} />
                        </button>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* nodes */}
            {nodes.map((node) => {
              const hasIn = edges.some((e) => e.to === node.id);
              const hasOut = edges.some((e) => e.from === node.id);
              const isPending = connectFrom === node.id;
              return (
                <div
                  key={node.id}
                  onPointerDown={(e) => onPointerDown(e, node)}
                  className={`absolute select-none cursor-grab active:cursor-grabbing rounded-2xl bg-white border transition-all ${isPending ? "border-blue-500 ring-4 ring-blue-100" : "border-black/[0.08] hover:border-black/20"}`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: NODE_W,
                    boxShadow:
                      drag?.id === node.id
                        ? "0 20px 40px -10px rgba(0,0,0,0.18)"
                        : "0 2px 6px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* header */}
                  <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
                    <span className="font-medium text-[13px] truncate">
                      {node.name}
                    </span>
                    <button
                      data-action
                      onClick={() => removeNode(node.id)}
                      className="text-neutral-400 hover:text-red-600 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  {/* type row */}
                  <div className="px-3.5 pb-3 flex items-center justify-between">
                    <TypePill type={node.input} size="xs" />
                    <ArrowRight size={10} className="text-neutral-300" />
                    <TypePill type={node.output} size="xs" />
                  </div>
                  {/* cost row */}
                  <div className="px-3.5 pb-3 flex items-center justify-between text-[10px] text-neutral-400 border-t border-black/[0.04] pt-2">
                    <span className="font-mono">{node.cost} 0G</span>
                    <span className="font-mono">
                      {node.address.slice(0, 6)}…{node.address.slice(-4)}
                    </span>
                  </div>
                  {/* input port */}
                  <button
                    data-port
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePortClick(node.id, "in");
                    }}
                    className={`absolute left-0 top-[34px] -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all ${hasIn ? "bg-black border-black" : "bg-white border-neutral-400 hover:border-black hover:scale-125"}`}
                    title="input"
                  />
                  {/* output port */}
                  <button
                    data-port
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePortClick(node.id, "out");
                    }}
                    className={`absolute right-0 top-[34px] translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all ${isPending ? "bg-blue-500 border-blue-500 ring-4 ring-blue-200" : hasOut ? "bg-black border-black" : "bg-white border-neutral-400 hover:border-black hover:scale-125"}`}
                    title="output"
                  />
                </div>
              );
            })}
          </div>

          {/* ── bottom bar ────────────────────────────────────────────────── */}
          <div className="border-t border-black/[0.06] px-5 py-3 bg-white/80 backdrop-blur flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-5 text-[12px]">
              <div>
                <span className="text-neutral-500">pipeline </span>
                {orderedSteps.length > 0 ? (
                  <span className="font-mono text-neutral-700">
                    {orderedSteps.map((s) => s.name).join(" → ")}
                  </span>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                  total
                </div>
                <div className="font-mono text-[14px]">
                  {totalCost.toFixed(4)} 0G
                </div>
              </div>
              <button
                onClick={handleDeploy}
                disabled={!isLinear || deploying}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${isLinear && !deploying ? "bg-black text-white hover:bg-neutral-800" : "bg-neutral-100 text-neutral-400 cursor-not-allowed"}`}
              >
                {deploying ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Deploying…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Deploy workflow
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
