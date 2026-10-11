# Deploying Elevra.ai

Two pieces, plus the database that already exists:

| Piece | Where | Why |
|---|---|---|
| Web app (Next.js) | Vercel | Serves every page; reads dashboards straight from Supabase |
| API (FastAPI) | Hostinger VPS | Accounts, AI summaries, assistant, simulator, mock interview |
| Database and logins | Supabase (already live) | Nothing to deploy; do **not** re-seed |

The web app keeps working if the API is down (the shell shows a banner), so deploy the API first, then the web app, then connect them.

## 0. Before you start
- The Supabase project in `.env` is the live one with the 1,500-student data. Do not run `pipeline/run.py` against it again.
- Vercel must be allowed to read the private GitHub repo (Vercel → Add GitHub account → select `Beast123-cmd/Elevra.ai`).
- Browsers block an HTTPS page from calling an HTTP API ("mixed content"), so the API must have **HTTPS**. You need a hostname for the VPS. With no domain, use `<VPS-IP-with-dashes>.nip.io`, for example `203-0-113-10.nip.io`; certbot can issue a certificate for it.

## 1. API on the Hostinger VPS (Ubuntu 22.04 or 24.04)

**Python 3.11 or newer is required** (the pinned numpy 2.3 does not install on 3.10). Ubuntu 24.04 ships 3.12 and works as is. On Ubuntu 22.04, which ships 3.10, install 3.11 first:
`add-apt-repository ppa:deadsnakes/ppa && apt install -y python3.11 python3.11-venv`, and create the environment with `python3.11 -m venv .venv`.

```bash
# as root or with sudo
apt update && apt install -y python3 python3-venv python3-pip git nginx certbot python3-certbot-nginx
adduser --disabled-password --gecos "" elevra
su - elevra

git clone https://github.com/Beast123-cmd/Elevra.ai.git app && cd app     # use a deploy key or token for the private repo
python3 -m venv .venv && . .venv/bin/activate
pip install -r backend/requirements.txt
```

Create `/home/elevra/app/.env` (server-only; never commit it). Names only, fill in the values from your own `.env`:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL=eleven_flash_v2_5
ALLOWED_ORIGINS=https://YOUR-APP.vercel.app
DEMO_PASSWORD=
```

`ALLOWED_ORIGINS` is a comma-separated list of exact web addresses (no trailing slash). Add every address people will use, for example the Vercel production URL and any custom domain. A wrong value here is the most common reason "everything loads but buttons fail".

Install the service and the web server (as root):

```bash
cp /home/elevra/app/deploy/elevra-api.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now elevra-api
systemctl status elevra-api --no-pager          # should say active (running)
curl -s http://127.0.0.1:8000/health            # {"ok":true}

cp /home/elevra/app/deploy/nginx-elevra-api.conf /etc/nginx/sites-available/elevra-api
sed -i 's/API_HOSTNAME/YOUR-HOSTNAME-HERE/' /etc/nginx/sites-available/elevra-api
ln -s /etc/nginx/sites-available/elevra-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d YOUR-HOSTNAME-HERE            # HTTPS; answer yes to the redirect
curl -s https://YOUR-HOSTNAME-HERE/health        # {"ok":true}
```

Open ports 80 and 443 in the Hostinger firewall panel.

Memory: the API uses roughly 100 MB per worker when idle, so the two workers in the service file are fine on 1 GB or more. On a 512 MB server change `--workers 2` to `--workers 1`.

## 2. Web app on Vercel
1. New Project → import `Beast123-cmd/Elevra.ai`.
2. **Root Directory: `frontend`**. Framework: Next.js (detected). Leave build and output settings on default.
3. Environment variables (Production and Preview):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the live Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | its anon (publishable) key |
| `NEXT_PUBLIC_API_URL` | `https://YOUR-HOSTNAME-HERE` (no trailing slash) |
| `NEXT_PUBLIC_DEMO_PASSWORD` | the demo password (the four synthetic demo accounts only) |

   Never put the service-role key, Gemini or ElevenLabs keys in Vercel.
4. Deploy. Copy the production URL.
5. Go back to the VPS, put that URL in `ALLOWED_ORIGINS`, then `systemctl restart elevra-api`.

## 3. Supabase settings
Authentication → URL Configuration: set **Site URL** to the Vercel URL and add it (and `http://localhost:3000`) to **Redirect URLs**.

## 4. Check it
From any computer with Python 3:

```bash
python deploy/smoke_test.py https://YOUR-APP.vercel.app https://YOUR-HOSTNAME-HERE
```

It checks the landing and login pages, the API health, that the API accepts requests from the web address (CORS), that all four demo accounts sign in and land on the right area, that the wrong role is kept out, and that the signed-in API calls (brief, what-if) work. Every line must say PASS.

Then open the site in a private window, sign in as each role (see the README for accounts), and click through once.

## 5. Submitting
- Repo access: add the evaluators as collaborators (Settings → Collaborators), or make the repository public if the platform needs it. The rule book requires the repository to be accessible.
- On the byteXL platform provide: live URL, repository URL, the test logins from the README, and the slides and video links. Submit early, then resubmit if anything improves; the latest valid submission before the deadline counts.

## Troubleshooting
| Symptom | Cause and fix |
|---|---|
| Banner "The Elevra server is not reachable" | API not running or wrong `NEXT_PUBLIC_API_URL`. `systemctl status elevra-api`, then check the URL opens `/health` in a browser. |
| Buttons fail but `/health` works | `ALLOWED_ORIGINS` does not list the exact web address. Fix it and restart the service. |
| Mixed-content error in the console | The API URL starts with `http://`. It must be `https://`. |
| Everything redirects to /login | Supabase URL or anon key in Vercel is from the wrong project, or Supabase Site URL is not set. |
| AI features show "offline" or standard text | `GEMINI_API_KEY` missing or invalid on the VPS. The app still works; this is the designed fallback. |
| Voice interviewer is silent | `ELEVENLABS_API_KEY` or `ELEVENLABS_VOICE_ID` missing. Typing still works. |
