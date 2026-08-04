from google import genai
from django.conf import settings
from ..base import BaseLLMProvider
from ..exceptions import LLMConnectionError

class GeminiProvider(BaseLLMProvider):
    """Provider for the Google Gemini API."""
    
    def __init__(self):
        self.api_key = getattr(settings, 'GEMINI_API_KEY', None)
        self.base_url = getattr(settings, 'GEMINI_BASE_URL', None)
        self.configured_model = getattr(settings, 'GEMINI_MODEL', '')
        
        if self.api_key:
            client_kwargs = {"api_key": self.api_key}
            
            if self.base_url:
                client_kwargs["http_options"] = {"base_url": self.base_url}
                
            self.client = genai.Client(**client_kwargs)
        else:
            self.client = None

    def get_name(self) -> str:
        return "gemini"

    def generate_text(self, prompt: str, **kwargs) -> str:
        if not self.client:
            raise LLMConnectionError("Gemini Error: API key is missing or empty.")
        model = kwargs.get("model", self.configured_model)
        
        if not model:
            raise LLMConnectionError("Gemini Error: No model configured in settings (GEMINI_MODEL).")
        try:
            response = self.client.models.generate_content(
                model=model,
                contents=prompt
            )
            return response.text
        except Exception as e:
            raise LLMConnectionError(f"Gemini Error: {str(e)}")

    def summarize(self, text: str, **kwargs) -> str:
        prompt = f"Provide a synthetic summary of the following text:\n\n{text}"
        return self.generate_text(prompt, **kwargs)