#!/usr/bin/env bash
# Pull the configured Ollama model into the running stack's Ollama service.
# Use this if you skip the one-shot model-pull compose service, or to add
# another model later.
#
#   ./pull-model.sh              # pulls $OLLAMA_MODEL (default llama3.2)
#   ./pull-model.sh mistral      # pulls a specific model

set -euo pipefail

MODEL="${1:-${OLLAMA_MODEL:-llama3.2}}"

echo "==> Pulling Ollama model: ${MODEL}"
docker exec disputeguard-ollama ollama pull "${MODEL}"
echo "==> Done. Available models:"
docker exec disputeguard-ollama ollama list
