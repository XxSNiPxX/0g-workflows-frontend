import { NextResponse } from 'next/server';
import { getProvider, getAgentRegistryContract, CONTRACTS } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  let healthy = true;
  try {
    const block = await getProvider().getBlockNumber();
    checks.rpc = { ok: true, detail: `block ${block}` };
  } catch (e: any) { checks.rpc = { ok: false, detail: e.message }; healthy = false; }
  try {
    const n = Number(await getAgentRegistryContract().nextAgentId());
    checks.agentRegistry = { ok: true, detail: `${n} agent(s)` };
  } catch (e: any) { checks.agentRegistry = { ok: false, detail: e.message }; healthy = false; }
  return NextResponse.json({ healthy, checks, contracts: CONTRACTS, ts: new Date().toISOString() });
}
