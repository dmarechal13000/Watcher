import os

DEFINITION = {
    'id': 'huggingface',
    'name': 'Hugging Face (Local / Offline)',
    'logo': '🤗',
    'category': 'Artificial Intelligence',
    'description': 'Local Hugging Face transformers integration for offline fallback.',
    'readonly': False,
    'version': '1.0.0',
    'author': 'Thales CERT',
    'fields': [
        {
            'name': 'HF_LOCAL_MODEL', 
            'label': 'Local Model Path or ID', 
            'type': 'text', 
            'settings_key': 'HF_LOCAL_MODEL', 
            'required': True,
            'placeholder': 'e.g., /path/to/local/model or Qwen/Qwen2.5-0.5B'
        },
    ],
}

def health_check(plain):
    model_path = plain('HF_LOCAL_MODEL')
    
    if not model_path:
        return {'success': False, 'message': 'Local Hugging Face model path/ID not configured.'}
    
    try:
        import transformers
    except ImportError:
        return {'success': False, 'message': 'Python library "transformers" is not installed on this server.'}
    
    try:
        if os.path.isabs(model_path) and not os.path.exists(model_path):
            return {'success': False, 'message': f'Local directory not found on disk: {model_path}'}
            
        return {
            'success': True, 
            'message': f'Hugging Face local connector configured successfully for: {model_path}'
        }
        
    except Exception as exc:
        return {'success': False, 'message': f'Local HF configuration error: {str(exc)}'}