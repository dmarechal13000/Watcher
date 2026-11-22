from django.db import migrations

# Public default CONNECTORS_ENCRYPTION_KEY of older versions. Every instance that did not
# set its own key encrypted its connector credentials with it, so anyone could decrypt them.
# Duplicated from settings.LEGACY_PUBLIC_CONNECTORS_ENCRYPTION_KEY: migrations must not depend
# on application code that can change shape over time.
LEGACY_PUBLIC_KEY = 'mGcn94AWsOHh8i4s0yHshr4wcoPnmAnsqZXZPcrRbtY='


def _is_sensitive(field_name: str) -> bool:
    # Duplicated from connectors.core._is_sensitive (see 0004).
    substrings = ('password', 'secret', 'token', 'key', 'api_key', '_pw', '_pass')
    lower = field_name.lower()
    return any(s in lower for s in substrings)


def reencrypt_with_current_key(apps, schema_editor):
    """
    Re-encrypt every sensitive connector value with the current CONNECTORS_ENCRYPTION_KEY.

    MultiFernet.rotate() decrypts with the current key or, failing that, the legacy public
    key, then encrypts with the current key. Values readable with neither key (encrypted
    with another, unknown key) are left untouched.
    """
    from cryptography.fernet import Fernet, InvalidToken, MultiFernet
    from django.conf import settings

    rotator = MultiFernet([Fernet(settings.CONNECTORS_ENCRYPTION_KEY), Fernet(LEGACY_PUBLIC_KEY)])
    ConnectorOverride = apps.get_model('connectors', 'ConnectorOverride')

    for obj in ConnectorOverride.objects.all():
        changed = False
        for name, value in list(obj.overrides.items()):
            if not value or not isinstance(value, str) or not _is_sensitive(name):
                continue
            try:
                obj.overrides[name] = rotator.rotate(value.encode()).decode()
            except InvalidToken:
                continue
            changed = True
        if changed:
            obj.save(update_fields=['overrides'])


class Migration(migrations.Migration):

    dependencies = [
        ('connectors', '0006_rename_llm_connector_fields'),
    ]

    operations = [
        # Not reversible on purpose: going back to the public key would expose the credentials again.
        migrations.RunPython(reencrypt_with_current_key, migrations.RunPython.noop),
    ]
