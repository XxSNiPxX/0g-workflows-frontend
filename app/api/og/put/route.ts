import { keccak256 } from "ethers";
import fs from "fs";
import path from "path";

// Get paths from environment variables with sensible defaults
const BASE_DIR = process.env.STORE_BASE_PATH || process.cwd();
const STORE_DIR = process.env.STORE_DIR || path.join(BASE_DIR, "store-data");
const STORE_META =
  process.env.STORE_META || path.join(BASE_DIR, "store-meta.json");

function writeMeta(pointer: string, meta: Record<string, any>) {
  let store: Record<string, any> = {};
  if (fs.existsSync(STORE_META)) {
    try {
      store = JSON.parse(fs.readFileSync(STORE_META, "utf-8"));
    } catch {
      /* ok */
    }
  }
  store[pointer] = { ...meta, created: Date.now() };
  const tmp = STORE_META + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_META);
}

function writeFile(
  pointer: string,
  content: Buffer | string,
  meta: Record<string, any>,
) {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STORE_DIR, pointer.toLowerCase()), content);
  writeMeta(pointer.toLowerCase(), meta);
}

export async function POST(req: Request) {
  try {
    const { data, type, filename } = await req.json();
    if (!data) return Response.json({ error: "Missing data" }, { status: 400 });

    const pointer = keccak256(Buffer.from(data, "utf-8")).toLowerCase();
    writeFile(pointer, data, {
      type: type ?? "json",
      filename: filename ?? "data.json",
    });
    console.log("[STORE WRITE]", pointer);

    return Response.json({ pointer, mode: "local" });
  } catch (e: any) {
    console.error("[OG PUT ERROR]", e?.message);
    return Response.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
