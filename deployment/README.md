# Deployment Guide

This folder contains the Docker Compose deployment for Watcher.

## Requirements

- Docker
- Docker Compose v2 (`docker compose`)

## Configuration

Watcher is configured by two env files, each created from a committed
`.env.example` template and never committed itself:

| File | Contains |
|---|---|
| `deployment/.env` (from `deployment/.env.example`) | Everything Docker Compose needs: image versions, ports, `DOMAIN_CORP`, network, `TZ`, `DB_*`, `SEARX_*`, `CA_PATH`, `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` |
| `${WATCHER_PATH}/.env` (from `../.env.example`) | Django application settings: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `ALLOWED_HOSTS`, connectors, LDAP/OIDC, `DATA_LEAK_SEARX_URL`... |

Initialize them once:

```bash
cp ../.env.example ../.env
make init      # creates deployment/.env from .env.example if missing
```

The `watcher` container loads both files, `deployment/.env` **last**: a
variable defined in both is silently overridden by `deployment/.env`.
**Define each variable in one file only.**

Important secrets:

- `DJANGO_SECRET_KEY`: root `.env` (when empty, Django falls back to a
  default key that is public in the source code)
- `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`: `deployment/.env`, set them
  **before the first start** (they are only applied when the database is
  created)

## Initialization

Run the checklist:

```bash
make init
```

This checks binaries, prepares `.env`, validates directories, updates TLS config, and creates certificates if missing.

## Main commands

```bash
make up
make down
make build
make pull
make deploy
make migrate
make backup
make populate-db
make superuser
make create-certs
```

Equivalent manual start:

```bash
docker compose --env-file .env up -d
```

The `watcher` container runs **gunicorn** with a single worker and 8 threads
(`Watcher/Watcher/gunicorn.conf.py`). Keep a single worker: the background
jobs (APScheduler) run inside the web process, so every additional worker
would run every job again.

## Local development

`compose.dev.yaml` adds a development stack on top of `docker-compose.yml`,
with hot reload:

```bash
make dev        # build watcher:dev from ../Watcher and start the stack
make dev-logs   # follow the watcher (Django) and frontend (webpack) logs
make dev-down   # stop it
make docs       # build the Sphinx documentation (Watcher/docs/_build) in the watcher:dev image
```

- `watcher`: built from your local code, runs `manage.py runserver` on the
  bind-mounted sources (restarts on Python changes), `DJANGO_DEBUG=True`.
- `frontend`: runs `npm run dev` (webpack watch) on the same sources, as your
  user; `npm ci` only runs when `package-lock.json` changed. Set
  `WATCHPACK_POLLING=true` if file changes are not detected.

## Project structure

```
.
├── docker-compose.yml
├── compose.dev.yaml
├── compose_apps.yaml
├── compose_databases.yaml
├── compose_reverse_proxy.yaml
├── .env.example
├── scripts/
│   ├── init.sh
│   ├── check-network.sh
│   ├── deploy.sh
│   ├── migrate.sh
│   ├── backup-db.sh
│   ├── populate-db.sh
│   ├── create-superuser.sh
│   ├── replace-tls.sh
│   └── openssl-certificates-generator.sh
└── Makefile
```

## Corporate proxy / custom CA certificates

If Watcher runs behind a corporate proxy that intercepts or re-signs TLS
traffic (or must trust an internal CA for internal services), drop the CA
certificate(s) in `deployment/certificates/` alongside the existing
`rootcafile.pem`.

The `watcher` service mounts each CA file into
`/usr/local/share/ca-certificates/` (as a separate `.crt` file per CA) and
runs `update-ca-certificates` at container startup. This merges every
mounted CA with the system's public trust store into
`/etc/ssl/certs/ca-certificates.crt`, which `REQUESTS_CA_BUNDLE` and the
container's `CA_PATH` point to (`CA_PATH` in `deployment/.env` is the host
certificates directory, the container gets the bundle path instead) —
it **extends** the trust store instead of replacing it, so public HTTPS
endpoints (RSS feeds, CVE APIs, ransomware.live, etc.) keep working
alongside internal ones.

To add more than one custom CA, add one volume line per file in
`compose_apps.yaml`, each with its own destination name:

```yaml
    volumes:
      - "${CA_PATH}/rootcafile.pem:/usr/local/share/ca-certificates/custom-ca.crt:ro"
      - "${CA_PATH}/another-ca.pem:/usr/local/share/ca-certificates/another-ca.crt:ro"
```

No custom CA to trust? Nothing to do — `make init` always generates a
self-signed `rootcafile.pem`, so the mount above is always valid and
`update-ca-certificates` simply merges it with the public CAs on every
start.

### Proxy settings and the CertStream / SearxNG services

- Set `HTTP_PROXY`, `HTTPS_PROXY` and `NO_PROXY` in `deployment/.env` only: the
  compose files read them from there, and pass them to the containers.
- The `watcher` container always bypasses the proxy for `searxng`, `db_watcher` and
  `certstream`: there is no need to list them in `NO_PROXY`.
- **SearxNG settings.** `SEARX_PATH` must be the directory that directly contains
  `settings.yml` (`../Searx/searx`). If it is not, SearxNG generates its own default
  `settings.yml`, which only allows the HTML format: it answers HTTP 403 to the JSON API
  that Data Leak uses, and no leak is ever found.

See [issue #316](https://github.com/thalesgroup-cert/Watcher/issues/316) for
the original bug report and root cause.

## Security notes

- Never commit `.env`.
- Rotate `DJANGO_SECRET_KEY` and DB credentials for production.
- Prefer secret managers/CI variables for production deployments.
