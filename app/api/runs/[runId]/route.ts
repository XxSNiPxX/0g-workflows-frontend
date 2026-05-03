import { NextRequest, NextResponse } from "next/server";
import { getWorkflowContract, mapRun, getProvider } from "@/lib/contracts";
import { Contract } from "ethers";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Get paths from environment variables with sensible defaults
const BASE_DIR = process.env.STORE_BASE_PATH || process.cwd();
const OUTPUTS_PATH =
  process.env.RUN_OUTPUTS_PATH || path.join(BASE_DIR, "run-outputs.json");

// Read from run-outputs.json (written by worker after each step)
function readRunOutput(workflow: string, runId: number): string | null {
  if (!fs.existsSync(OUTPUTS_PATH)) return null;
  try {
    const outputs: Record<string, string> = JSON.parse(
      fs.readFileSync(OUTPUTS_PATH, "utf-8"),
    );
    return outputs[`${workflow.toLowerCase()}:${runId}`] ?? null;
  } catch {
    return null;
  }
}

// Try on-chain via getRequest (requires selector cut into diamond)
const GET_REQUEST_ABI = [
  "function getRequest(bytes32) view returns (tuple(address user, uint256 tokenId, address workflow, uint256 runId, uint256 stepIndex, bytes32 inputPointer, bytes32 inputType, bytes32 outputPointer, bytes32 outputType, bytes32 outputHash, uint8 status, uint64 createdAt, uint64 updatedAt))",
];

async function resolveOutputPointer(
  wf: any,
  runId: number,
  wfAddr: string,
): Promise<string | null> {
  // 1. Try on-chain (getRequest on agent diamond — needs selector cut in)
  try {
    const stepCount = Number(await wf.getStepCount());
    const lastStep = await wf.getStep(stepCount - 1);
    const requestKey = await wf.getStepKey(runId, stepCount - 1);
    const agent = new Contract(lastStep.agent, GET_REQUEST_ABI, getProvider());
    const record = await agent.getRequest(requestKey);
    const ptr = record.outputPointer as string;
    if (ptr && ptr !== "0x" + "0".repeat(64)) return ptr.toLowerCase();
  } catch {
    /* getRequest not deployed — fall through */
  }

  // 2. Fall back to run-outputs.json sidecar (worker writes this)
  return readRunOutput(wfAddr, runId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const wfAddr = req.nextUrl.searchParams.get("workflow");
  const withKeys = req.nextUrl.searchParams.get("withKeys") === "true";
  const runId = parseInt(params.runId, 10);

  if (!wfAddr)
    return NextResponse.json(
      { success: false, error: "workflow param required" },
      { status: 400 },
    );
  if (isNaN(runId))
    return NextResponse.json(
      { success: false, error: "Invalid runId" },
      { status: 400 },
    );

  try {
    const wf = getWorkflowContract(wfAddr);
    const raw = await wf.getRun(runId);
    const run = mapRun(raw, runId);

    // Step keys
    let stepKeys: Record<number, string> = {};
    if (withKeys && run.currentStepIndex > 0) {
      const results = await Promise.allSettled(
        Array.from({ length: run.currentStepIndex }, (_, i) =>
          wf.getStepKey(runId, i),
        ),
      );
      results.forEach((r, i) => {
        if (r.status === "fulfilled") stepKeys[i] = r.value as string;
      });
    }

    // Output pointer — only when done
    let outputPointer: string | null = null;
    if (run.status === "done") {
      outputPointer = await resolveOutputPointer(wf, runId, wfAddr);
    }

    return NextResponse.json({ success: true, run, stepKeys, outputPointer });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.shortMessage ?? e.message,
    });
  }
}
