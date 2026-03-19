# Deploy Edge Functions (Hugging Face)

The app uses **Hugging Face** for all AI features (no OpenAI/ChatGPT).

**Required functions:**
- **`ai-chat-hf`** — Support page AI assistant (you may already have this).
- **`search-suggestions`** — Hero “Describe your project” suggestions.

**Secrets** (Dashboard → Edge Functions → Secrets):
- `HUGGINGFACE_API_KEY` — your Hugging Face API token (https://huggingface.co/settings/tokens)
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are usually set automatically.

---

## Option A: Deploy from CLI

From the project root:

```bash
supabase link --project-ref hptzapnrnbqlptrstjxo
supabase functions deploy ai-chat-hf
supabase functions deploy search-suggestions
```

Then set **HUGGINGFACE_API_KEY** in the Dashboard (Edge Functions → Secrets) if not already set.

---

## Option B: Deploy from Supabase Dashboard

1. **Edge Functions** → Create or open **`ai-chat-hf`** (Support chat) and **`search-suggestions`** (hero suggestions).
2. Paste the code from this repo:
   - `supabase/functions/ai-chat-hf` (if you have it locally) or keep your existing deployment.
   - `supabase/functions/search-suggestions/index.ts` for the hero AI.
3. Add secret **HUGGINGFACE_API_KEY** and Deploy.

---

## After deploy

- **ai-chat-hf**: Support page; user must be signed in. Sends `Authorization: Bearer <user JWT>`.
- **search-suggestions**: Hero “Describe your project”; no login. Uses anon key in headers.

Redeploy after changing secrets so they are picked up.
