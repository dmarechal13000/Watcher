import logging
from django.conf import settings
from transformers import pipeline
from ..base import BaseLLMProvider
from ..exceptions import LLMConnectionError

logger = logging.getLogger(__name__)

class HuggingFaceLocalProvider(BaseLLMProvider):
    """Provider for local Hugging Face models."""
    
    def __init__(self):
        self.configured_model = getattr(settings, 'HF_LOCAL_MODEL', '')
        self.pipeline = None

    def get_name(self) -> str:
        return "huggingface_local"

    def _load_pipeline(self):
        """Lazy loading of the model to avoid heavy memory usage at startup."""
        if not self.configured_model:
            raise LLMConnectionError("HuggingFace Error: No model configured in settings (HF_LOCAL_MODEL).")

        if self.pipeline is None:
            try:
                logger.info(f"Loading local Hugging Face model: {self.configured_model}...")
                self.pipeline = pipeline(
                    "text-generation",
                    model=self.configured_model,
                    device_map="auto"
                )
            except Exception as e:
                raise LLMConnectionError(f"Failed to load local HF model: {str(e)}")

    def generate_text(self, prompt: str, **kwargs) -> str:
        self._load_pipeline()
        try:
            max_new_tokens = kwargs.get("max_tokens", 256)
            responses = self.pipeline(
                prompt, 
                max_new_tokens=max_new_tokens,
                truncation=True,
                return_full_text=False
            )
            return responses[0]['generated_text'].strip()
        except Exception as e:
            raise LLMConnectionError(f"HuggingFace Local Error: {str(e)}")

    def summarize(self, text: str, **kwargs) -> str:
        prompt = f"Write a short summary of the following text:\n\n{text}\n\nSummary:"
        return self.generate_text(prompt, **kwargs)