#!/usr/bin/env bash
# deploy.sh — Push to GitHub and deploy to Vercel in one shot
# Usage: ./deploy.sh YOUR_GITHUB_USERNAME

set -e

USERNAME=${1:-"YOUR_GITHUB_USERNAME"}
REPO="devops-interview-coach"

echo "🚀 DevOps Interview Coach — Deploy Script"
echo "========================================="

# ── 1. Check prerequisites ──────────────────────────────────────
check_cmd() {
  if ! command -v "$1" &> /dev/null; then
    echo "❌ $1 not found. Please install it first."
    exit 1
  fi
}

check_cmd git
check_cmd node
check_cmd npm

echo "✅ Prerequisites OK"

# ── 2. Install npm deps ──────────────────────────────────────────
echo ""
echo "📦 Installing npm dependencies..."
npm install

# ── 3. Git init & push ───────────────────────────────────────────
echo ""
echo "📤 Pushing to GitHub..."

if [ ! -d ".git" ]; then
  git init
  git branch -M main
fi

git add .
git commit -m "feat: devops interview coach — AI mock interviews" 2>/dev/null || \
  git commit --allow-empty -m "chore: update"

# Check if remote exists
if ! git remote get-url origin &>/dev/null; then
  echo ""
  echo "👉 Creating GitHub repo... (you'll need a GitHub token)"
  echo "   Run this first:"
  echo "   gh repo create $REPO --public --source=. --remote=origin --push"
  echo ""
  echo "   Or manually:"
  echo "   git remote add origin https://github.com/$USERNAME/$REPO.git"
  echo "   git push -u origin main"
else
  git push origin main
  echo "✅ Pushed to GitHub"
fi

# ── 4. Vercel deploy ─────────────────────────────────────────────
echo ""
echo "🌐 Deploying to Vercel..."

if command -v vercel &> /dev/null; then
  vercel --prod
else
  echo ""
  echo "📋 Vercel CLI not found. Deploy manually:"
  echo ""
  echo "   Option A — Vercel Dashboard:"
  echo "   1. Go to https://vercel.com/new"
  echo "   2. Import github.com/$USERNAME/$REPO"
  echo "   3. Add env var: ANTHROPIC_API_KEY"
  echo "   4. Click Deploy"
  echo ""
  echo "   Option B — Install Vercel CLI:"
  echo "   npm i -g vercel && vercel --prod"
  echo ""
  echo "   Option C — One-click deploy button (in README.md)"
fi

echo ""
echo "✅ Done! Your DevOps Interview Coach is ready."
echo ""
echo "📌 Don't forget to set ANTHROPIC_API_KEY in Vercel:"
echo "   Dashboard → Settings → Environment Variables"
