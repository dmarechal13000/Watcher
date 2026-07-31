import requests
from django.conf import settings
from ..base import BaseLLMProvider
from ..exceptions import LLMConnectionError

class OllamaProvider(BaseLLMProvider):
    """Provider for an on-premise Ollama server."""
    
    def __init__(self):
        self.api_url = getattr(settings, 'OLLAMA_API_URL', '')
        self.configured_model = getattr(settings, 'OLLAMA_MODEL', '')

    def get_name(self) -> str:
        return "ollama"

    def generate_text(self, prompt: str, **kwargs) -> str:
        model = kwargs.get("model", self.configured_model)
        
        if not model:
            raise LLMConnectionError("Ollama Error: No model configured in settings (OLLAMA_MODEL).")

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        
        try:
            response = requests.post(self.api_url, json=payload, timeout=60)
            response.raise_for_status()
            return response.json().get("response", "")
        except requests.RequestException as e:
            raise LLMConnectionError(f"Ollama Connection Error: {str(e)}")

    def summarize(self, text: str, **kwargs) -> str:
        prompt = f"Summarize the following text:\n\n{text}"
        return self.generate_text(prompt, **kwargs)