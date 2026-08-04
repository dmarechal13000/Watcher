import requests

DEFINITION = {
    'id': 'ollama',
    'name': 'Ollama',
    'logo': '🦙',
    'category': 'Artificial Intelligence',
    'description': 'Local LLM integration via Ollama server.',
    'readonly': False,
    'version': '1.0.0',
    'author': 'Thales CERT',
    'fields': [
        {'name': 'OLLAMA_URL', 'label': 'Server URL (e.g., http://localhost:11434)', 'type': 'text', 'settings_key': 'OLLAMA_URL', 'required': True},
        {'name': 'OLLAMA_MODEL', 'label': 'Model Name', 'type': 'text', 'settings_key': 'OLLAMA_MODEL', 'required': True},
    ],
}

def health_check(plain):
    url = plain('OLLAMA_URL')
    
    if not url:
        return {'success': False, 'message': 'Ollama Server URL not configured'}
    
    try:
        test_url = f"{url.rstrip('/')}/api/tags"
        
        resp = requests.get(test_url, timeout=5)
        
        if resp.status_code == 200:
            return {'success': True, 'message': 'Successfully connected to local Ollama instance.'}
            
        return {'success': False, 'message': f'Ollama returned HTTP {resp.status_code}'}
    except Exception as exc:
        return {'success': False, 'message': f"Connection failed: {str(exc)}"}