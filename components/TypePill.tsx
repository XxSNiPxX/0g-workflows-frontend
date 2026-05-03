const TYPE: Record<string, { fg: string; bg: string; border: string }> = {
  txt:    { fg: '#1d4ed8', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.22)'  },
  emb:    { fg: '#047857', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.22)'  },
  vec:    { fg: '#6d28d9', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.22)'  },
  report: { fg: '#c2410c', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.22)'  },
};

export function typeStyle(t: string) { return TYPE[t] ?? TYPE.txt; }

export default function TypePill({ type, size = 'sm' }: { type: string; size?: 'xs' | 'sm' }) {
  const t   = typeStyle(type);
  const cls = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span
      className={`${cls} rounded-md font-mono font-medium tracking-tight inline-flex items-center gap-1`}
      style={{ color: t.fg, background: t.bg, border: `1px solid ${t.border}` }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: t.fg }} />
      {type}
    </span>
  );
}
