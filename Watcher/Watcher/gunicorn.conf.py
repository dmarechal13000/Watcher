"""
Gunicorn configuration for Watcher (loaded automatically from the working directory).

Watcher runs its background jobs in-process: each app's urls.py calls
start_scheduler() at import time (APScheduler BackgroundScheduler).
This drives two constraints:

- ONE worker only. Every worker process would start its own set of
  schedulers, so N workers = every job (alerts, notifications...) runs N times.
  Concurrency comes from threads instead.
- Load the URLconf when the worker boots. Django resolves urls.py lazily on
  the first request, so without this the schedulers would only start once
  someone hits the app (runserver did it at startup through its system checks).
"""

bind = "0.0.0.0:9002"
wsgi_app = "watcher.wsgi:application"

# Do not raise above 1, see module docstring
workers = 1
worker_class = "gthread"
threads = 8

# Some views run on-demand AI summaries (CPU inference) and can be slow
timeout = 120
graceful_timeout = 30

# No max_requests: recycling the worker would restart every scheduler mid-job

accesslog = "-"
errorlog = "-"


def post_worker_init(worker):
    """Import the URLconf so every app's start_scheduler() runs at boot."""
    from django.urls import get_resolver

    get_resolver().url_patterns
