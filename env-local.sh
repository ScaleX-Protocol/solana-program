#!/bin/bash
# OpenBook V2 - Local Development Environment
# This script sets up project-specific versions without affecting system-wide installations

echo "🔧 Setting up OpenBook V2 local environment..."

# Use Solana 1.18.23+ from standard install location
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify we're in the right directory
if [ ! -f "COMPLETE_SETUP_GUIDE.md" ]; then
    echo "❌ Error: Please run this from /Users/renaka/gtx/openbook/"
    exit 1
fi

# Check versions
echo ""
echo "📦 Active Versions:"
echo "  Node:    $(node --version)"
echo "  Solana:  $(solana --version 2>/dev/null || echo 'Not installed')"
echo "  Anchor:  $(anchor --version 2>/dev/null || echo 'Not installed')"

# When you cd into openbook-v2, Rust version is automatic
cd openbook-v2
echo "  Rust:    $(rustc --version) (via rust-toolchain.toml)"
cd ..

echo ""
echo "✅ Environment ready!"
echo ""
echo "Next steps:"
echo "  cd openbook-v2"
echo "  cargo clean"
echo "  anchor build"
