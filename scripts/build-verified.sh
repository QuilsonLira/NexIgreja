#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

echo "HOSTINGER_NATIVE_NEXT_BUILD_2026_08_21"
echo "Building NexIgreja with native Next.js output (.next)..."

echo "Applying MySQL runtime compatibility and diagnostics..."
node "${project_root}/scripts/apply-mysql-runtime-patch.mjs"

next_bin="${project_root}/node_modules/.bin/next"
if [[ ! -x "${next_bin}" ]]; then
  echo "ERROR: Next.js binary not found in node_modules/.bin/next" >&2
  exit 69
fi

rm -rf "${project_root}/.next"
"${next_bin}" build --webpack

if [[ ! -d "${project_root}/.next" ]]; then
  echo "ERROR: Native Next.js build did not create .next" >&2
  exit 66
fi

if [[ ! -f "${project_root}/.next/BUILD_ID" ]]; then
  echo "ERROR: .next was created but BUILD_ID is missing" >&2
  exit 66
fi

echo "Hostinger output validated: .next/BUILD_ID exists"
echo "HOSTINGER_NATIVE_NEXT_BUILD_OK"
