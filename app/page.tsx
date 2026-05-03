'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Zap, Box, Network, Check, Loader2, ChevronRight, Github,
} from 'lucide-react';
import MeshBackground from '@/components/MeshBackground';
import Nav from '@/components/Nav';
import TypePill from '@/components/TypePill';

const PIPELINE = [
  { name: 'Tokenizer',       type: 'txt'    },
  { name: 'OpenEmbed v2',    type: 'emb'    },
  { name: 'Vector Indexer',  type: 'vec'    },
  { name: 'Semantic Search', type: 'txt'    },
  { name: 'Report Composer', type: 'report' },
];

export default function Landing() {
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActiveStep(s => (s + 1) % 5), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-white text-black">
      <MeshBackground />
      <Nav />

      <main className="max-w-[1400px] mx-auto px-8 pt-20 pb-32">
        {/* ── HERO ── */}
        <div className="grid grid-cols-12 gap-8 items-center min-h-[70vh]">
          <div className="col-span-12 lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-black/[0.08] bg-white/60 backdrop-blur text-[12px] text-neutral-600 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Live on 0G Galileo Testnet
              <ChevronRight size={12} />
            </div>

            <h1 className="font-serif text-[80px] leading-[0.95] tracking-[-0.04em] text-black">
              Composable<br />
              <span className="italic font-light text-neutral-500">on-chain</span> pipelines.
            </h1>

            <p className="mt-8 text-[19px] leading-[1.5] text-neutral-600 max-w-xl">
              Wire AI agents into linear workflows. Deploy them as contracts.
              Pay-per-run, settled on-chain. Like Stripe for inference, like LangChain for the next decade.
            </p>

            <div className="mt-10 flex items-center gap-3">
              <Link href="/builder" className="group flex items-center gap-2 px-5 py-3 rounded-full bg-black text-white text-[14px] font-medium hover:bg-neutral-800 transition-all">
                Open Builder
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/agents" className="px-5 py-3 rounded-full bg-white text-[14px] font-medium hover:bg-neutral-50 border border-black/[0.08] transition-colors">
                Browse agents
              </Link>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-8 max-w-md">
              {[['8', 'agents indexed'], ['16602', 'chainId'], ['<5s', 'time-to-deploy']].map(([k, v]) => (
                <div key={v}>
                  <div className="font-serif text-[28px] leading-none tracking-tight">{k}</div>
                  <div className="text-[11px] uppercase tracking-widest text-neutral-500 mt-1.5">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero pipeline visual */}
          <div className="col-span-12 lg:col-span-5">
            <div className="relative">
              <div className="rounded-3xl bg-white/60 backdrop-blur-sm border border-black/[0.06] p-6"
                style={{ boxShadow: '0 30px 60px -25px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.02)' }}>
                <div className="flex items-center justify-between mb-5">
                  <div className="text-[11px] uppercase tracking-widest text-neutral-500">Run #4827</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    executing
                  </div>
                </div>
                <div className="space-y-1">
                  {PIPELINE.map((step, i) => {
                    const isDone = i < activeStep, isActive = i === activeStep;
                    return (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 ${isActive ? 'bg-neutral-50' : ''}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono transition-all ${isDone ? 'bg-black text-white' : isActive ? 'bg-white border border-black ring-4 ring-black/5' : 'bg-neutral-100 text-neutral-400'}`}>
                          {isDone ? <Check size={12} /> : isActive ? <Loader2 size={12} className="animate-spin" /> : i}
                        </div>
                        <div className="flex-1 flex items-center justify-between">
                          <span className={`text-[14px] ${isDone || isActive ? 'text-black' : 'text-neutral-400'}`}>{step.name}</span>
                          <TypePill type={step.type} size="xs" />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 pt-5 border-t border-black/[0.06] flex items-center justify-between text-[12px]">
                  <span className="text-neutral-500 font-mono">0xae3f...c821</span>
                  <span className="text-neutral-700">0.0096 0G</span>
                </div>
              </div>

              <div className="absolute -bottom-6 -right-4 rounded-2xl bg-white border border-black/[0.06] p-3 flex items-center gap-2.5"
                style={{ boxShadow: '0 20px 40px -20px rgba(0,0,0,0.12)' }}>
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Check size={14} className="text-emerald-600" />
                </div>
                <div>
                  <div className="text-[12px] font-medium leading-tight">Settled</div>
                  <div className="text-[10px] text-neutral-500 font-mono">block 4,201,883</div>
                </div>
              </div>

              <div className="absolute -top-4 -left-4 rounded-2xl bg-white border border-black/[0.06] px-3 py-2 text-[11px] font-mono text-neutral-600"
                style={{ boxShadow: '0 20px 40px -20px rgba(0,0,0,0.12)' }}>
                <span className="text-neutral-400">tx →</span> 0x73a1...f04d
              </div>
            </div>
          </div>
        </div>

        {/* ── HOW IT WORKS ── */}
        <section className="mt-32">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-3">How it works</div>
          <h2 className="font-serif text-[42px] tracking-tight leading-tight max-w-2xl">
            Three primitives. <span className="italic font-light text-neutral-500">Nothing more.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-14">
            {[
              { n: '01', t: 'Compose', d: 'Drag agents onto the canvas. Connect them by data type. The graph enforces a linear flow.', icon: Network },
              { n: '02', t: 'Deploy',  d: 'Your pipeline becomes a contract. Immutable, replayable, with a fixed total cost.',        icon: Box     },
              { n: '03', t: 'Execute', d: 'Submit an input pointer. Workers process steps. Each output flows into the next.',          icon: Zap     },
            ].map(({ n, t, d, icon: Icon }) => (
              <div key={n} className="rounded-2xl bg-white border border-black/[0.06] p-7 hover:border-black/[0.15] transition-colors">
                <div className="flex items-center justify-between mb-8">
                  <span className="font-mono text-[11px] text-neutral-400 tracking-widest">{n}</span>
                  <Icon size={16} className="text-neutral-400" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-[24px] tracking-tight mb-2">{t}</h3>
                <p className="text-[14px] leading-relaxed text-neutral-600">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-black/[0.06] mt-20">
        <div className="max-w-[1400px] mx-auto px-8 py-8 flex items-center justify-between text-[12px] text-neutral-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-black flex items-center justify-center">
              <span className="text-white font-mono text-[9px] font-bold">0G</span>
            </div>
            Workflows · Galileo Testnet
          </div>
          <div className="flex items-center gap-5">
            <span className="font-mono">chainId 16602</span>
            <a href="#" className="hover:text-black flex items-center gap-1.5">
              <Github size={12} /> source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
