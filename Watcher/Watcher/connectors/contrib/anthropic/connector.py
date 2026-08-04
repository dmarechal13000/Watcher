import requests

DEFINITION = {
    'id': 'anthropic',
    'name': 'Anthropic Claude',
    'logo': '🧠',
    'category': 'Artificial Intelligence',
    'description': 'Anthropic Claude API integration.',
    'readonly': False,
    'version': '1.0.0',
    'author': 'Thales CERT',
    'fields': [
        {'name': 'ANTHROPIC_API_KEY', 'label': 'API Key', 'type': 'password', 'settings_key': 'ANTHROPIC_API_KEY', 'required': True},
        {'name': 'ANTHROPIC_MODEL', 'label': 'Model Name', 'type': 'text', 'settings_key': 'ANTHROPIC_MODEL', 'required': True},
        {'name': 'ANTHROPIC_BASE_URL', 'label': 'Custom Base URL (Optional)', 'type': 'text', 'settings_key': 'ANTHROPIC_BASE_URL', 'required': False},
    ],
}

def health_check(plain):
    api_key = plain('ANTHROPIC_API_KEY')
    base_url = plain('ANTHROPIC_BASE_URL')

    if not api_key:
        return {'success': False, 'message': 'Anthropic API key not configured'}

    if base_url:
        test_url = f"{base_url.rstrip('/')}/models"
        headers = {'Authorization': f'Bearer {api_key}'}
    else:
        test_url = "https://api.anthropic.com/v1/messages"
        headers = {'x-api-key': api_key, 'anthropic-version': '2023-06-01'}

    verify_ssl = False if base_url else True

    try:
        resp = requests.get(
            test_url,
            headers=headers,
            verify=verify_ssl,
            timeout=30
        )
        
        if resp.status_code in [200, 405] or (resp.status_code == 400 and "authentication" not in resp.text.lower()):
             return {'success': True, 'message': 'Successfully connected to Anthropic gateway.'}
        
        return {'success': False, 'message': f'HTTP {resp.status_code}: {resp.text}'}
    except Exception as exc:
        return {'success': False, 'message': str(exc)}