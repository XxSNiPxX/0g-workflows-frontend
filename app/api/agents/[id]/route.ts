import { NextRequest, NextResponse } from "next/server";
import { getAgentRegistryContract, mapAgent } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);

  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json(
      { success: false, error: "Invalid id" },
      { status: 400 },
    );
  }

  try {
    const reg = getAgentRegistryContract();

    const raw = await reg.getAgent(id);
    console.log("[RAW SINGLE AGENT]", id, raw);

    const agent = mapAgent(raw, id);
    console.log("[MAPPED SINGLE AGENT]", agent);

    if (!agent.active) {
      return NextResponse.json(
        { success: false, error: "Agent not active" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      agent,
    });
  } catch (e: any) {
    console.error("[SINGLE API ERROR]", e);

    return NextResponse.json({
      success: false,
      error: e.shortMessage ?? e.message,
    });
  }
}
