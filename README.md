## Canada Connect Pros

React + Vite + TypeScript front-end for a Canadian home services marketplace, using Supabase for authentication/database and Supabase Edge Functions for AI-powered features.

### Tech stack

- **Frontend**: Vite, React, TypeScript, Tailwind CSS, shadcn-ui, React Router
- **Backend**: Supabase (Postgres, Auth, Edge Functions)
- **AI**: Hugging Face Inference API (Mistral) via Supabase Edge Functions

### Getting started

1. **Install dependencies**

```bash
npm install
```

2. **Configure environment variables**

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-or-publishable-key>
```

In your Supabase project, configure Edge Function secrets (Settings → Edge Functions):

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are usually set automatically.
- `HUGGINGFACE_API_KEY` = your Hugging Face API token (from https://huggingface.co/settings/tokens)

3. **Run the dev server**

```bash
npm run dev
```

### Supabase & authentication

- The app uses Supabase auth via the `supabase` client in `src/integrations/supabase/client.ts`.
- `AuthContext` in `src/contexts/AuthContext.tsx` provides session/user state and sign-in/sign-up helpers.

### Pro approval (pending until admin)

- When a pro submits **Create Pro Account**, their row in **`pro_profiles`** is created with **`is_verified: false`** (pending).
- **Public listings** (e.g. “Find pros” on a service) only show profiles where **`is_verified = true`**.
- **As admin:** In Supabase go to **Table Editor → `pro_profiles`**, find the pro’s row, set **`is_verified`** to **`true`** and save. They then appear in search results for clients.

### Pro profile photos (Create Pro Account)

- The **Create Pro Account** page uploads profile and before/after photos (PNG, JPG) to Supabase Storage.
- Create a Storage bucket named **`pro-photos`** in your Supabase project (Storage → New bucket).
- Set the bucket to **public** (or add a policy that allows public read) and allow **authenticated** uploads (e.g. policy: `authenticated` users can `INSERT`, public can `SELECT`). Without this bucket, uploads will fail with a storage error.

### AI / Hugging Face integration

- **Support page**: The AI assistant uses the **`ai-chat-hf`** Edge Function, which calls the Hugging Face Inference API (e.g. Mistral-7B-Instruct) to answer questions. Deploy **`ai-chat-hf`** and set **`HUGGINGFACE_API_KEY`** in Supabase Edge Function secrets.
- **Hero “Describe your project”**: The home page uses the **`search-suggestions`** Edge Function, which also uses Hugging Face to summarize the user’s request and suggest matching services. Deploy **`search-suggestions`** and set **`HUGGINGFACE_API_KEY`** in Edge Function secrets.
- No OpenAI or ChatGPT is used; all AI features run on Hugging Face.

### Troubleshooting: AI not connecting

If the **AI Support assistant** (Support page) or the **hero “Describe your project”** suggestions don’t work, check the following.

**1. On this side (your app / .env)**

- In the project root you must have a **`.env`** file with:
  - `VITE_SUPABASE_URL` = your Supabase project URL (e.g. `https://xxxxx.supabase.co`)
  - `VITE_SUPABASE_ANON_KEY` = the **anon public** key from Supabase (Project Settings → API → “anon public”), not the service role key.
- Restart the dev server after changing `.env` (`npm run dev`).

**2. Supabase: Edge Function secrets**

- In **Supabase Dashboard** go to **Project Settings** (gear) → **Edge Functions**.
- Under **Secrets**, add:
  - **Name:** `HUGGINGFACE_API_KEY` (exact spelling).
  - **Value:** your Hugging Face API token (from https://huggingface.co/settings/tokens).
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are usually set automatically.

**3. Deploy the AI functions**

- The app uses two Edge Functions:
  - **`ai-chat-hf`** — Support page AI assistant (Hugging Face / Mistral).
  - **`search-suggestions`** — Hero “Describe your project” (Hugging Face).
- Deploy them from the Supabase Dashboard or via CLI. After changing secrets, **redeploy** so they pick up the new values.

**4. AI Support assistant (Support page) only**

- You must be **signed in**. If you’re not logged in, the chat returns “Please sign in to use the AI assistant.”
- If you see **“Invalid API key”** or 401: ensure you’re logged in and `.env` has `VITE_SUPABASE_ANON_KEY` equal to Supabase → Project Settings → API → anon public key.
- If the error mentions **HUGGINGFACE_API_KEY**: add `HUGGINGFACE_API_KEY` in Edge Function secrets and redeploy **`ai-chat-hf`**.

**5. Hero “Describe your project” only**

- No login required. If suggestions never appear, open the browser **Developer console** (F12 → Console) for the backend error.
- Ensure **`search-suggestions`** is deployed and **`HUGGINGFACE_API_KEY`** is set in Edge Function secrets; then redeploy **`search-suggestions`**.

**6. Quick checklist**

| Check | Where |
|-------|--------|
| `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` | Project root |
| Supabase secret `HUGGINGFACE_API_KEY` is set | Dashboard → Project Settings → Edge Functions |
| Functions `ai-chat-hf` and `search-suggestions` are deployed | Dashboard → Edge Functions |
| For Support page: you are logged in | App |
| Redeploy functions after changing secrets | Supabase Dashboard |

---

### Deploy to GitHub and Vercel

**1. Put the project on GitHub**

- Create a new repository on [GitHub](https://github.com/new) (e.g. `canada-connect-pros`). Do **not** add a README, .gitignore, or license yet.
- On your computer, open a terminal in the **inner** project folder (where `package.json` and `src` live):

```bash
cd "C:\Users\aymen\Downloads\canada-connect-pros-main\canada-connect-pros-main"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

- Use your actual GitHub username and repo name in the `origin` URL.
- Your `.env` is in `.gitignore`, so it will **not** be pushed (keep it that way).

**2. Deploy on Vercel**

- Go to [vercel.com](https://vercel.com) and sign in (GitHub is easiest).
- Click **Add New… → Project** and import your GitHub repo.
- **Framework Preset**: Vite (Vercel usually detects it).
- **Root Directory**: leave blank if the repo root is the Vite project; if your repo has an outer folder and the Vite app is inside (e.g. `canada-connect-pros-main`), set **Root Directory** to that folder.
- **Environment variables** (add these in the Vercel project settings):
  - `VITE_SUPABASE_URL` = your Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` = your Supabase anon (public) key
- Click **Deploy**. Vercel will build with `npm run build` and host the site.

**3. After deploy**

- Your site will be at `https://your-project.vercel.app`.
- The app talks to Supabase and your **Supabase Edge Functions** (e.g. `chat`) by URL; no extra config on Vercel is needed for that.
- **Language**: EN/FR toggle in header; **Pro account**: `/create-pro-account` (public profile + contract); **Dashboard**: `/dashboard` (bookings, favorites, reviews, invoices); **Booking Guarantee** on home page.
- To see new code changes online: push to `main` on GitHub and Vercel will redeploy automatically (if you left the default “Deploy on push” on).
