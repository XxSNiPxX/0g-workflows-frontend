import { NextRequest, NextResponse } from "next/server";
import {
  getWorkflowFactoryContract,
  getWorkflowContract,
} from "@/lib/contracts";
import { formatEther } from "ethers";
import { typeToBytes32 } from "@/lib/contracts";

export const dynamic = "force-dynamic";

/* ── resolver ───────────────────────────────────────── */
const TYPE_MAP: Record<string, string> = {
  [typeToBytes32("txt")]: "txt",
  [typeToBytes32("emb")]: "emb",
  [typeToBytes32("vec")]: "vec",
  [typeToBytes32("report")]: "report",
};

function resolveType(hash: any): string {
  if (typeof hash !== "string" || !hash.startsWith("0x")) return "";
  return TYPE_MAP[hash] ?? hash.slice(0, 10);
}

/* ─────────────────────────────────────────────────── */

async function enrichWorkflow(address: string, creator: string) {
  const wf = getWorkflowContract(address);

  const [costRaw, nextRunIdRaw] = await Promise.all([
    wf.totalCost().catch(() => 0n),
    wf.nextRunId().catch(() => 0n),
  ]);

  let steps: any[] = [];

  try {
    const count = Number(await wf.getStepCount());

    const raws = await Promise.allSettled(
      Array.from({ length: count }, (_, i) => wf.getStep(i)),
    );

    steps = raws
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => ({
        agent: r.value.agent,

        // ✅ FIXED
        inputType: resolveType(r.value.inputType),
        outputType: resolveType(r.value.outputType),

        cost: formatEther(r.value.cost ?? 0n),
      }));
  } catch {}

  return {
    id: address.toLowerCase(),
    address,
    creator,
    steps,
    totalCost: formatEther(BigInt(costRaw)),
    runCount: Number(nextRunIdRaw),
    createdAt: Date.now(),
  };
}

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get("user");

  if (!user) {
    return NextResponse.json(
      { success: false, error: "user param required" },
      { status: 400 },
    );
  }

  try {
    const addrs: string[] =
      await getWorkflowFactoryContract().getUserWorkflows(user);

    if (!addrs.length) {
      return NextResponse.json({ success: true, workflows: [] });
    }

    const results = await Promise.all(
      addrs.map((addr) =>
        Promise.race([
          enrichWorkflow(addr, user),
          new Promise<null>((res) => setTimeout(() => res(null), 8000)),
        ]),
      ),
    );

    return NextResponse.json({
      success: true,
      workflows: results.filter(Boolean),
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.shortMessage ?? e.message,
      workflows: [],
    });
  }
}
