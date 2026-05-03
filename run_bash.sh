#!/bin/bash

set -e

SOURCE=~/Downloads/files\(12\)
APP_SOURCE=~/Downloads/files\(12\)/mnt/user-data/outputs/0g-workflows-final/app

echo "=== Step 1: Copy flat files ==="
cp $SOURCE/*.ts .
cp $SOURCE/*.tsx .
cp $SOURCE/*.js .
cp $SOURCE/*.css .
cp $SOURCE/package.json . || true
cp $SOURCE/tsconfig.json . || true
cp $SOURCE/next.config.js . || true
cp $SOURCE/tailwind.config.js . || true
cp $SOURCE/postcss.config.js . || true

echo "=== Step 2: Copy app routes ==="
cp -r $APP_SOURCE/* app/

echo "=== Step 3: Create folders ==="
mkdir -p lib context components

echo "=== Step 4: Move core files ==="

# lib
mv contracts.ts lib/contracts.ts || true
mv types.ts lib/types.ts || true

# context
mv WalletContext.tsx context/WalletContext.tsx || true

# components
mv Nav.tsx components/Nav.tsx || true
mv MeshBackground.tsx components/MeshBackground.tsx || true
mv TypePill.tsx components/TypePill.tsx || true

echo "=== Step 5: Move root app files ==="
mv layout.tsx app/layout.tsx || true
mv globals.css app/globals.css || true
mv page.tsx app/page.tsx || true

echo "=== Step 6: Fix API root route if exists ==="
if [ -f route.ts ]; then
  mkdir -p app/api/agents
  mv route.ts app/api/agents/route.ts
fi

echo "=== DONE ==="
echo "Now run: npm run dev"
