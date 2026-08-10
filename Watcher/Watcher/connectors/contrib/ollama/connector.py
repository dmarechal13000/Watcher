import litellm

DEFINITION = {
    'id': 'ollama',
    'name': 'Ollama Local',
    'logo': '🦙',
    'category': 'Artificial Intelligence',
    'description': 'Connection to the local Ollama instance via LiteLLM.',
    'readonly': False,
    'version': '1.0.0',
    'author': 'Thales CERT',
    'fields': [
        {'name': 'API_KEY', 'label': 'API Key (Optional)', 'type': 'password', 'settings_key': 'OLLAMA_API_KEY', 'required': False},
        {'name': 'BASE_URL', 'label': 'Base URL', 'type': 'text', 'settings_key': 'OLLAMA_API_URL', 'required': True},
        {'name': 'MODEL_NAME', 'label': 'Model Name', 'type': 'text', 'settings_key': 'OLLAMA_MODEL', 'required': True},
    ],
}

def health_check(plain):
    api_key = plain('API_KEY') or "ollama" 
    base_url = plain('BASE_URL')
    model = plain('MODEL_NAME')

    if not model or not base_url:
        return {'success': False, 'message': 'Model name and Base URL are required.'}

    try:
        response = litellm.completion(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
            timeout=10,
            api_base=base_url,
            api_key=api_key
        )
        if response:
            return {'success': True, 'message': f"Successfully connected to Ollama model '{model}'!"}
        return {'success': False, 'message': 'Empty response received.'}
    except litellm.APIConnectionError:
        return {'success': False, 'message': 'Connection error: Check the Ollama Base URL. Is Ollama running?'}
    except Exception as exc:
        return {'success': False, 'message': f"Connection Error: {str(exc)}"}