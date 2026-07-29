from django.conf import settings
from .base import BaseLLMProvider
from .exceptions import LLMGatewayError

class LLMRouter:
    """
    The LLMRouter acts as a manager for LLM providers.
    It holds a registry of available providers and routes requests accordingly.
    """

    def __init__(self):
        self._providers = {}
        self._default_provider_name = getattr(settings, 'DEFAULT_LLM_PROVIDER', None)

    def register_provider(self, provider: BaseLLMProvider) -> None:
        """
        Registers an instantiated LLM provider into the router.
        """
        if not isinstance(provider, BaseLLMProvider):
            raise TypeError("Provider must be an instance of BaseLLMProvider.")
        
        self._providers[provider.get_name()] = provider

    def get_provider(self, name: str = None) -> BaseLLMProvider:
        """
        Retrieves a provider by its name.
        If no name is provided, it falls back to the default provider.
        """
        provider_name = name or self._default_provider_name
        
        if not provider_name:
            raise LLMGatewayError(
                "No provider specified and 'DEFAULT_LLM_PROVIDER' is not set in settings."
            )
            
        if provider_name not in self._providers:
            raise LLMGatewayError(f"LLM Provider '{provider_name}' is not registered.")
            
        return self._providers[provider_name]

llm_router = LLMRouter()