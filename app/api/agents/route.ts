import { NextRequest, NextResponse } from "next/server";
import { getAgentRegistryContract, mapAgent } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const onlyActive = req.nextUrl.searchParams.get("active") !== "false";
  const onlyWorkflowReady =
    req.nextUrl.searchParams.get("workflowReady") !== "false";

  try {
    const reg = getAgentRegistryContract();

    const total = Number(await reg.nextAgentId());
    console.log("[TOTAL AGENTS]", total);

    if (total === 0) {
      return NextResponse.json({ success: true, agents: [], total: 0 });
    }

    const agents: any[] = [];

    // ✅ preserve correct IDs
    for (let i = 1; i <= total; i += 10) {
      const batchIds = Array.from(
        { length: Math.min(10, total - i + 1) },
        (_, k) => i + k,
      );

      const batch = await Promise.allSettled(
        batchIds.map((id) => reg.getAgent(id)),
      );

      batch.forEach((res, idx) => {
        const id = batchIds[idx];

        if (res.status === "fulfilled") {
          console.log("[RAW AGENT]", id, res.value);

          const mapped = mapAgent(res.value, id);
          agents.push(mapped);
        } else {
          console.warn("[FETCH FAILED]", id, res.reason);
        }
      });
    }

    const filtered = agents.filter(
      (a) =>
        (!onlyActive || a.active) && (!onlyWorkflowReady || a.workflowReady),
    );

    console.log("[FINAL AGENTS]", filtered);

    return NextResponse.json({
      success: true,
      agents: filtered,
      total: filtered.length,
    });
  } catch (e: any) {
    console.error("[API ERROR]", e);

    return NextResponse.json({
      success: false,
      error: e.shortMessage ?? e.message,
      agents: [],
      total: 0,
    });
  }
}
