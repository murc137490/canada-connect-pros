# Google AI (Gemini) setup — replace / prefer over Hugging Face

Première’s Support chat (`ai-chat-hf`) and hero search suggestions (`search-suggestions`) prefer **Google Gemini** when a key is present, and fall back to Hugging Face otherwise.

## Create an API key

1. Open [Google AI Studio → API keys](https://aistudio.google.com/apikey) and create a key.  
2. Docs: [Gemini API](https://ai.google.dev/gemini-api/docs) · [Models](https://ai.google.dev/gemini-api/docs/models) · [Embeddings](https://ai.google.dev/gemini-api/docs/embeddings)

## Supabase Edge secrets (not frontend `.env`)

```bash
supabase secrets set GOOGLE_GENERATIVE_AI_API_KEY=AIza...
# optional:
supabase secrets set GEMINI_CHAT_MODEL=gemini-3.6-flash
supabase secrets set GEMINI_EMBED_MODEL=gemini-embedding-001
```

Then redeploy:

```bash
supabase functions deploy ai-chat-hf
supabase functions deploy search-suggestions
```

## Behavior

| Secret | Effect |
|--------|--------|
| `GOOGLE_GENERATIVE_AI_API_KEY` set | Chat + embeddings prefer Gemini |
| `HUGGINGFACE_API_KEY` also set | **Recommended** — automatic fallback when Gemini is overloaded (503) |
| Only Hugging Face | HF path only |
| Neither | Soft fallback message with support email/phone (chat never hard-fails) |

Support chat failover order: primary Gemini model → retry → alternate Gemini models → Hugging Face → static contact message.

Do **not** put the Gemini key in Vite/`VITE_*` env vars.

**Always-available tip:** keep **both** `GOOGLE_GENERATIVE_AI_API_KEY` and `HUGGINGFACE_API_KEY` set in Edge secrets. Gemini spikes are temporary; HF covers them.
