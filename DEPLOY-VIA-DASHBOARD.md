# Deploy Edge Functions via Supabase Dashboard (Hugging Face)

This project uses **Hugging Face** for all AI (no OpenAI/ChatGPT).

1. **Secrets**: In **Edge Functions** → **Secrets**, add **HUGGINGFACE_API_KEY** (your token from https://huggingface.co/settings/tokens).

2. **Support page**: The app calls **`ai-chat-hf`**. If you already deployed it, you’re set. Otherwise create a function named **`ai-chat-hf`** that uses the Hugging Face Inference API (e.g. Mistral) and returns `{ message: "..." }` for POST `{ message: "..." }`.

3. **Hero “Describe your project”**: Create or open a function named **`search-suggestions`** and paste the code from **`supabase/functions/PASTE-IN-DASHBOARD.md`** (the full Hugging Face version). Deploy.

4. **Redeploy** both functions after adding or changing **HUGGINGFACE_API_KEY**.

The app calls:
- `.../functions/v1/ai-chat-hf` (Support, requires login)
- `.../functions/v1/search-suggestions` (Hero, no login)
