import openai
from django.conf import settings
from ..base import BaseLLMProvider
from ..exceptions import LLMConnectionError

class OpenAIProvider(BaseLLMProvider):
    """Provider for the OpenAI API."""
    
    def __init__(self):
        self.api_key = getattr(settings, 'OPENAI_API_KEY', None)
        self.client = openai.OpenAI(api_key=self.api_key) if self.api_key else None
        self.configured_model = getattr(settings, 'OPENAI_MODEL', '')

    def get_name(self) -> str:
        return "openai"

    def generate_text(self, prompt: str, **kwargs) -> str:
        if not self.client:
            raise LLMConnectionError("OpenAI Error: API key is missing or empty.")
            
        model = kwargs.get("model", self.configured_model)
        
        if not model:
            raise LLMConnectionError("OpenAI Error: No model configured in settings (OPENAI_MODEL).")  
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except Exception as e:
            raise LLMConnectionError(f"OpenAI Error: {str(e)}")

    def summarize(self, text: str, **kwargs) -> str:
        prompt = f"Summarize the following text concisely:\n\n{text}"
        return self.generate_text(prompt, **kwargs)