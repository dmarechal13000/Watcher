import requests
from django.conf import settings
from ..base import BaseLLMProvider
from ..exceptions import LLMConnectionError

class CompanyProvider(BaseLLMProvider):
    """Provider for the internal company LLM."""
    
    def __init__(self):
        self.api_url = getattr(settings, 'COMPANY_LLM_URL', '')
        self.api_key = getattr(settings, 'COMPANY_LLM_KEY', '')
        self.configured_model = getattr(settings, 'COMPANY_MODEL', '')

    def get_name(self) -> str:
        return "company_provider"

    def generate_text(self, prompt: str, **kwargs) -> str:
        model = kwargs.get("model", self.configured_model)
        
        if not model:
            raise LLMConnectionError("CompanyProvider Error: No model configured in settings (COMPANY_MODEL).")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": kwargs.get("max_tokens", 1000)
        }
        
        try:
            response = requests.post(self.api_url, json=payload, headers=headers, timeout=20)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except requests.RequestException as e:
            raise LLMConnectionError(f"C3 Mistral API Error: {str(e)}")

    def summarize(self, text: str, **kwargs) -> str:
        prompt = f"Provide a clear and concise synthesis of the following content:\n\n{text}"
        return self.generate_text(prompt, **kwargs)