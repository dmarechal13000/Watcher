import litellm

DEFINITION = {
    'id': 'gemini',
    'name': 'Google Gemini',
    'logo': '✨',
    'category': 'Artificial Intelligence',
    'description': 'Connection to Google Gemini API via LiteLLM.',
    'readonly': False,
    'version': '1.0.0',
    'author': 'Thales CERT',
    'fields': [
        {'name': 'API_KEY', 'label': 'API Key', 'type': 'password', 'settings_key': 'GEMINI_API_KEY', 'required': True},
        {'name': 'MODEL_NAME', 'label': 'Model Name (e.g. gemini/gemini-1.5-pro)', 'type': 'text', 'settings_key': 'GEMINI_MODEL', 'required': True},
        {'name': 'BASE_URL', 'label': 'Custom Base URL (Optional)', 'type': 'text', 'settings_key': 'GEMINI_BASE_URL', 'required': False},
    ],
}

def health_check(plain):
    api_key = plain('API_KEY')
    model = plain('MODEL_NAME')
    base_url = plain('BASE_URL')

    if not model or not api_key:
        return {'success': False, 'message': 'Model name and API key are required.'}

    try:
        kwargs = {
            "model": model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 1,
            "timeout": 10,
            "api_key": api_key,
        }
        
        if base_url:
            kwargs["api_base"] = base_url

        response = litellm.completion(**kwargs)
        
        if response:
            return {'success': True, 'message': f"Successfully connected to Gemini model '{model}'!"}
        return {'success': False, 'message': 'Empty response received.'}
    except litellm.AuthenticationError:
        return {'success': False, 'message': 'Authentication failed: Invalid API Key.'}
    except litellm.APIConnectionError:
        return {'success': False, 'message': 'Connection error: Check the network or Base URL.'}
    except Exception as exc:
        return {'success': False, 'message': f"Connection Error: {str(exc)}"}