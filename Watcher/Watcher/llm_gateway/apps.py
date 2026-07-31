from django.apps import AppConfig


class LlmGatewayConfig(AppConfig):
    name = 'llm_gateway'

    def ready(self):
        """Initialize the application and register LLM providers into the router."""
        from .router import llm_router
        from .providers.openai_provider import OpenAIProvider
        from .providers.anthropic_provider import AnthropicProvider
        from .providers.gemini_provider import GeminiProvider
        from .providers.company_provider import CompanyProvider
        from .providers.ollama_provider import OllamaProvider
        from .providers.hugging_face_provider import HuggingFaceLocalProvider

        # Register all available LLM providers
        llm_router.register_provider(OpenAIProvider())
        llm_router.register_provider(AnthropicProvider())
        llm_router.register_provider(GeminiProvider())
        llm_router.register_provider(CompanyProvider())
        llm_router.register_provider(OllamaProvider())
        llm_router.register_provider(HuggingFaceLocalProvider())