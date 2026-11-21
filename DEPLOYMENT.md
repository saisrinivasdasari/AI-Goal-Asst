# Jarvis Deployment & Everyday Mobile Cloud Guide

This document outlines how to deploy Jarvis to the cloud for 24/7 everyday access from your mobile phone or laptop, powered by **Google Gemini API** with **zero CPU/RAM load** on your local machine.

---

## 1. 24/7 Cloud Deployment on Vercel (Recommended for Daily Life)

Because Jarvis now features a native `GeminiProviderAdapter`, you can host the entire web application on **Vercel** (free tier). You no longer need your local computer or Ollama running.

### Step 1: Commit and Push to GitHub
```bash
git add .
git commit -m "feat(ai): integrate Google Gemini cloud provider for zero-CPU daily life inference"
git push origin main
```

### Step 2: Import into Vercel
1. Go to [vercel.com](https://vercel.com) and log in with GitHub.
2. Click **"Add New..."** > **"Project"**.
3. Select your `Jarvis` repository.
4. In the **Environment Variables** section, add the following:

| Variable | Value | Description |
|---|---|---|
| `AI_PROVIDER` | `gemini` | Enables Google Gemini cloud adapter |
| `GEMINI_API_KEY` | `your-google-ai-studio-api-key` | Your Google AI Studio API Key |
| `GEMINI_CHAT_MODEL` | `gemini-3.5-flash-lite` | Ultra-fast flash model with streaming |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | 768-dim vector embeddings |
| `DATABASE_URL` | Your Supabase connection pooler URL (`:6543/postgres?pgbouncer=true`) | PostgreSQL + pgvector connection |
| `DIRECT_URL` | Your Supabase direct connection URL (`:5432/postgres`) | Direct session connection |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Supabase Client URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhb...` | Supabase Service Role Key |

5. Click **"Deploy"**.

### Step 3: Install on Mobile as a Progressive Web App (PWA)
1. Open your live Vercel URL (e.g. `https://jarvis-yourname.vercel.app`) on your mobile browser.
2. **On iPhone (Safari)**: Tap the Share button at the bottom -> Tap **"Add to Home Screen"**.
3. **On Android (Chrome)**: Tap the 3 dots menu at top right -> Tap **"Install App"** or **"Add to Home screen"**.
4. Jarvis now lives right on your home screen like a native app, with instantaneous sub-second streaming answers and no machine dependencies.

---

## 2. Local AI Provider Switching (Ollama vs Gemini)

Jarvis's singleton `getAIProvider()` in `src/lib/ai/client.ts` supports switching between local Ollama and Cloud Gemini without touching any business logic:

```bash
# To run entirely on Google Gemini Cloud (Instant, No CPU usage):
AI_PROVIDER="gemini"
GEMINI_API_KEY="your-api-key"

# To run offline on local Ollama:
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
```

---

## 3. Database Maintenance & Backup Strategy

1. **Schema Migrations**:
   ```bash
   npm run db:push
   ```
2. **Visual Inspection**:
   ```bash
   npm run db:studio
   ```
3. **Automated Vector Vacuum**:
   Supabase PostgreSQL automatically runs autovacuum on `universal_memories` and maintains the HNSW index `idx_universal_memories_embedding_hnsw`.
