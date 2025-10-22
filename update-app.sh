#!/bin/bash

# Q-Shape Component Update Script
# This script helps you update src/App.js with your complete component code

echo "🔬 Q-Shape Component Update Helper"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the q-shape project root directory"
    exit 1
fi

echo "📝 Instructions:"
echo "1. Copy your complete component code to your clipboard"
echo "2. The code should start with:"
echo "   import React, { useEffect, useMemo, useRef, useState, useCallback } from \"react\";"
echo "3. And end with:"
echo "   export default function CoordinationGeometryAnalyzer() { ... }"
echo ""

read -p "Press Enter when you've copied your code and are ready to paste it..."

echo ""
echo "Creating backup of current App.js..."
cp src/App.js src/App.js.backup
echo "✅ Backup saved as src/App.js.backup"

echo ""
echo "Now paste your complete component code and press Ctrl+D when done:"
echo "(Each line you paste will be saved to src/App.js)"
echo ""
echo "----------------------------------------"

# Read the pasted code into the file
cat > src/App.js

echo "----------------------------------------"
echo ""
echo "✅ src/App.js has been updated!"
echo ""
echo "🧪 Next steps:"
echo "1. Test locally: npm start"
echo "2. Commit: git add src/App.js && git commit -m 'Add complete Q-Shape component'"
echo "3. Push: git push"
echo "4. Merge your PR to main to trigger deployment"
echo ""
echo "If something went wrong, restore the backup:"
echo "  cp src/App.js.backup src/App.js"
