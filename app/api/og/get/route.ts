import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Get paths from environment variables with sensible defaults
const BASE_DIR = process.env.STORE_BASE_PATH || process.cwd();
const STORE_DIR = process.env.STORE_DIR || path.join(BASE_DIR, "store-data");
const STORE_META =
  process.env.STORE_META || path.join(BASE_DIR, "store-meta.json");
const LEGACY =
  process.env.LEGACY_STORE_PATH || path.join(BASE_DIR, "store.json");

function getMeta(p: string) {
  try {
    if (!fs.existsSync(STORE_META)) return null;
    return JSON.parse(fs.readFileSync(STORE_META, "utf-8"))[p] ?? null;
  } catch {
    return null;
  }
}

function readPointer(
  pointer: string,
): { content: Buffer; meta: Record<string, any> } | null {
  const p = pointer.toLowerCase();
  const fp = path.join(STORE_DIR, p);

  if (fs.existsSync(fp)) {
    return {
      content: fs.readFileSync(fp),
      meta: getMeta(p) ?? { type: "json" },
    };
  }

  // Legacy store.json
  if (fs.existsSync(LEGACY)) {
    try {
      const store = JSON.parse(fs.readFileSync(LEGACY, "utf-8"));
      if (store[p])
        return {
          content: Buffer.from(store[p], "utf-8"),
          meta: { type: "json" },
        };
    } catch {
      /* ok */
    }
  }

  return null;
}

// Handles both normal reads and file downloads (download=1 query param)
async function handle(pointer: string | null, forDownload: boolean) {
  if (!pointer)
    return Response.json({ error: "Missing pointer" }, { status: 400 });

  const result = readPointer(pointer);
  if (!result) {
    console.log("[OG GET] not found:", pointer.toLowerCase().slice(0, 20));
    return Response.json({ data: null, mode: "not-found" }, { status: 404 });
  }

  const { content, meta } = result;
  const isPdf = meta?.type === "pdf";
  const filename =
    meta?.filename ?? (isPdf ? "wallet-report.pdf" : "output.json");

  if (forDownload) {
    // Serve as raw file download
    return new Response(content, {
      headers: {
        "Content-Type": isPdf ? "application/pdf" : "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(content.length),
      },
    });
  }

  // Normal JSON API response
  if (isPdf) {
    return Response.json({
      data: content.toString("base64"),
      type: "pdf",
      filename: filename,
      mode: "local",
    });
  }
  return Response.json({
    data: content.toString("utf-8"),
    type: "json",
    mode: "local",
  });
}

export async function GET(req: NextRequest) {
  const pointer = req.nextUrl.searchParams.get("pointer");
  const download = req.nextUrl.searchParams.get("download") === "1";
  return handle(pointer, download);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return handle(body?.pointer ?? null, false);
  } catch (e: any) {
    return Response.json({ error: e?.message }, { status: 500 });
  }
}
