#!/usr/bin/env python3
"""Daily check: are the rental and search websites reachable? Writes data/status.json.
Information only. It never changes any prices or scores."""
import json, datetime, urllib.request, urllib.error, ssl, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
data = json.load(open(os.path.join(ROOT, "data", "companies.json")))

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=25, context=ssl.create_default_context()) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0

def state(code):
    if 200 <= code < 400: return "up"
    if code in (401, 403, 405, 429, 202): return "blocked"   # online, but blocks automatic checks
    if code == 0: return "unknown"
    return "error"

sites = {}
for item in data["search"] + data["companies"] + data["jamaica"]:
    code = get(item["site"])
    sites[item["id"]] = {"code": code, "state": state(code)}
    print(item["id"], code)

now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
json.dump({"checked": now, "sites": sites}, open(os.path.join(ROOT, "data", "status.json"), "w"), indent=1)
