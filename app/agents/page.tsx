"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import MeshBackground from "@/components/MeshBackground";
import Nav from "@/components/Nav";
import TypePill from "@/components/TypePill";
import type { Agent } from "@/lib/types";

/* ------------------ DEBUG + NORMALIZATION ------------------ */

function isHexLike(v: any) {
  return typeof v === "string" && v.startsWith("0x") && v.length > 10;
}

function tryDecodeHex(v: any) {
  if (!isHexLike(v)) return v;
  try {
    const bytes = new Uint8Array(
      v
        .slice(2)
        .match(/.{1,2}/g)!
        .map((b: string) => parseInt(b, 16)),
    );
    return new TextDecoder().decode(bytes).replace(/\0/g, "");
  } catch {
    return v;
  }
}

function normalizeAgent(a: any): Agent {
  const decodedName = tryDecodeHex(a.name);
  const decodedDesc = tryDecodeHex(a.description);

  // DEBUG (only useful signal)
  console.log("[AGENT RAW]", {
    id: a.id,
    name_type: typeof a.name,
    name_raw: a.name,
    name_decoded: decodedName,
    desc_raw: a.description,
    desc_decoded: decodedDesc,
  });

  return {
    ...a,
    name: typeof decodedName === "string" ? decodedName : "",
    description: typeof decodedDesc === "string" ? decodedDesc : "",
  };
}

/* ------------------ COMPONENT ------------------ */

export default function AgentsPage() {
  const router = useRouter();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/agents");

      // DEBUG: response status
      console.log("[API STATUS]", res.status);

      const data = await res.json();

      // DEBUG: raw payload
      console.log("[API RAW]", data);

      if (!data.success) throw new Error(data.error ?? "Failed to load agents");

      const normalized = (data.agents ?? []).map(normalizeAgent);

      console.log("[AGENTS NORMALIZED]", normalized);

      setAgents(normalized);
    } catch (e: any) {
      console.error("[LOAD ERROR]", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ------------------ SAFE FILTER ------------------ */

  const filtered = agents.filter((a) => {
    const name = (a.name ?? "").toLowerCase();
    const desc = (a.description ?? "").toLowerCase();
    const query = q.toLowerCase();

    return name.includes(query) || desc.includes(query);
  });

  /* ------------------ BUILDER ------------------ */

  const addToBuilder = (a: Agent) => {
    try {
      const existing: any[] = JSON.parse(
        sessionStorage.getItem("builderNodes") ?? "[]",
      );

      if (existing.find((n: any) => n.agentId === a.id)) return;

      const offset = existing.length * 30;

      const newNode = {
        agentId: a.id,
        nodeId: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: a.name,
        address: a.address,
        input: a.inputTypes?.[0] ?? "txt",
        output: a.outputType,
        cost: a.costPerRequest,
        x: 120 + offset,
        y: 120 + offset,
      };

      console.log("[ADD NODE]", newNode);

      sessionStorage.setItem(
        "builderNodes",
        JSON.stringify([...existing, newNode]),
      );

      setAddedIds((prev) => new Set([...prev, a.id]));
    } catch (e) {
      console.error("[BUILDER ERROR]", e);
    }
  };

  /* ------------------ UI ------------------ */

  return (
    <div className="min-h-screen bg-white text-black">
      <MeshBackground />
      <Nav />

      <main className="max-w-[1400px] mx-auto px-8 pt-12 pb-24">
        {/* HEADER */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
              Registry
            </div>
            <h1 className="font-serif text-[52px] tracking-tight leading-none">
              Agents
            </h1>
            <p className="text-[15px] text-neutral-600 mt-3 max-w-md">
              Live agents from 0x7e3fDD…894Ab
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-black/[0.08] rounded-full px-4 py-2.5 w-80">
              <Search size={15} className="text-neutral-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search agents…"
                className="bg-transparent outline-none text-[13px] flex-1"
              />
              {q && (
                <button onClick={() => setQ("")}>
                  <X size={13} />
                </button>
              )}
            </div>

            <button onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 bg-red-50 border p-4 flex gap-3">
            <AlertCircle />
            <div>{error}</div>
          </div>
        )}

        {/* LOADING */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="animate-spin mx-auto mb-4" />
            Loading agents...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-neutral-500">
            {agents.length === 0 ? "No agents" : "No matches"}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((a) => (
              <div key={a.id} className="border p-6 rounded-2xl">
                <div className="flex justify-between mb-4">
                  <div className="flex gap-2">
                    <TypePill type={a.inputTypes?.[0] ?? "txt"} size="xs" />
                    <ArrowRight size={11} />
                    <TypePill type={a.outputType} size="xs" />
                  </div>

                  <span className="text-xs">
                    {a.address?.slice(0, 6)}…{a.address?.slice(-4)}
                  </span>
                </div>

                <h3 className="text-xl mb-2">{a.name || "[INVALID NAME]"}</h3>

                <p className="text-sm text-neutral-600 mb-4">
                  {a.description || "[INVALID DESCRIPTION]"}
                </p>

                <div className="flex justify-between">
                  <span>{a.costPerRequest} 0G</span>

                  <button
                    onClick={() => {
                      addToBuilder(a);
                      router.push("/builder");
                    }}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
