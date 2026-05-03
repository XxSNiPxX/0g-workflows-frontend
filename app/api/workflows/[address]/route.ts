import { NextRequest, NextResponse } from "next/server";
import { getWorkflowContract, decodeBytes32, mapRun } from "@/lib/contracts";
import { formatEther } from "ethers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } },
) {
  const { address } = params;
  if (!address?.startsWith("0x"))
    return NextResponse.json(
      { success: false, error: "Invalid address" },
      { status: 400 },
    );
  try {
    const wf = getWorkflowContract(address);
    const [costRaw, nextRunIdRaw] = await Promise.all([
      wf.totalCost(),
      wf.nextRunId(),
    ]);
    const runCount = Number(nextRunIdRaw);
    let steps: any[] = [];
    try {
      const count = Number(await wf.getStepCount());
      const raws = await Promise.allSettled(
        Array.from({ length: count }, (_, i) => wf.getStep(i)),
      );
      steps = raws
        .filter(
          (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled",
        )
        .map((r) => ({
          agent: r.value.agent,
          inputType: decodeBytes32(r.value.inputType) || "txt",
          outputType: decodeBytes32(r.value.outputType) || "txt",
          cost: formatEther(r.value.cost ?? 0n),
        }));
    } catch {
      /* ok */
    }
    const from = Math.max(0, runCount - 50);
    const rawRuns = await Promise.allSettled(
      Array.from({ length: runCount - from }, (_, i) => wf.getRun(from + i)),
    );
    const runs = rawRuns
      .map((r, i) =>
        r.status === "fulfilled" ? mapRun(r.value, from + i) : null,
      )
      .filter(Boolean)
      .reverse();
    return NextResponse.json({
      success: true,
      workflow: {
        address,
        totalCost: formatEther(costRaw),
        runCount,
        steps,
        runs,
      },
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.shortMessage ?? e.message,
    });
  }
}
