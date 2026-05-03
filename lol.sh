#!/bin/bash

echo "=== VERIFYING PROJECT STRUCTURE ==="

check() {
  if [ -e "$1" ]; then
    echo "✔ $1"
  else
    echo "❌ MISSING: $1"
  fi
}

echo ""
echo "=== ROOT FILES ==="
check "package.json"
check "tsconfig.json"
check "next.config.js"
check "tailwind.config.js"
check "postcss.config.js"

echo ""
echo "=== LIB ==="
check "lib/contracts.ts"
check "lib/types.ts"

echo ""
echo "=== CONTEXT ==="
check "context/WalletContext.tsx"

echo ""
echo "=== COMPONENTS ==="
check "components/Nav.tsx"
check "components/MeshBackground.tsx"
check "components/TypePill.tsx"

echo ""
echo "=== APP CORE ==="
check "app/layout.tsx"
check "app/page.tsx"
check "app/globals.css"

echo ""
echo "=== PAGES ==="
check "app/agents/page.tsx"
check "app/builder/page.tsx"
check "app/runs/page.tsx"
check "app/dashboard/page.tsx"

echo ""
echo "=== API ROUTES ==="
check "app/api/agents/route.ts"
check "app/api/workflows/route.ts"
check "app/api/runs/route.ts"
check "app/api/inft/route.ts"
check "app/api/network/route.ts"
check "app/api/health/route.ts"

echo ""
echo "=== DONE ==="
