import anthropic
from django.conf import settings
from ..base import BaseLLMProvider
from ..exceptions import LLMConnectionError

class AnthropicProvider(BaseLLMProvider):
    """Provider for the Anthropic API."""
    
    def __init__(self):
        self.api_key = getattr(settings, 'ANTHROPIC_API_KEY', None)
        self.base_url = getattr(settings, 'ANTHROPIC_BASE_URL', None)
        self.configured_model = getattr(settings, 'ANTHROPIC_MODEL', '')
        
        if self.api_key:
            client_kwargs = {"api_key": self.api_key}
            if self.base_url:
                client_kwargs["base_url"] = self.base_url
            self.client = anthropic.Anthropic(**client_kwargs)
        else:
            self.client = None

    def get_name(self) -> str:
        return "anthropic"

    def generate_text(self, prompt: str, **kwargs) -> str:
        if not self.client:
            raise LLMConnectionError("Anthropic Error: API key is missing or empty.")  
        model = kwargs.get("model", self.configured_model)
        
        if not model:
            raise LLMConnectionError("Anthropic Error: No model configured in settings (ANTHROPIC_MODEL).") 
        try:
            response = self.client.messages.create(
                model=model,
                max_tokens=kwargs.get("max_tokens", 1024),
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except Exception as e:
            raise LLMConnectionError(f"Anthropic Error: {str(e)}")

    def summarize(self, text: str, **kwargs) -> str:
        prompt = f"Summarize the following text clearly and concisely:\n\n{text}"
        return self.generate_text(prompt, **kwargs)