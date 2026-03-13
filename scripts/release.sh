#!/bin/bash

set -euo pipefail

VERSION="${1:-}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  echo "用法: ./scripts/release.sh <version>"
  echo "示例: ./scripts/release.sh 0.1.0"
}

if [ -z "$VERSION" ]; then
  usage
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "错误: 版本号必须是 x.y.z"
  exit 1
fi

cd "$ROOT_DIR"

if [ -n "$(git status --porcelain)" ]; then
  echo "错误: 工作区存在未提交改动，请先提交或清理。"
  git status --short
  exit 1
fi

if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "错误: tag v$VERSION 已存在。"
  exit 1
fi

pnpm rebuild:node
pnpm typecheck
pnpm test
pnpm build

node -e '
const fs = require("node:fs");
const pkgPath = "package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.version = process.argv[1];
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
' "$VERSION"

git add package.json
git commit -m "chore(release): bump version to $VERSION"
git tag -a "v$VERSION" -m "Release v$VERSION"

CURRENT_BRANCH="$(git branch --show-current)"
git push origin "$CURRENT_BRANCH"
git push origin "v$VERSION"
