# DisputeGuard Infrastructure

Local stack: the Next.js app plus a local [Ollama](https://ollama.com) model
server that backs the bounded AI investigation.

## Run it

```bash
cd infra
OLLAMA_MODEL=llama3.2 docker compose up --build
```

This starts three things:

| Service      | Purpose                                                        |
|--------------|----------------------------------------------------------------|
| `ollama`     | Local LLM server on `:11434`, models persisted in a volume.    |
| `model-pull` | One-shot: pulls `$OLLAMA_MODEL` into Ollama, then exits.        |
| `web`        | The Next.js app on `:3000` (built from `apps/web/Dockerfile`). |

Then open **http://localhost:3000/console**.

The first `up` downloads the model (several hundred MB to a few GB depending on
the model), so it can take a while. Later starts reuse the cached volume.

## Configuration

Copy `../.env.example` to `../.env` (or export the variables) to change:

- `OLLAMA_MODEL` — which model to use (default `llama3.2`).
- `OLLAMA_BASE_URL` — Ollama endpoint (compose sets this to `http://ollama:11434`).
- `OLLAMA_TIMEOUT_MS` — per-request model timeout.

## Pulling another model later

```bash
./pull-model.sh mistral
```

## Graceful degradation

If Ollama is unreachable or a response is invalid, the investigation falls back
to a deterministic proposer. The allowlist, read-only tool execution, and the
iteration/tool-call budget are always enforced in application code — never
trusted from the model — so the bounded guarantees hold with or without a model.

## Running without Docker

```bash
# Terminal 1 — Ollama
ollama serve
ollama pull llama3.2

# Terminal 2 — the app
cd apps/web
OLLAMA_BASE_URL=http://localhost:11434 npm run dev
```
