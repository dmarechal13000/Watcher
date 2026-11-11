import os

from django.views.generic import TemplateView

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
VERSIONED_ASSETS = ('css', os.path.join('frontend', 'main.js'))


def asset_version():
    """Latest modification time of the frontend CSS/JS, used as a cache-busting query string.

    Static files have no hash in their name, so without it a browser can keep serving a stale
    theme stylesheet next to a freshly built bundle.
    """
    latest = 0
    for entry in VERSIONED_ASSETS:
        path = os.path.join(STATIC_DIR, entry)
        if os.path.isfile(path):
            latest = max(latest, os.path.getmtime(path))
            continue
        for root, _dirs, files in os.walk(path):
            for name in files:
                latest = max(latest, os.path.getmtime(os.path.join(root, name)))
    return str(int(latest))


class IndexView(TemplateView):
    template_name = 'frontend/index.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['asset_version'] = asset_version()
        return context
