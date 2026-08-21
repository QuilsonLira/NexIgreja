#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

next_bin="${project_root}/node_modules/.bin/next"
if [[ ! -x "${next_bin}" ]]; then
  echo "Next.js não está instalado em node_modules." >&2
  exit 69
fi

echo "Running native Next.js build for Hostinger (.next output)..."
rm -rf "${project_root}/.next"
"${next_bin}" build --webpack

if [[ ! -d "${project_root}/.next" ]]; then
  echo "ERROR: Next.js build finished without creating .next" >&2
  exit 66
fi

if [[ ! -f "${project_root}/.next/BUILD_ID" ]]; then
  echo "ERROR: .next exists but BUILD_ID was not generated" >&2
  exit 66
fi

echo "Hostinger Next.js artifact ready: .next"
