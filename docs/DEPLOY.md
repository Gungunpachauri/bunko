# Putting Bunko online

There are two ways, depending on whether visitors should talk to the real AI.

## Showcase (free, no server)

The website alone, on Vercel. Visitors walk the library, read the books, open the reading map and connections,
and ask the suggested questions, whose answers were recorded from the real AI at each book's reading position
(citations open the quoted passage). Typing new questions, uploading and removing are turned off, and a
**Showcase** badge links back to this repository.

1. **Export the showcase** from your own running library (API on port 8010, AI keys set):

   ```bash
   cd apps/api
   .venv/Scripts/python -m app.export_demo
   ```

   It writes everything to `apps/web/public/demo/` (about 35 MB). If the free AI quota runs out part-way, run it
   again later: answers already saved are kept. Only keep public-domain books in a public showcase.

2. **Commit and push** to the `showcase` branch (it keeps the recorded data and the demo code apart from `main`,
   which stays the real app).

3. **Vercel**: sign in at [vercel.com](https://vercel.com) with GitHub, then **Add New → Project → Import** `bunko`.
   - **Root Directory**: `apps/web`
   - After the first deploy: **Settings → Environments → Production → Branch Tracking** = `showcase`, then redeploy.
   - **Environment Variables**: `NEXT_PUBLIC_STATIC_DEMO` = `1`
   - **Deploy**. The public link is shown at the end (e.g. `https://bunko.vercel.app`), and every push redeploys it.

To try the showcase on your computer first: `cd apps/web`, then `NEXT_PUBLIC_STATIC_DEMO=1 npm run build` and
`npm run start`.

## Live (a real AI backend)

The backend needs about 1 GB of memory (two local search models and the index), more than free hosts give, so
this needs a paid or card-verified host: Hugging Face Spaces with PRO, Google Cloud Run, Railway or an Oracle
Cloud VM. The pieces are ready:

- `apps/api/Dockerfile` builds the backend; with the build argument `DEMO=1` it also bakes in the classics shelf,
  its search index and the models, so a fresh server starts full.
- Set `ADMIN_KEY` (only requests carrying it may add or remove books), `ASK_LIMIT_PER_VISITOR` and
  `ASK_LIMIT_TOTAL` (daily question limits that protect free AI quotas), `CORS_ORIGIN_REGEX` (e.g.
  `https://bunko[a-z0-9-]*\.vercel\.app`) and your AI keys.
- Point the website at it with `NEXT_PUBLIC_API_URL`, and open it once as `https://your-site/?admin=YOUR_KEY` to
  unlock the owner's tools in that browser.
