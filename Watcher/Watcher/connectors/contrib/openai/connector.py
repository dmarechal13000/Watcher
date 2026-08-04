import requests

DEFINITION = {
    'id': 'openai',
    'name': 'OpenAI',
    'logo': '🤖',
    'category': 'Artificial Intelligence',
    'description': 'OpenAI API integration.',
    'readonly': False,
    'version': '1.0.0',
    'author': 'Thales CERT',
    'fields': [
        {'name': 'OPENAI_API_KEY', 'label': 'API Key', 'type': 'password', 'settings_key': 'OPENAI_API_KEY', 'required': True},
        {'name': 'OPENAI_MODEL', 'label': 'Model Name', 'type': 'text', 'settings_key': 'OPENAI_MODEL', 'required': True},
        {'name': 'OPENAI_BASE_URL', 'label': 'Custom Base URL (Optional)', 'type': 'text', 'settings_key': 'OPENAI_BASE_URL', 'required': False},
    ],
}

def health_check(plain):
    api_key = plain('OPENAI_API_KEY')
    base_url = plain('OPENAI_BASE_URL')

    if not api_key:
        return {'success': False, 'message': 'OpenAI API key not configured'}

    if base_url:
        test_url = f"{base_url.rstrip('/')}/models"
    else:
        test_url = "https://api.openai.com/v1/models"

    verify_ssl = False if base_url else True

    try:
        resp = requests.get(
            test_url,
            headers={'Authorization': f'Bearer {api_key}'},
            verify=verify_ssl,
            timeout=30
        )

        if resp.status_code == 200:
            return {'success': True, 'message': 'Successfully authenticated with OpenAI API.'}
        
        try:
            error_msg = resp.json().get('error', {}).get('message', f'HTTP {resp.status_code}')
        except Exception:
            error_msg = f'Error HTTP {resp.status_code}: {resp.text}'
            
        return {'success': False, 'message': error_msg}
    except Exception as exc:
        return {'success': False, 'message': str(exc)}