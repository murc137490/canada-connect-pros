## Canada Connect Pros

React + Vite + TypeScript front-end for a Canadian home services marketplace, using Supabase for authentication/database and Supabase Edge Functions for AI-powered features.

### Tech stack

- **Frontend**: Vite, React, TypeScript, Tailwind CSS, shadcn-ui, React Router
- **Backend**: Supabase (Postgres, Auth, Edge Functions)
- **AI**: OpenAI Chat Completions API via a Supabase Edge Function

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

In your Supabase project, configure Edge Function environment variables (Settings → Functions):

- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_ANON_KEY` = your anon/publishable key
- `OPENAI_API_KEY` = your OpenAI API key

3. **Run the dev server**

```bash
npm run dev
```

### Supabase & authentication

- The app uses Supabase auth via the `supabase` client in `src/integrations/supabase/client.ts`.
- `AuthContext` in `src/contexts/AuthContext.tsx` provides session/user state and sign-in/sign-up helpers.

### AI / ChatGPT integration

- A Supabase Edge Function (`supabase/functions/chat/index.ts`) exposes a secure API route for OpenAI Chat Completions.
- The Support page (`src/pages/Support.tsx`) calls this route from the frontend while keeping the OpenAI API key on the server.
- In Supabase, the function must be named **`chat`** (or you’ll need to change `CHAT_URL` in `Support.tsx`). Set `OPENAI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` in Project Settings → Edge Functions.

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
- To see new code changes online: push to `main` on GitHub and Vercel will redeploy automatically (if you left the default “Deploy on push” on).
