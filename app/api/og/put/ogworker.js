const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const wallets = JSON.parse(
  fs.readFileSync("./deployments/wallets.json", "utf-8"),
);
const provider = new ethers.JsonRpcProvider(wallets.rpc);
const signer = new ethers.Wallet(wallets.agents[0].privateKey, provider);

console.log("======================================");
console.log("Worker address:", signer.address);
console.log("RPC URL:", wallets.rpc);
console.log("======================================");

const agentsJson = JSON.parse(
  fs.readFileSync("./deployments/agents_new.json", "utf-8"),
);
const AGENTS = Object.entries(agentsJson.agents)
  .filter(([k]) => k.endsWith("_diamond"))
  .map(([, v]) => v.toLowerCase());

console.log("Watching agents:", AGENTS);

// ─── PATHS ────────────────────────────────────────────────────────────────────

const BASE_DIR = "/home/snip/Projects/web3/0g/0g-workflows-frontend";
const STORE_DIR = path.join(BASE_DIR, "store-data"); // one file per pointer
const STORE_META = path.join(BASE_DIR, "store-meta.json"); // { pointer: { type, filename } }
const OUTPUTS_PATH = path.join(BASE_DIR, "run-outputs.json");

console.log("STORE DIR:   ", STORE_DIR);
console.log("OUTPUTS PATH:", OUTPUTS_PATH);
if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });

// ─── HELIUS ───────────────────────────────────────────────────────────────────

const HELIUS_KEY = "80733d65-cc4a-45bd-986b-010b03859cc6";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

async function rpc(method, params) {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

async function fetchWalletData(address) {
  address = address.trim();
  console.log("[AGENT1] Fetching wallet:", address);

  // SOL balance
  const balResult = await rpc("getBalance", [address]);
  const solBalance = (balResult?.value ?? 0) / 1e9;

  // SPL tokens
  const tokenResult = await rpc("getTokenAccountsByOwner", [
    address,
    { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
    { encoding: "jsonParsed" },
  ]);

  const tokens = (tokenResult?.value ?? [])
    .map((t) => {
      const info = t.account?.data?.parsed?.info;
      if (!info) return null;
      return {
        mint: info.mint,
        amount: info.tokenAmount?.uiAmount ?? 0,
        decimals: info.tokenAmount?.decimals ?? 0,
      };
    })
    .filter((t) => t && t.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 30); // top 30

  // Try to get token names via Helius DAS (best-effort)
  let enriched = tokens;
  try {
    const mints = tokens.map((t) => t.mint);
    if (mints.length > 0) {
      const assetRes = await rpc("getAssetBatch", [
        { ids: mints.slice(0, 20) },
      ]);
      const nameMap = {};
      (assetRes ?? []).forEach((a) => {
        if (a?.id)
          nameMap[a.id] =
            a?.content?.metadata?.symbol || a?.content?.metadata?.name || null;
      });
      enriched = tokens.map((t) => ({
        ...t,
        symbol: nameMap[t.mint] || t.mint.slice(0, 8),
      }));
    }
  } catch {
    enriched = tokens.map((t) => ({ ...t, symbol: t.mint.slice(0, 8) }));
  }

  return {
    address,
    solBalance,
    tokens: enriched,
    fetchedAt: new Date().toISOString(),
    network: "mainnet-beta",
  };
}

// ─── LATEX REPORT ─────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(
      /[&%$#_{}~^<>]/g,
      (c) =>
        ({
          "&": "\\&",
          "%": "\\%",
          $: "\\$",
          "#": "\\#",
          _: "\\_",
          "{": "\\{",
          "}": "\\}",
          "~": "\\textasciitilde{}",
          "^": "\\textasciicircum{}",
          "<": "\\textless{}",
          ">": "\\textgreater{}",
        })[c],
    );
}

async function generateReport(walletJsonStr) {
  const data = JSON.parse(walletJsonStr);
  const { address, solBalance, tokens, fetchedAt } = data;

  // Top assets for chart (SOL + up to 7 tokens)
  const chartAssets = [
    { symbol: "SOL", amount: solBalance },
    ...tokens.slice(0, 7),
  ].filter((a) => a.amount > 0);

  const symbolic = chartAssets.map((a) => esc(a.symbol)).join(",");
  const barCoords = chartAssets
    .map((a) => `(${esc(a.symbol)},${Number(a.amount).toFixed(4)})`)
    .join(" ");

  const tokenTableRows = tokens
    .slice(0, 25)
    .map(
      (t, i) =>
        `${i + 1} & ${esc(t.symbol)} & \\small\\texttt{${esc(t.mint)}} & ${Number(t.amount).toFixed(4)}`,
    )
    .join(" \\\\\n    ");

  const latex = `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=2cm]{geometry}
\\usepackage{pgfplots}
\\usepackage{booktabs}
\\usepackage{xcolor}
\\usepackage{hyperref}
\\usepackage{array}
\\pgfplotsset{compat=1.18}
\\definecolor{solana}{HTML}{9945FF}

\\title{\\textbf{Solana Wallet Report}\\\\[0.4em]\\large 0G Workflows AI Agent}
\\date{${esc(fetchedAt)}}
\\author{}

\\begin{document}
\\maketitle
\\vspace{-1cm}
\\hrule
\\vspace{0.5cm}

\\section*{Wallet Address}
{\\small\\texttt{${esc(address)}}}

\\section*{Summary}
\\begin{itemize}
  \\item \\textbf{SOL Balance:} ${solBalance.toFixed(6)} SOL
  \\item \\textbf{SPL Tokens:} ${tokens.length} token${tokens.length !== 1 ? "s" : ""} held
  \\item \\textbf{Fetched:} ${esc(fetchedAt)}
\\end{itemize}

${
  chartAssets.length > 1
    ? `
\\section*{Balance Distribution}
\\begin{tikzpicture}
\\begin{axis}[
  ybar,
  bar width=14pt,
  xlabel={Asset},
  ylabel={Amount},
  symbolic x coords={${symbolic}},
  xtick=data,
  x tick label style={rotate=30, anchor=east, font=\\small},
  width=\\linewidth,
  height=7cm,
  enlarge x limits=0.15,
  grid=major,
  grid style={dashed,gray!30},
  nodes near coords,
  nodes near coords style={font=\\tiny, rotate=45, anchor=west},
  bar shift=0pt,
  fill=solana!70,
  draw=solana
]
\\addplot coordinates { ${barCoords} };
\\end{axis}
\\end{tikzpicture}
`
    : ""
}

${
  tokens.length > 0
    ? `
\\section*{Token Holdings}
\\begin{center}
\\begin{tabular}{rlp{7cm}r}
\\toprule
\\# & Symbol & Mint Address & Amount \\\\
\\midrule
${tokenTableRows} \\\\
\\bottomrule
\\end{tabular}
\\end{center}
`
    : "\\section*{Token Holdings}\nNo SPL tokens found."
}

\\vspace{1cm}
\\hrule
\\begin{center}
  \\small Generated by 0G Workflows \\textbullet\\ ${esc(new Date().toISOString())}
\\end{center}
\\end{document}
`;

  const stamp = Date.now();
  const tmpDir = os.tmpdir();
  const texFile = path.join(tmpDir, `wf-report-${stamp}.tex`);
  const pdfFile = path.join(tmpDir, `wf-report-${stamp}.pdf`);

  fs.writeFileSync(texFile, latex, "utf-8");

  try {
    execSync(
      `pdflatex -interaction=nonstopmode -output-directory "${tmpDir}" "${texFile}"`,
      { timeout: 45000, stdio: "pipe" },
    );
    // Run twice for proper layout
    execSync(
      `pdflatex -interaction=nonstopmode -output-directory "${tmpDir}" "${texFile}"`,
      { timeout: 45000, stdio: "pipe" },
    );
  } catch (e) {
    // pdflatex often exits non-zero even on success; check for output file
  }

  if (!fs.existsSync(pdfFile)) {
    throw new Error(
      "pdflatex did not produce a PDF. Install: sudo apt install texlive-latex-extra texlive-pictures texlive-science",
    );
  }

  const pdfBuffer = fs.readFileSync(pdfFile);

  // Cleanup temp files
  for (const ext of ["tex", "pdf", "aux", "log", "out"]) {
    try {
      fs.unlinkSync(path.join(tmpDir, `wf-report-${stamp}.${ext}`));
    } catch {
      /* ok */
    }
  }

  return pdfBuffer;
}

// ─── STORE (folder-based) ─────────────────────────────────────────────────────

function writeMeta(pointer, meta) {
  let store = {};
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

function writeStoreFile(pointer, content, meta) {
  // content: Buffer or string
  const key = norm(pointer);
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STORE_DIR, key), content);
  writeMeta(key, meta);
  console.log(
    "[STORE WRITE]",
    key,
    meta.type,
    typeof content === "string"
      ? content.length + " chars"
      : content.length + " bytes",
  );
}

function writeRunOutput(workflow, runId, outputPointer) {
  let outputs = {};
  if (fs.existsSync(OUTPUTS_PATH)) {
    try {
      outputs = JSON.parse(fs.readFileSync(OUTPUTS_PATH, "utf-8"));
    } catch {
      /* ok */
    }
  }
  const key = `${norm(workflow)}:${runId}`;
  outputs[key] = norm(outputPointer);
  const tmp = OUTPUTS_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(outputs, null, 2));
  fs.renameSync(tmp, OUTPUTS_PATH);
  console.log("[RUN OUTPUT]", key, "→", norm(outputPointer));
}

function readStoreFile(pointer) {
  const key = norm(pointer);
  const filePath = path.join(STORE_DIR, key);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath); // returns Buffer
}

// ─── ABI / EVENTS ─────────────────────────────────────────────────────────────

const agentAbi = [
  "function getPendingRequests() view returns (bytes32[])",
  "function getOutputType() view returns (bytes32)",
  "function complete(bytes32,bytes32,bytes32,bytes32,bytes32,uint8)",
];

const STEP_REQUESTED_TOPIC = ethers.id(
  "StepRequested(bytes32,uint256,uint256,address,uint256,bytes32,bytes32,address)",
);
const agentIface = new ethers.Interface([
  "event StepRequested(bytes32 indexed requestKey, uint256 runId, uint256 stepIndex, address user, uint256 tokenId, bytes32 inputPointer, bytes32 inputType, address workflow)",
]);

// ─── STATE ────────────────────────────────────────────────────────────────────

let nonce;
const seen = new Set();
const keyCache = {}; // requestKey → { inputPointer, runId, stepIndex, workflow }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (p) => (typeof p === "string" ? p.toLowerCase() : p);

// ─── RESOLVE REQUEST ──────────────────────────────────────────────────────────

async function resolveRequest(agentAddr, requestKey) {
  if (keyCache[requestKey]) return keyCache[requestKey];
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 50000);
  const logs = await provider.getLogs({
    address: agentAddr,
    topics: [STEP_REQUESTED_TOPIC, requestKey],
    fromBlock,
    toBlock: "latest",
  });
  if (!logs.length) {
    console.log("[LOG QUERY] not found");
    return null;
  }
  const parsed = agentIface.parseLog(logs[0]);
  const info = {
    inputPointer: norm(parsed.args.inputPointer),
    runId: parsed.args.runId.toString(),
    stepIndex: Number(parsed.args.stepIndex),
    workflow: parsed.args.workflow,
  };
  keyCache[requestKey] = info;
  console.log(
    "[LOG QUERY] inputPointer:",
    info.inputPointer,
    "runId:",
    info.runId,
    "step:",
    info.stepIndex,
  );
  return info;
}

// ─── EXECUTE ──────────────────────────────────────────────────────────────────

async function execute(agentAddr, requestKey) {
  const key = norm(requestKey);
  const id = `${agentAddr}-${key}`;
  if (seen.has(id)) return;
  seen.add(id);

  try {
    console.log("\n=========== EXEC START ===========");
    console.log("Agent:      ", agentAddr);
    console.log("Request key:", key);

    const agent = new ethers.Contract(agentAddr, agentAbi, signer);
    const info = await resolveRequest(agentAddr, key);

    if (!info) {
      console.log("❌ Could not resolve request, failing");
      await agent.complete(
        key,
        ethers.ZeroHash,
        await agent.getOutputType(),
        ethers.ZeroHash,
        ethers.ZeroHash,
        1,
        { nonce, gasLimit: 300000 },
      );
      nonce++;
      return;
    }

    // Read input — could be a plain address (step 0) or JSON (step 1)
    const inputBuf = readStoreFile(info.inputPointer);
    let inputStr;
    if (inputBuf) {
      inputStr = inputBuf.toString("utf-8");
    } else {
      // Backward compat: check old store.json
      const oldStore = fs.existsSync(path.join(BASE_DIR, "store.json"))
        ? JSON.parse(
            fs.readFileSync(path.join(BASE_DIR, "store.json"), "utf-8"),
          )
        : {};
      inputStr = oldStore[info.inputPointer] ?? null;
    }

    if (!inputStr) {
      console.log("❌ POINTER NOT FOUND in store:", info.inputPointer);
      await agent.complete(
        key,
        ethers.ZeroHash,
        await agent.getOutputType(),
        ethers.ZeroHash,
        ethers.ZeroHash,
        1,
        { nonce, gasLimit: 300000 },
      );
      nonce++;
      return;
    }

    console.log("✅ INPUT:", inputStr.slice(0, 120));

    // ── DISPATCH BY STEP ───────────────────────────────────────────────────────
    let outputContent; // Buffer
    let outputMeta; // { type, filename }

    if (info.stepIndex === 0) {
      // ── AGENT 1: Fetch Solana wallet data ──────────────────────────────────
      console.log("[AGENT 1] Fetching Solana wallet data…");
      const walletData = await fetchWalletData(inputStr.trim());
      const jsonStr = JSON.stringify(walletData, null, 2);
      outputContent = Buffer.from(jsonStr, "utf-8");
      outputMeta = {
        type: "json",
        filename: `wallet-${inputStr.trim().slice(0, 8)}.json`,
      };
      console.log(
        "[AGENT 1] SOL:",
        walletData.solBalance,
        "Tokens:",
        walletData.tokens.length,
      );
    } else {
      // ── AGENT 2: Generate LaTeX PDF report ────────────────────────────────
      console.log("[AGENT 2] Generating LaTeX PDF report…");
      outputContent = await generateReport(inputStr);
      outputMeta = { type: "pdf", filename: "wallet-report.pdf" };
      console.log("[AGENT 2] PDF size:", outputContent.length, "bytes");
    }

    // ── WRITE OUTPUT ───────────────────────────────────────────────────────────
    const outputPointer = norm(
      ethers.keccak256(
        ethers.toUtf8Bytes(
          outputContent.toString("utf-8").slice(0, 1024) + outputContent.length,
        ),
      ),
    );
    // Use hash of content for uniqueness
    const outputHash = ethers.keccak256(outputContent);
    const outputPtr = norm(outputHash);

    writeStoreFile(outputPtr, outputContent, outputMeta);
    writeRunOutput(info.workflow, info.runId, outputPtr);

    // ── COMPLETE ON-CHAIN ──────────────────────────────────────────────────────
    const outputType = await agent.getOutputType();
    console.log("[RPC CALL] complete (SUCCESS), nonce:", nonce);

    const tx = await agent.complete(
      key,
      outputPtr,
      outputType,
      outputHash,
      ethers.ZeroHash,
      0,
      { nonce, gasLimit: 800000 },
    );
    console.log("TX:", tx.hash);
    nonce++;

    const receipt = await tx.wait();
    console.log("[RECEIPT]", receipt.status);
    console.log("=========== EXEC END ===========");
  } catch (e) {
    console.log("[EXEC ERROR]", e.shortMessage || e.message);
    nonce = await provider.getTransactionCount(signer.address, "pending");
    console.log("[NONCE RESET]", nonce);
    seen.delete(id);
  }
}

// ─── POLL ─────────────────────────────────────────────────────────────────────

async function pollPending() {
  console.log("\n------ POLL START ------");
  for (const agentAddr of AGENTS) {
    try {
      const agent = new ethers.Contract(agentAddr, agentAbi, provider);
      const pending = await agent.getPendingRequests();
      console.log(`[${agentAddr.slice(0, 10)}…] pending: ${pending.length}`);
      for (const key of pending) await execute(agentAddr, key);
    } catch (e) {
      console.log("[POLL ERROR]", e.message);
    }
  }
  console.log("------ POLL END ------\n");
}

async function main() {
  nonce = await provider.getTransactionCount(signer.address, "pending");
  console.log("[NONCE INIT]", nonce);
  while (true) {
    try {
      console.log("[RPC] block:", await provider.getBlockNumber());
    } catch (e) {
      console.log("[RPC ERROR]", e.message);
    }
    await pollPending();
    await sleep(1500);
  }
}

main();
