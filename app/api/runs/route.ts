import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowContract, mapRun } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const wfAddr   = req.nextUrl.searchParams.get('workflow');
  const runIdStr = req.nextUrl.searchParams.get('runId');
  const userAddr = req.nextUrl.searchParams.get('user');
  const withKeys = req.nextUrl.searchParams.get('withKeys') === 'true';
  if (!wfAddr) return NextResponse.json({ success: false, error: 'workflow param required' }, { status: 400 });
  try {
    const wf = getWorkflowContract(wfAddr);

    // single run
    if (runIdStr !== null) {
      const runId = parseInt(runIdStr, 10);
      const raw   = await wf.getRun(runId);
      const run   = mapRun(raw, runId);
      let stepKeys: Record<number, string> = {};
      if (withKeys && run.currentStepIndex > 0) {
        const results = await Promise.allSettled(
          Array.from({ length: run.currentStepIndex }, (_, i) => wf.getStepKey(runId, i))
        );
        results.forEach((r, i) => { if (r.status === 'fulfilled') stepKeys[i] = r.value as string; });
      }
      return NextResponse.json({ success: true, run, stepKeys });
    }

    // all runs
    const total = Number(await wf.nextRunId());
    if (total === 0) return NextResponse.json({ success: true, runs: [], total: 0 });
    const from    = Math.max(0, total - 100);
    const results = await Promise.allSettled(Array.from({ length: total - from }, (_, i) => wf.getRun(from + i)));
    let runs      = results
      .map((r, i) => r.status === 'fulfilled' ? mapRun(r.value, from + i) : null)
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (userAddr) runs = runs.filter(r => r.user.toLowerCase() === userAddr.toLowerCase());
    runs.reverse();
    return NextResponse.json({ success: true, runs, total: runs.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.shortMessage ?? e.message, runs: [] });
  }
}
