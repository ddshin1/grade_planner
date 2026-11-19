# Putting Grade Planner online

About 15 minutes. Both services are free to start. You need the GitHub account
that owns this repo.

The site works without step 1, but shared class setups would vanish whenever
Vercel restarts the server, so do step 1 first.

## 1. Database (Supabase)

1. Go to https://supabase.com, sign in with GitHub, and click **New project**.
   Pick any name, set a database password (save it somewhere), and choose the
   region closest to your users.
2. When the project is ready, open **SQL Editor → New query**, paste the whole
   of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. It should
   say "Success. No rows returned".
3. Collect two values for step 2:
   - **Project URL**: Project Settings → Data API (looks like
     `https://abcdefgh.supabase.co`).
   - **Secret key**: Project Settings → API Keys → Secret keys (starts with
     `sb_secret_`). On older projects this is the `service_role` key.

   Keep the secret key private. It goes only into Vercel, never into the code
   or a chat.

## 2. Hosting (Vercel)

1. Go to https://vercel.com, sign in with GitHub, and click **Add New → Project**.
2. Import the `grade_planner` repository. Vercel detects Next.js; leave the
   build settings as they are.
3. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | the Project URL from step 1 |
   | `SUPABASE_SECRET_KEY` | the secret key from step 1 |
   | `ANTHROPIC_API_KEY` | optional: turns on "Import syllabus" |

4. Click **Deploy**. After a minute or two you get a link like
   `grade-planner.vercel.app`. Every push to `main` redeploys it.

If you add or change a variable later, redeploy (Deployments → ⋯ → Redeploy)
for it to take effect.

## 3. Check it works

1. Open the site, click **Find your class**, pick a college, and add a class.
2. Fill in a category, then click **Share setup** at the bottom of the class.
3. Open the site in a private window, pick the same college, and search for
   the class: it should appear under "Grading setups shared by students".
4. In Supabase, **Table Editor → shared_classes** should show one row.

If sharing fails, check Vercel → your project → Logs. "Database write failed"
usually means the schema was not run or a key is wrong.

## Good to know

- **Moderation:** any setup reported by three visitors stops showing in search.
  To remove or restore one, edit its `reports` value (or delete the row) in the
  Supabase Table Editor.
- **Limits:** one visitor can share 20 setups an hour. Syllabus uploads are
  capped at 4 MB because Vercel rejects larger requests.
- **Free plans:** Supabase pauses a free project after a week with no visits;
  open the dashboard and click Restore if that happens.
- **Students' grades** stay in their own browser and never reach the database.
