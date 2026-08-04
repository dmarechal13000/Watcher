import requests

DEFINITION = {
    'id': 'company_enabler',
    'name': 'Company Enabler',
    'logo': '🏢',
    'category': 'Artificial Intelligence',
    'description': 'Internal Enterprise AI gateway for secure LLM analysis.',
    'readonly': False,
    'version': '1.0.0',
    'author': 'Thales CERT',
    'fields': [
        {'name': 'COMPANY_ENABLER_URL', 'label': 'API Endpoint URL', 'type': 'text', 'settings_key': 'COMPANY_ENABLER_URL', 'required': True},
        {'name': 'COMPANY_ENABLER_KEY', 'label': 'API Key / Token', 'type': 'password', 'settings_key': 'COMPANY_ENABLER_KEY', 'required': True},
        {'name': 'COMPANY_ENABLER_MODEL', 'label': 'Model Name', 'type': 'text', 'settings_key': 'COMPANY_ENABLER_MODEL', 'required': True},
    ],
}

def health_check(plain):
    api_url = plain('COMPANY_ENABLER_URL')
    api_key = plain('COMPANY_ENABLER_KEY')
    
    if not api_url or not api_key:
        return {'success': False, 'message': 'Company Enabler URL or API key not configured'}
    
    try:
        test_url = f"{api_url.rstrip('/')}/v1/models" 
        
        resp = requests.get(
            test_url,
            headers={'Authorization': f'Bearer {api_key}'},
            verify=False,
            timeout=5
        )
        if resp.status_code == 200:
            return {'success': True, 'message': 'Successfully authenticated with the Company Enabler.'}
        
        return {'success': False, 'message': f'Company Enabler returned HTTP {resp.status_code}'}
    except Exception as exc:
        return {'success': False, 'message': str(exc)}