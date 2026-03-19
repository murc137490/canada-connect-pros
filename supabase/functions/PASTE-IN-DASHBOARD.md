# Paste in Supabase Dashboard → Edge Functions (Hugging Face)

All AI uses **Hugging Face** via the **new router** (`router.huggingface.co`). The old `api-inference.huggingface.co` URL is **deprecated** and returns an error.

**Token:** Use a token with **“Make calls to Inference Providers”** (fine-grained) or a **Write** classic token: [Create token](https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write&tokenType=fineGrained). Set it in Supabase → Edge Functions → Secrets as **HUGGINGFACE_API_KEY**.

---

## 1. Function: `search-suggestions` (Hero “Describe your project”)

**Name:** `search-suggestions`

Copy from **`supabase/functions/search-suggestions/index.ts`** in this repo (it already uses the router), or use the same logic: POST to `https://router.huggingface.co/v1/chat/completions` with `model`, `messages`, `max_tokens`, `temperature`. Parse `choices[0].message.content` for JSON `{ summary, suggestions }`.

---

## 2. Function: `ai-chat-hf` (Support page)

**Name:** `ai-chat-hf`

Replace all code in the function with the contents of **`supabase/functions/ai-chat-hf-ROUTER-CODE.ts`** in this repo. That file uses `https://router.huggingface.co/v1/chat/completions` and returns `{ message, sources }`.

---

## Checklist

1. **Secrets**: **HUGGINGFACE_API_KEY** = token with Inference API permission (see link above).
2. **search-suggestions**: paste repo version (router-based), deploy.
3. **ai-chat-hf**: paste **ai-chat-hf-ROUTER-CODE.ts**, deploy.
4. Redeploy both after changing the secret.
