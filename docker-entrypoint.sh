#!/bin/sh
set -eu

# Secrets are written here by the Infisical bootstrap job (docker) or mounted
# as a Kubernetes secret file. Runtime env from Infisical always wins.
if [ -f /shared/app.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /shared/app.env
  set +a
fi

exec node server.js
