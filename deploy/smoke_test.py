"""Post-deploy smoke test: python deploy/smoke_test.py WEB_URL API_URL

Checks what an evaluator (or the automated gate) would hit first. Standard library only. Needs the public Supabase
settings and the demo password, read from the environment or from .env / frontend/.env.local:
NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_DEMO_PASSWORD (or DEMO_PASSWORD).
Writes nothing to the database.
"""
import base64
import http.client
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

if len(sys.argv) != 3:
    sys.exit(__doc__)
WEB, API = (a.rstrip("/") for a in sys.argv[1:3])
ROOT = Path(__file__).resolve().parents[1]


def load_env() -> dict:
    env = dict(os.environ)
    for f in (ROOT / ".env", ROOT / "frontend" / ".env.local"):
        if f.exists():
            for k, v in re.findall(r"^([A-Z_]+)=(.*)$", f.read_text(encoding="utf-8"), re.M):
                env.setdefault(k, v.strip().strip("\"'"))
    return env


ENV = load_env()
SUPA = (ENV.get("NEXT_PUBLIC_SUPABASE_URL") or ENV.get("SUPABASE_URL", "")).rstrip("/")
ANON = ENV.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
PASSWORD = ENV.get("NEXT_PUBLIC_DEMO_PASSWORD") or ENV.get("DEMO_PASSWORD", "")
ACCOUNTS = {"admin": "admin@demo.edu", "faculty": "faculty1@demo.edu", "red": "student.red@demo.edu", "star": "student.star@demo.edu"}
failed = 0


def check(label: str, ok: bool, detail: str = "") -> bool:
    global failed
    failed += 0 if ok else 1
    print(("PASS " if ok else "FAIL ") + label + ("" if ok else f"  ({detail})"))
    return ok


def request(method: str, url: str, headers: dict | None = None, body: dict | None = None, timeout: int = 60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except Exception as e:  # unreachable, DNS, TLS ...
        return 0, {}, str(e).encode()


def page(path: str, cookie: str = ""):
    """GET without following redirects, so a redirect to /login or another area is visible."""
    u = urllib.parse.urlparse(WEB)
    conn = (http.client.HTTPSConnection if u.scheme == "https" else http.client.HTTPConnection)(u.netloc, timeout=60)
    conn.request("GET", path, headers={"Cookie": cookie} if cookie else {})
    r = conn.getresponse()
    r.read()
    return r.status, r.getheader("Location") or ""


def session_cookie(sess: dict) -> str:
    ref = re.match(r"https://([^.]+)\.", SUPA).group(1)
    raw = "base64-" + base64.urlsafe_b64encode(json.dumps(sess, separators=(",", ":")).encode()).decode().rstrip("=")
    name = f"sb-{ref}-auth-token"
    parts = [raw[i:i + 3180] for i in range(0, len(raw), 3180)]
    return f"{name}={raw}" if len(parts) == 1 else "; ".join(f"{name}.{i}={p}" for i, p in enumerate(parts))


print(f"Web: {WEB}\nAPI: {API}\n")
print("--- public pages")
s, _, body = request("GET", WEB + "/")
check("landing page loads", s == 200, f"status {s}")
s, _, body = request("GET", WEB + "/login")
check("login page loads", s == 200 and b"Sign in" in body, f"status {s}")

print("--- API")
s, _, body = request("GET", API + "/health")
check("API health answers {ok: true}", s == 200 and b'"ok":true' in body.replace(b" ", b""), f"status {s} {body[:80]!r}")
s, h, _ = request("OPTIONS", API + "/admin/users", {"Origin": WEB, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
allow = {k.lower(): v for k, v in h.items()}.get("access-control-allow-origin", "")
check("API accepts requests from the web address (CORS)", allow in (WEB, "*"), f"allow-origin {allow!r}; add {WEB} to ALLOWED_ORIGINS")
check("API protected routes refuse anonymous callers", request("POST", API + "/admin/users", body={})[0] == 401)

if not (SUPA and ANON and PASSWORD):
    print("\nSet NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_DEMO_PASSWORD to test sign-in.")
    sys.exit(1 if failed else 0)

print("--- demo accounts sign in")
sess = {}
for key, email in ACCOUNTS.items():
    s, _, body = request("POST", f"{SUPA}/auth/v1/token?grant_type=password", {"apikey": ANON}, {"email": email, "password": PASSWORD})
    if check(f"{email} signs in", s == 200, f"status {s}"):
        sess[key] = json.loads(body)

if {"admin", "faculty", "red"} <= set(sess):
    print("--- role guards on the web app")
    c = {k: session_cookie(v) for k, v in sess.items()}
    s, loc = page("/admin", c["admin"])
    check("admin opens /admin", s == 200, f"status {s} {loc}")
    s, loc = page("/faculty", c["faculty"])
    check("faculty opens /faculty", s == 200, f"status {s} {loc}")
    s, loc = page("/student", c["red"])
    check("student opens /student", s == 200, f"status {s} {loc}")
    s, loc = page("/admin", c["faculty"])
    check("faculty is kept out of /admin", s in (302, 307) and "/faculty" in loc, f"status {s} {loc}")
    s, loc = page("/faculty", c["red"])
    check("student is kept out of /faculty", s in (302, 307) and "/student" in loc, f"status {s} {loc}")
    s, loc = page("/admin")
    check("a visitor is sent to /login", s in (302, 307) and "/login" in loc, f"status {s} {loc}")

    print("--- API with real sessions")
    bearer = {k: {"Authorization": "Bearer " + v["access_token"], "apikey": ANON} for k, v in sess.items()}
    rows = json.loads(request("GET", f"{SUPA}/rest/v1/students?select=student_id&limit=1", bearer["faculty"])[2] or b"[]")
    if check("faculty can read their own mentees", bool(rows), "no rows (RLS or wrong project)"):
        sid = rows[0]["student_id"]
        s, _, body = request("POST", f"{API}/briefs/{sid}", bearer["faculty"], {})
        check("mentor brief works (AI or standard text)", s == 200 and b'"brief"' in body, f"status {s}")
        s, _, body = request("POST", f"{API}/briefs/{sid}/message", bearer["faculty"], {"kind": "student_checkin"})
        check("message draft works", s == 200 and b'"message"' in body, f"status {s}")
    me = json.loads(request("GET", f"{SUPA}/rest/v1/users?select=student_id&role=eq.student", bearer["red"])[2] or b"[]")
    if check("student can read their own record", bool(me and me[0]["student_id"]), "no row"):
        s, _, body = request("POST", API + "/whatif", bearer["red"], {"student_id": me[0]["student_id"], "overrides": {}})
        check("what-if simulator answers", s == 200 and b'"score"' in body, f"status {s}")
    s, _, body = request("GET", API + "/admin/weekly-brief", bearer["admin"])
    check("admin weekly brief works", s == 200 and b'"stats"' in body, f"status {s}")
    check("a student cannot use admin endpoints", request("GET", API + "/admin/weekly-brief", bearer["red"])[0] == 403)

print("\n" + ("ALL PASS" if not failed else f"{failed} CHECK(S) FAILED"))
sys.exit(1 if failed else 0)
