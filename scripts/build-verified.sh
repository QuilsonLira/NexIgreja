#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

command -v timeout >/dev/null || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

echo "Running bounded vinext build..."
timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build

"${script_dir}/validate-artifact.sh"

# Hostinger's "Other" Node.js deployment works best with a top-level
# output directory and a conventional entry file. Vinext's real standalone
# server remains in dist/standalone; this tiny entrypoint only starts it.
[[ -f "${SITES_PROJECT_ROOT}/dist/standalone/server.js" ]] || {
  echo "Missing Vinext standalone server: dist/standalone/server.js" >&2
  exit 66
}
cat > "${SITES_PROJECT_ROOT}/dist/server.js" <<'EOF'
import "./standalone/server.js";
EOF

echo "Hostinger Node entry prepared: dist/server.js"
