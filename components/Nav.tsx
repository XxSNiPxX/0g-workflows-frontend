"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Loader2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { GALILEO_CHAINID } from "@/lib/contracts";

const TABS = [
  { href: "/agents", label: "Agents" },
  { href: "/builder", label: "Builder" },
  { href: "/runs", label: "Runs" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/hackathon", label: "Hackathon" },
];

export default function Nav() {
  const path = usePathname();
  const { address, chainId, isConnecting, connect } = useWallet();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-black/[0.06]">
      <div className="max-w-[1400px] mx-auto px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white font-mono text-[11px] font-bold tracking-tighter">
              0G
            </span>
          </div>
          <span className="font-medium tracking-tight text-[15px]">
            Workflows
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 ml-1 px-1.5 py-0.5 rounded border border-black/[0.08]">
            Galileo
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 bg-neutral-100/60 rounded-full p-1 border border-black/[0.04]">
          {TABS.map((t) => {
            const active = path === t.href || path.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${active ? "bg-white text-black shadow-sm border border-black/[0.06]" : "text-neutral-600 hover:text-black"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={connect}
          disabled={isConnecting}
          className={`group flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors ${
            address && chainId === GALILEO_CHAINID
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : address
                ? "bg-orange-50 text-orange-700 border border-orange-200"
                : "bg-black text-white hover:bg-neutral-800"
          }`}
        >
          {isConnecting ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Connecting…</span>
            </>
          ) : address ? (
            <>
              <span
                className={`w-1.5 h-1.5 rounded-full ${chainId === GALILEO_CHAINID ? "bg-emerald-400" : "bg-orange-400"}`}
              />
              <span className="font-mono text-[12px]">
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
              {chainId !== GALILEO_CHAINID && (
                <span className="text-[10px] ml-1">⚠ wrong network</span>
              )}
            </>
          ) : (
            <>
              <Wallet size={13} />
              <span>Connect</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
