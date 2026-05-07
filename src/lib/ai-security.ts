export const DEFAULT_GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";
export const DEFAULT_OPENROUTER_CHAT_MODEL = "google/gemma-3-12b-it:free";

const GROQ_CHAT_MODELS = new Set([
    DEFAULT_GROQ_CHAT_MODEL,
    "meta-llama/llama-4-scout-17b-16e-instruct",
]);

const OPENROUTER_CHAT_MODELS = new Set([
    DEFAULT_OPENROUTER_CHAT_MODEL,
]);

type AiProvider = "groq" | "openrouter";

type RateLimitBucket = {
    count: number;
    resetAt: number;
};

declare global {
    var __coaltradeAiRateLimits: Map<string, RateLimitBucket> | undefined;
}

const buckets = globalThis.__coaltradeAiRateLimits ?? new Map<string, RateLimitBucket>();
globalThis.__coaltradeAiRateLimits = buckets;

export function resolveAllowedChatModel(requestedModel: unknown): { provider: AiProvider; model: string } {
    const requested = typeof requestedModel === "string" ? requestedModel.trim() : "";

    if (requested && OPENROUTER_CHAT_MODELS.has(requested)) {
        return { provider: "openrouter", model: requested };
    }

    if (requested && GROQ_CHAT_MODELS.has(requested)) {
        return { provider: "groq", model: requested };
    }

    return { provider: "groq", model: DEFAULT_GROQ_CHAT_MODEL };
}

export function checkAiRateLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
    }

    if (existing.count >= limit) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        };
    }

    existing.count += 1;
    return {
        allowed: true,
        remaining: Math.max(0, limit - existing.count),
        retryAfterSeconds: Math.max(0, Math.ceil((existing.resetAt - now) / 1000)),
    };
}
