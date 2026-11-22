# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Watcher?

Watcher is an AI-powered cybersecurity threat detection and monitoring platform built by Thales Group CERT, packaged as a single Django project with a React (webpack, not Vite) frontend embedded in it. It continuously watches for threats targeting an organisation: trending CVEs and ransomware activity, RSS-fed CERT advisories, look-alike/typosquatted domains (DNS permutation + Certificate Transparency), data leaks across paste sites and code registries, and changes to monitored malicious/legitimate domains — then correlates, scores, and pushes the results into TheHive/MISP, Slack, Citadel, or email.

## Commands

### Deployment (from `deployment/`)

```bash
make init            # First-time setup: certs, network, config dirs
make up               # Start all services (netcheck + TLS refresh, then docker compose up -d)
make down             # Stop services (--remove-orphans)
make build            # Build Docker images
make pull             # Pull Docker images
make deploy           # netcheck + TLS refresh, then ./scripts/deploy.sh
make migrate          # Run Django DB migrations (./scripts/migrate.sh)
make populate-db      # Seed sample data (./scripts/populate-db.sh)
make superuser        # Create Django admin user (./scripts/create-superuser.sh)
make create-certs     # Generate TLS certificates
make backup           # Backup the database (./scripts/backup-db.sh)
make dev              # Local dev stack: docker-compose.yml + compose.dev.yaml, builds watcher:dev, hot reload
make dev-logs         # Follow watcher (Django runserver) + frontend (webpack --watch) logs of the dev stack
make dev-down         # Stop the dev stack
make docs             # Build Sphinx docs (Watcher/docs/_build) inside watcher:dev, as the host user (no local Sphinx needed)
```

Docker is the **only** supported way to run Watcher, for production (`make up`, gunicorn) and development (`make dev`). There is no documented host-side `runserver`/`npm run dev` workflow anymore.

### Frontend (`Watcher/`, bundle written to `Watcher/Watcher/frontend/static/frontend/`)

In `make dev`, the `frontend` container runs `npm run dev` (webpack `--watch`) on the bind-mounted sources, as the host UID, and only runs `npm ci` when `package-lock.json` changed. The production image runs `npm run build` in its `frontend-builder` stage (node:22, required by `@babel/core` 8). The bundle (`main.js`, `main.js.map`, `main.js.LICENSE.txt`) is **git-ignored**: never commit it, and don't rebuild it "before committing".

There is no separate frontend dev server — React is bundled by webpack and served by Django itself (`frontend` app), unlike a typical Vite-proxied SPA setup.

```bash
# Cypress headless against the dev stack (baseUrl defaults to http://127.0.0.1:9020), from the repo root
docker run --rm --network host -v "$PWD/Watcher:/e2e" -w /e2e cypress/included:15.19.0
```

### Backend (from `deployment/`, against the running stack)

```bash
docker compose exec watcher python manage.py migrate
docker compose exec watcher sh -c 'DB_USER=root DB_PASSWORD="$DB_ROOT_PASSWORD" python manage.py test'               # needs root: creates test_db_watcher
docker compose exec watcher sh -c 'DB_USER=root DB_PASSWORD="$DB_ROOT_PASSWORD" python manage.py test <app_label>'   # single app
docker compose exec watcher python manage.py createsuperuser
```

Per-app `tests.py`: accounts, common, connectors, cyber_watch, data_leak, dns_finder, site_monitoring, threats_watcher, timeline, watcher.

### CI (`.github/workflows/docker-ci.yml`)

Reusable workflow called by `docker-image-test.yml` (push to `test` → `:test`) and `docker-image-latest.yml` (push to `master` → `:latest`): builds the image once, runs `manage.py test` inside it, starts it with its production command (gunicorn) and runs Cypress (`cypress/included`) against it, then pushes that exact image only if everything passed. `docker-image-tags.yml` (release `v*` tags) still builds and pushes without tests. There is no PR workflow.

## Architecture

### Services (Docker Compose, assembled from `deployment/compose_*.yaml` + `deployment/docker-compose.yml`)

| Service | Role |
|---|---|
| `watcher` | Django app, image `ghcr.io/thalesgroup-cert/watcher` — gunicorn on 9002 in production (`Watcher/Watcher/gunicorn.conf.py`), `runserver` in `make dev` — runs the web UI/API *and* the in-process APScheduler jobs (see below); published on `127.0.0.1:${WATCHER_PORT}` (9020) only |
| `db_watcher` | MySQL 8.0 (`mysql_native_password` auth plugin required), data bind-mounted in `db_watcher/` at the repo root |
| `searxng` | Privacy-respecting metasearch engine, used by `data_leak` for paste/code-leak searches |
| `certstream` | `0rickyy0/certstream-server-go` — Certificate Transparency stream consumed by `dns_finder` for real-time suspicious-domain detection |
| `frontend` (`make dev` only, `compose.dev.yaml`) | `node:22` running `npm run dev` (webpack `--watch`) on the bind-mounted sources |
| `traefik` (optional, `compose_reverse_proxy.yaml`) | TLS-terminating reverse proxy for the corporate domain |

All services share the external Docker network `${NETWORK_NAME}` (`watcher_net`, `${NETWORK_SUBNET}`, created by `scripts/check-network.sh`) and reach each other **by service name** (`db_watcher`, `searxng`, `certstream`, `watcher`), which `compose_apps.yaml` already adds to `no_proxy`. The former root `docker-compose.yml` (fixed `10.10.10.x` IPs) has been removed: `deployment/` is the only Compose setup.

### Detection → notification flow

Every module follows the same shape: an APScheduler job in that app's `core.py` detects or fetches something (a new CVE/ransomware post, a DGA-matched or newly-certstream'd domain, a leaked credential, an RSS breaking-news item, a content/IP/MX drift on a monitored site, a UDRP status change) → creates/updates a model row → hands off to the `connectors` app for outbound delivery (a TheHive alert, a MISP object, a Slack/Citadel message, an email via the `smtp` connector) based on which connectors are configured and healthy → `timeline`'s middleware/signals log the event to the cross-module activity feed. There is no shared cross-app "Case"/job ledger tying these together — each app's `core.py` talks to `connectors` directly and independently, so a given detection's outbound deliveries are only traceable through that app's own models plus `timeline`, not a unified pipeline object.

### Scheduling model — no Celery

There is **no Celery/Redis** in this project. Each Django app that needs background jobs defines a `core.py` with a module-level `start_scheduler()` that creates an APScheduler `BackgroundScheduler` and registers cron/interval jobs; that function is called once at import time from the app's own `urls.py` (e.g. `common/urls.py` does `from .core import start_scheduler` then `start_scheduler()` at module scope). Because it's wired through URL-conf import, the schedulers start as a side effect of Django loading the URL root — not from `apps.py.ready()` — so don't assume moving scheduler code into `AppConfig.ready()` is a no-op refactor.

Representative jobs (see each app's `core.py` for the authoritative list):

| App | Jobs |
|---|---|
| `threats_watcher` | `main_watch` (RSS ingestion, every 30 min), `cleanup` (daily 08:00), `generate_weekly_summary` (AI weekly digest) |
| `dns_finder` | `main_dns_twist` (dnstwist permutation scan, every 2h), `main_certificate_transparency` (certstream consumer, every 1h) |
| `data_leak` | `main_data_leak` (SearxNG-driven leak search, every 5 min, up to 10 concurrent instances), `cleanup` (every 2h) |
| `site_monitoring` | `monitoring_check` (content/IP/MX diff via TLSH, every 15 min), `update_site_monitoring_rdap_data` (every 15 min) |
| `cyber_watch` | `fetch_latest_cves`, `fetch_ransomware_data`, `fetch_ransomlook_data` (all every 30 min) |
| `common` | `update_domain_registrar_info` / `update_legitimate_domains_rdap_data` (WHOIS/RDAP, every 30 min), `update_monitored_sites_rdap_data` / `update_all_ssl_certificates` (hourly/6h), `check_udrp_statuses` (6h), `run_weekly_health_checks` (connector health, Monday 06:00) |

### Django Apps (`Watcher/Watcher/`)

| App | Responsibility |
|---|---|
| `watcher` | Project settings, root `urls.py`, WSGI entrypoint |
| `accounts` | Auth: local, LDAP (`django-auth-ldap`), OIDC/SSO (`mozilla-django-oidc`, PKCE, Knox token issuance) |
| `common` | Cross-cutting: legitimate domain registry, MISP export (`misp.py`), mail templates, WHOIS/RDAP/SSL/UDRP scheduled checks, connector health checks |
| `connectors` | Connector framework: registry/dispatch (`core.py`), encrypted credential storage, per-connector health checks; `contrib/` holds one module per integration — `thehive`, `misp`, `slack`, `citadel`, `smtp`, `searxng`, `certstream`, `ldap`, `oidc`, `mysql`, `cyberwatch_cve`, `ransomlook`, `ransomware_live`, `wipo_udrp` |
| `cyber_watch` | CVE (cve.circl.lu) and ransomware (ransomware.live, ransomlook.io) intelligence fetch/correlation, keyword-based Watch Rules |
| `data_leak` | Leak detection across Pastebin, StackOverflow, GitHub/GitLab/Bitbucket, APKMirror, npm, etc., via SearxNG |
| `dns_finder` | Suspicious/typosquatted domain detection: dnstwist permutations + certstream-driven Certificate Transparency monitoring; `certstream_client.py` is the websocket consumer for the internal `certstream` service |
| `site_monitoring` | Malicious-domain surveillance (IP/MX/content-hash via TLSH, RDAP/WHOIS expiry) and UDRP case tracking (`udrp.py`) |
| `threats_watcher` | RSS-fed threat news (CERT-FR, CERT-EU, US-CERT, ACSC, …), AI summarization/NER pipeline (`model_manager.py`, `summary_manager.py`) for weekly digests and breaking-news alerts |
| `timeline` | Cross-module audit/activity timeline (`middleware.py` + `signals.py` capture events from the other apps) |
| `frontend` | Serves the built React/webpack bundle (`frontend/static/frontend/`) and its Django template/view |

### Frontend (`Watcher/Watcher/frontend/src`)

React 18 (not 19) + React Router v5 + Redux (`redux`, `react-redux`, `redux-thunk`) + MUI v9 (`@mui/material`, `@mui/x-charts`, `@mui/lab`), bundled by webpack 5 (Babel, not Vite/esbuild) straight into Django's static files — no separate frontend server or API proxy to configure. Also pulls in `deck.gl` (WorldMap geospatial view), `chart.js`/`react-chartjs-2`, `react-grid-layout` (resizable dashboard panels), `react-wordcloud`, and `bootstrap`/`react-bootstrap` alongside MUI. E2E tests use Cypress (`Watcher/cypress/`), not Playwright.

### AI / ML

- **`google/flan-t5-base`** (Hugging Face `transformers`) — text-to-text generation for AI-powered weekly threat summaries and on-demand keyword summaries.
- **`dslim/bert-base-NER`** — Named Entity Recognition for automatic CVE/threat-actor/IOC extraction from ingested RSS content (`threats_watcher/core.py:extract_entities_and_threats`).
- **TLSH** (`python-tlsh`) — fuzzy hashing to detect content drift on monitored sites, not a neural model but part of the same detection pipeline.

## Key Configuration Files

| File | Purpose |
|---|---|
| `deployment/.env` (from `deployment/.env.example`) | Everything Compose also needs: ports, image versions, network, `TZ`, `DB_*`, `SEARX_*`, `CA_PATH` (host certs dir), proxy settings |
| `.env` (repo root, from `.env.example`) | Django-only settings: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `ALLOWED_HOSTS`, connectors, LDAP/OIDC, `DATA_LEAK_SEARX_URL`... Watcher has **no `settings.json`** — all runtime config is environment variables consumed directly in `watcher/settings.py` |
| `certstream-config.yaml` | Config for the bundled certstream-server-go instance |
| `Searx/searx/` | SearxNG instance config, mounted read-write into the `searxng` container |
| `deployment/Makefile` | All operational tasks (see Commands above) |
| `deployment/scripts/` | `init.sh`, `deploy.sh`, `migrate.sh`, `populate-db.sh`, `create-superuser.sh`, `backup-db.sh`, `check-network.sh`, `replace-tls.sh` |

Both `.env` files are **git-ignored**; only their `.env.example` templates are committed. `deployment/certificates/*/` (generated CA, including its private key) is git-ignored too.

`DJANGO_SECRET_KEY` and `CONNECTORS_ENCRYPTION_KEY` (root `.env`) are **required**: `settings.py` raises `ImproperlyConfigured` when one is empty, equal to the old public defaults (`LEGACY_PUBLIC_*` in `settings.py`), or (for the Fernet key) malformed. `init.sh` generates them only when empty/missing. Never regenerate `CONNECTORS_ENCRYPTION_KEY` on an existing instance: `ConnectorOverride` secrets are encrypted with it. `connector_decrypt` still falls back to the legacy public key (with a warning) until migration `connectors.0007` re-encrypts everything with the instance key. Anything running `manage.py` needs both keys set (the Dockerfile passes build-only placeholders to `collectstatic`; CI generates random ones).

## Full Local Dev Deployment — `/deploy-full-e2e`

Trigger phrase for this section: "deploy full e2e", "stand up the full stack", "redo the local deploy", `/deploy-full-e2e`. **Verified end-to-end on this machine** (Windows + Git Bash + Docker Desktop, no `make` installed — every command below run directly, no Makefile) — all 5 services came up healthy, migrations applied cleanly, a superuser and sample data were created, and the real React UI was confirmed served. Every gotcha below was actually hit, not inferred.

Assumes: Docker + Compose v2 (this machine: client 29.7.2 / compose plugin 5.5.1), commands run from `deployment/` unless noted. **On Windows/Git Bash, `make` is typically absent** — run the underlying commands shown under each step directly instead of via `make <target>`.

### 1. Two separate `.env` files — one owner per variable

Watcher reads config from **two different `.env` files at once**. `compose_apps.yaml`'s `watcher` service loads `env_file: [${WATCHER_PATH}/.env, ./.env]` — both merged into the container's environment, with the *second* file's values overriding the first on any shared key. The templates are written so that **no key is shared**:

- **`Watcher/.env`** (repo root, from `.env.example`) — Django-only settings: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `ALLOWED_HOSTS`, LDAP/OIDC, SMTP, Slack/Citadel/TheHive/MISP keys, LLM providers, CyberWatch feed URLs, `DATA_LEAK_SEARX_URL`. `cp .env.example .env` (`init.sh` also does it if missing).
- **`deployment/.env`** (from `deployment/.env.example`) — everything Compose also needs: ports, image versions, network, container names, `TZ`, `DB_*`, `SEARX_HOSTNAME`, `SEARX_COMMAND`, `CA_PATH`, `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`.

Never add a key to both: `deployment/.env` would silently win, with no error. This used to break Data Leak (an empty `DATA_LEAK_SEARX_URL` in `deployment/.env` overrode the root URL). An older `deployment/.env` (created before the split) may still contain `DJANGO_SECRET_KEY`/`DATA_LEAK_SEARX_URL`: remove them. Check for overlaps with `comm -12 <(grep -oE '^[A-Za-z_][A-Za-z0-9_]*' ../.env | sort -u) <(grep -oE '^[A-Za-z_][A-Za-z0-9_]*' .env | sort -u)` (must print nothing).

`CA_PATH` means the host certificates dir to Compose; `compose_apps.yaml` sets the container's `CA_PATH` to `/etc/ssl/certs/ca-certificates.crt` (system roots + the mounted CA after `update-ca-certificates`).

### 2. `init.sh` (`make init`)

```bash
cd deployment
bash ./scripts/init.sh
```
Creates `deployment/.env` from `.env.example` if missing (does **not** touch the root `.env` — it only checks `${WATCHER_PATH}/.env` exists), checks the `db_watcher`/`Searx/searx`/`certificates` directories, rewrites `${DOMAIN_CORP}` into `traefik/dynamic/tls.yaml`, and generates TLS certs if missing.

**Gotcha (Windows/Git Bash only) — MSYS path conversion breaks the OpenSSL `-subj` argument.** The first `init.sh` run failed with `req: subject name is expected to be in the format /type0=value0/... This name is not in that format: 'C:/Program Files/Git/C=FR/ST=...'` — Git Bash's MSYS runtime rewrites any argument that looks like a leading-`/` POSIX path into a Windows path, mangling `openssl-certificates-generator.sh`'s `-subj "/C=FR/ST=..."`. Fix: prefix every script invocation with `MSYS_NO_PATHCONV=1`, e.g. `MSYS_NO_PATHCONV=1 bash ./scripts/init.sh`. Applies to every script here, not just `init.sh`.

**Gotcha (Windows/Git Bash only) — `.env` is created with CRLF line endings, which breaks the scripts' hand-rolled env parser.** `cp .env.example .env` (inside `init.sh`) preserves the CRLF endings `deployment/.env.example` was checked out with (git's `core.autocrlf` on Windows). `check-network.sh` and `replace-tls.sh` both parse `.env` with a manual `while IFS='=' read -r key value` loop that doesn't strip `\r` — this reads blank lines as a lone `\r` character (not caught by the `-z "$key"` empty check), producing `export: `=': not a valid identifier` spam, and worse, embeds a trailing `\r` into every real value it exports. Fix once, after `init.sh` creates the file: `sed -i 's/\r$//' deployment/.env`. (The root `.env` also has CRLF but is git-tracked — don't rewrite it in place without checking `git diff` first.)

**Gotcha — the domain gets baked into `tls.yaml` exactly once.** `init.sh`/`replace-tls.sh` both run a literal `sed 's/Host(\`watcher\`)/.../''` against `traefik/dynamic/tls.yaml`, whose shipped placeholder is `` Host(`watcher`) # <-- To Be Changed ``. After the first run that literal string is gone. Change `DOMAIN_CORP` later and re-run — nothing happens, the pattern no longer matches. Changing the domain again means hand-editing `traefik/dynamic/tls.yaml` (or restoring it from git) yourself.

**Gotcha — the generated CA private key ends up on disk outside `certificates/`.** `openssl-certificates-generator.sh` writes a full local PKI (`ca.key.pem`, `ca.cert.srl`, `client.crt.pem`/`.key.pem`, `server.csr.pem`, plus the three files `init.sh` actually wants) into `certificates/default/`; only `certfile.pem`/`keyfile.pem`/`rootcafile.pem` get moved up into `certificates/`. The root CA's own private key (`certificates/default/ca.key.pem`) is left behind there — harmless for a throwaway local CA, but don't reuse this output as a real internal CA.

### 3. Network + up

```bash
MSYS_NO_PATHCONV=1 bash ./scripts/check-network.sh
MSYS_NO_PATHCONV=1 bash ./scripts/replace-tls.sh
MSYS_NO_PATHCONV=1 docker compose --env-file .env up -d
```
`check-network.sh` creates the external `${NETWORK_NAME}` bridge network (`watcher_net` by default, with `${NETWORK_SUBNET}`/`${NETWORK_GATEWAY}`/`${NETWORK_IP_RANGE}`) if it doesn't already exist — idempotent, safe to re-run. `docker compose up -d` then pulled all 5 images (`watcher`, `db_watcher`, `searxng`, `certstream`, `traefik`) and brought every container up; `db_watcher` reports healthy first, then `watcher` starts (its `depends_on: condition: service_healthy` on the DB), reaching `healthy` itself roughly a minute later — gunicorn's worker takes a while to import (torch/transformers among the heavier ones) and its `post_worker_init` hook loads the URLconf at boot so every app's scheduler starts without waiting for a first request. Keep gunicorn at **one worker** (`gunicorn.conf.py`): each worker would start its own schedulers and duplicate every job.

`db_watcher`'s bind mounts (`../db_watcher/data`, `../db_watcher/logs` — i.e. `Watcher/db_watcher/` at the repo root, sibling to `deployment/`) don't exist before the first run; Docker creates them, and the official `mysql` image's own entrypoint (starts as root, drops to the `mysql` user itself) handled ownership fine here — no manual `mkdir`/`chown` needed, unlike a from-scratch app image.

### 4. Migrate, seed, create a superuser

```bash
docker compose exec watcher python manage.py migrate
docker compose exec watcher python manage.py populate_db
docker compose exec \
  -e DJANGO_SUPERUSER_USERNAME=admin \
  -e DJANGO_SUPERUSER_PASSWORD='<a real password>' \
  -e DJANGO_SUPERUSER_EMAIL=admin@watcher.local \
  watcher python manage.py createsuperuser --noinput
```
All 113 migrations applied cleanly (one harmless warning: `threats_watcher.Source.url` — `mysql.W003`, a unique `CharField` over MySQL's 255-byte index limit — pre-existing, not something this deployment caused). `createsuperuser` is interactive by default (`make superuser` just runs it with no flags) — use `--noinput` + the three `DJANGO_SUPERUSER_*` env vars instead when scripting this, same as any Django project.

`populate_db` (`threats_watcher/management/commands/populate_db.py`) is the **only** custom management command in the project. It **prints nothing to stdout** (it logs via `logging.getLogger('watcher')`, not `print`/`self.stdout.write`) — a silent run is success, not failure; confirm with `manage.py shell -c "from threats_watcher.models import BannedWord, Source; print(BannedWord.objects.count(), Source.objects.count())"` (104 banned words / 217 RSS sources seeded from `threats_watcher/datas/*.csv` on this run), plus two default Groups (`Analysts Group`, `Analysts Read Only Group`).

### 5. Verify

```bash
docker compose --env-file .env ps                                             # all 5 healthy/up
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:${WATCHER_PORT:-9020}/   # -> 200, confirmed
curl -sk -H "Host: ${DOMAIN_CORP}" -o /dev/null -w '%{http_code}\n' https://localhost/  # via Traefik
```
Direct access on `WATCHER_PORT` (9020) worked immediately: HTTP 200, real React `index.html` served. The `watcher` container's own healthcheck curls `http:/localhost:9002/#/login` (single-slash typo in the healthcheck command itself — harmless, curl normalizes it) expecting HTTP 200 — reached `healthy` about a minute after `up`.

**Gotcha — going through Traefik returns Django 400, not 200.** `traefik/dynamic/tls.yaml`'s `set-host` middleware rewrites the request's `Host` header to `watcher:9002` before proxying to the backend, regardless of what `DOMAIN_CORP` is. If the root `.env`'s `ALLOWED_HOSTS` doesn't include `watcher`, Django rejects the rewritten request with `DisallowedHost` → HTTP 400 (a short ~140-byte body, since `DJANGO_DEBUG` is off). Add `watcher` to `ALLOWED_HOSTS` in the root `.env` if you need the Traefik/TLS path working locally; direct port access doesn't need it.

### 6. Edited `.env` after containers are already running?

Same rule as any Compose stack using `env_file:` — a plain `docker compose restart` does **not** reload `env_file:` values, only `up -d` (which recreates a container whose config changed) does. If a config change doesn't seem to take effect: `docker compose --env-file .env up -d --force-recreate watcher`.

## Conventions

- Commit messages and PRs follow **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) — see `CONTRIBUTING.md`.
- Branch naming: `feature/`, `fix/`, `docs/`, `refactor/`.
- PRs merge into `test` first, then later into `master`. Minimum 80% test coverage expected for new code.
- Security vulnerabilities go through GitHub Security Advisories, not public issues (see `SECURITY.md`).
- Full user/admin documentation is Sphinx-built from `Watcher/docs/` (`myst-parser`, `sphinxawesome-theme`) and published at https://thalesgroup-cert.github.io/Watcher/.
