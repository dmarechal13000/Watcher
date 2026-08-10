import litellm

DEFINITION = {
    'id': 'company_enabler',
    'name': 'Company Enabler',
    'logo': '🏢',
    'category': 'Artificial Intelligence',
    'description': 'Connection to the enterprise LLM via LiteLLM.',
    'readonly': False,
    'version': '1.0.0',
    'author': 'Thales CERT',
    'fields': [
        {'name': 'API_KEY', 'label': 'API Key', 'type': 'password', 'settings_key': 'COMPANY_LLM_KEY', 'required': True},
        {'name': 'BASE_URL', 'label': 'Base URL', 'type': 'text', 'settings_key': 'COMPANY_LLM_URL', 'required': True},
        {'name': 'MODEL_NAME', 'label': 'Model Name', 'type': 'text', 'settings_key': 'COMPANY_LLM_MODEL', 'required': True},
    ],
}

def health_check(plain):
    api_key = plain('API_KEY')
    base_url = plain('BASE_URL')
    model = plain('MODEL_NAME')

    if not model or not base_url or not api_key:
        return {'success': False, 'message': 'Model name, Base URL and API key are required.'}

    try:
        litellm.ssl_verify = False
        response = litellm.completion(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
            timeout=10,
            api_base=base_url,
            api_key=api_key,
            ssl_verify=False,
            extra_headers={"apikey": api_key}
        )
        if response:
            return {'success': True, 'message': f"Successfully connected to Company Enabler model '{model}'!"}
        return {'success': False, 'message': 'Empty response received.'}
    except litellm.AuthenticationError:
        return {'success': False, 'message': 'Authentication failed: Invalid API Key.'}
    except litellm.APIConnectionError:
        return {'success': False, 'message': 'Connection error: Check the Base URL or internal network.'}
    except Exception as exc:
        return {'success': False, 'message': f"Connection Error: {str(exc)}"}