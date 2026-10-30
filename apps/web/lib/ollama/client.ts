// Minimal Ollama client (https://github.com/ollama/ollama/blob/main/docs/api.md).
// Used for the structured proposal/summary steps of the bounded investigation.
// No SDK dependency — just fetch against the local Ollama server.

export type OllamaConfig = {
  baseUrl: string;
  model: string;
  // Per-request timeout in ms; keeps a slow/hung model from blocking a case.
  timeoutMs: number;
};

export function configFromEnv(): OllamaConfig {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    model: process.env.OLLAMA_MODEL ?? "llama3.2",
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? "20000"),
  };
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class OllamaClient {
  constructor(private readonly config: OllamaConfig = configFromEnv()) {}

  get model(): string {
    return this.config.model;
  }

  // Is the Ollama server reachable? Used to decide whether to fall back to a
  // deterministic proposer.
  async isReachable(): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${this.config.baseUrl}/api/tags`, { method: "GET" }, 2500);
      return res.ok;
    } catch {
      return false;
    }
  }

  // Ask the model for a JSON object. Returns the parsed value, or null if the
  // call fails or the response is not valid JSON (the caller then falls back).
  async chatJson(messages: ChatMessage[]): Promise<unknown | null> {
    try {
      const res = await this.fetchWithTimeout(
        `${this.config.baseUrl}/api/chat`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: this.config.model,
            messages,
            stream: false,
            format: "json",
            options: { temperature: 0 },
          }),
        },
        this.config.timeoutMs,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { message?: { content?: string } };
      const content = data.message?.content;
      if (!content) return null;
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
