#!/bin/sh
set -eu

DATA_DIR="${REELRELAY_DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"
chown node:node "$DATA_DIR"

exec su-exec node:node "$@"
