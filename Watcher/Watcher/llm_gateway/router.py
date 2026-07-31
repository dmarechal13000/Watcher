import logging
from django.conf import settings
from .exceptions import LLMConnectionError

logger = logging.getLogger(__name__)

class LLMRouter:
    """Central router that dispatches requests to the appropriate LLM provider."""
    
    def __init__(self):
        self._providers = {}

    def register_provider(self, provider):
        """Registers an initialized provider instance."""
        self._providers[provider.get_name()] = provider

    def get_provider(self, provider_name=None):
        """Retrieves a provider by name, or the default if none is specified."""
        if not provider_name:
            provider_name = getattr(settings, 'DEFAULT_LLM_PROVIDER', None) or 'company_provider'
            
        provider = self._providers.get(provider_name)
        if not provider:
            raise ValueError(f"Provider '{provider_name}' is not registered.")
        return provider

    def generate_text(self, prompt: str, provider_name: str = None, **kwargs) -> str:
        """Generates text, automatically switching to fallback if the main provider fails."""
        provider = self.get_provider(provider_name)
        
        try:
            return provider.generate_text(prompt, **kwargs)
        except LLMConnectionError as e:
            fallback_name = getattr(settings, 'FALLBACK_LLM_PROVIDER', None) or 'huggingface_local'
            
            if provider.get_name() != fallback_name:
                logger.warning(f"Provider '{provider.get_name()}' failed. Failing over to '{fallback_name}'. Error: {str(e)}")
                fallback_provider = self.get_provider(fallback_name)
                return fallback_provider.generate_text(prompt, **kwargs)
            
            raise e

    def summarize(self, text: str, provider_name: str = None, **kwargs) -> str:
        """Summarizes text, automatically switching to fallback if the main provider fails."""
        provider = self.get_provider(provider_name)
        
        try:
            return provider.summarize(text, **kwargs)
        except LLMConnectionError as e:
            fallback_name = getattr(settings, 'FALLBACK_LLM_PROVIDER', None) or 'huggingface_local'
            
            if provider.get_name() != fallback_name:
                logger.warning(f"Provider '{provider.get_name()}' failed. Failing over to '{fallback_name}'. Error: {str(e)}")
                fallback_provider = self.get_provider(fallback_name)
                return fallback_provider.summarize(text, **kwargs)
                
            raise e

llm_router = LLMRouter()