import requests

DEFINITION = {
    'id': 'gemini',
    'name': 'Google Gemini',
    'logo': '✨',
    'category': 'Artificial Intelligence',
    'description': 'Google Gemini API integration for LLM security analysis.',
    'readonly': False,
    'version': '1.0.0',
    'author': 'Thales CERT',
    'fields': [
        {'name': 'GEMINI_API_KEY', 'label': 'API Key', 'type': 'password', 'settings_key': 'GEMINI_API_KEY', 'required': True},
        {'name': 'GEMINI_MODEL', 'label': 'Model Name', 'type': 'text', 'settings_key': 'GEMINI_MODEL', 'required': True},
        {'name': 'GEMINI_BASE_URL', 'label': 'Custom Base URL (Optional)', 'type': 'text', 'settings_key': 'GEMINI_BASE_URL', 'required': False},
    ],
}

def health_check(plain):
    api_key = plain('GEMINI_API_KEY')
    base_url = plain('GEMINI_BASE_URL')
    
    if not api_key:
        return {'success': False, 'message': 'Gemini API key not configured'}
    
    if base_url:
        test_url = f"{base_url.rstrip('/')}/models"
        headers = {'Authorization': f'Bearer {api_key}'}
        params = {}
    else:
        test_url = 'https://generativelanguage.googleapis.com/v1beta/models'
        headers = {}
        params = {'key': api_key}
        
    verify_ssl = False if base_url else True
    
    try:
        resp = requests.get(
            test_url,
            headers=headers,
            params=params,
            verify=verify_ssl,
            timeout=30
        )
        
        if resp.status_code == 200:
            return {'success': True, 'message': 'Successfully authenticated with Google Gemini API.'}
        
        try:
            error_msg = resp.json().get('error', {}).get('message', f'Unknown error (HTTP {resp.status_code})')
        except Exception:
            error_msg = f'Error HTTP {resp.status_code}: {resp.text}'
            
        return {'success': False, 'message': error_msg}
    except Exception as exc:
        return {'success': False, 'message': str(exc)}