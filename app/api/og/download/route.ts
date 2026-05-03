// GET /api/og/download/[pointer]
// Serves the stored file (PDF or JSON) as a download
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Get base directory from env, fall back to process.cwd()
const BASE_DIR = process.env.STORE_BASE_PATH || process.cwd();
const STORE_DIR = process.env.STORE_DIR || path.join(BASE_DIR, "store-data");
const STORE_META =
  process.env.STORE_META || path.join(BASE_DIR, "store-meta.json");
const LEGACY_STORE =
  process.env.LEGACY_STORE_PATH || path.join(BASE_DIR, "store.json");

export async function GET(
  _req: NextRequest,
  { params }: { params: { pointer: string } },
) {
  const p = params.pointer.toLowerCase();

  let content: Buffer | null = null;
  let meta: Record<string, any> = { type: "json", filename: "output.json" };

  // 1. New folder store
  const filePath = path.join(STORE_DIR, p);
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath);
    if (fs.existsSync(STORE_META)) {
      try {
        const m = JSON.parse(fs.readFileSync(STORE_META, "utf-8"));
        if (m[p]) meta = m[p];
      } catch {
        /* ok */
      }
    }
  }

  // 2. Legacy store.json fallback
  if (!content && fs.existsSync(LEGACY_STORE)) {
    try {
      const store = JSON.parse(fs.readFileSync(LEGACY_STORE, "utf-8"));
      if (store[p]) content = Buffer.from(store[p], "utf-8");
    } catch {
      /* ok */
    }
  }

  if (!content) {
    return new Response("Not found", { status: 404 });
  }

  const isPdf = meta.type === "pdf";
  const contentType = isPdf ? "application/pdf" : "application/json";
  const filename =
    meta.filename ?? (isPdf ? "wallet-report.pdf" : "wallet-data.json");

  return new Response(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(content.length),
    },
  });
}
