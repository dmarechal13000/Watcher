import logging
import litellm
from django.conf import settings
from .exceptions import LLMConnectionError, LLMAuthenticationError, LLMQuotaExceededError, LLMGatewayError
logger = logging.getLogger(__name__)

class LLMRouter:
    """Central router that dispatches requests via LiteLLM based on active Watcher connectors."""
    
    def _get_llm_config(self, connector_id: str):
        """Fetches the configuration dynamically from Watcher's database or fallbacks to Django settings (.env)."""
        from connectors.models import ConnectorOverride 
        config = {}
        
        try:
            override = ConnectorOverride.objects.get(connector_id=connector_id)
            if override.overrides:
                config = override.overrides
        except ConnectorOverride.DoesNotExist:
            pass

        if not config:
            if connector_id == 'company_enabler':
                config = {
                    'MODEL_NAME': getattr(settings, 'COMPANY_ENABLER_MODEL', ''),
                    'API_KEY': getattr(settings, 'COMPANY_ENABLER_KEY', ''),
                    'BASE_URL': getattr(settings, 'COMPANY_ENABLER_URL', '')
                }
            elif connector_id == 'ollama':
                config = {
                    'MODEL_NAME': getattr(settings, 'OLLAMA_MODEL', ''),
                    'API_KEY': getattr(settings, 'OLLAMA_API_KEY', 'ollama'),
                    'BASE_URL': getattr(settings, 'OLLAMA_BASE_URL', '')
                }
            elif connector_id == 'openai':
                config = {
                    'MODEL_NAME': getattr(settings, 'OPENAI_MODEL', ''),
                    'API_KEY': getattr(settings, 'OPENAI_API_KEY', ''),
                    'BASE_URL': getattr(settings, 'OPENAI_BASE_URL', '')
                }
            elif connector_id == 'anthropic':
                config = {
                    'MODEL_NAME': getattr(settings, 'ANTHROPIC_MODEL', ''),
                    'API_KEY': getattr(settings, 'ANTHROPIC_API_KEY', ''),
                    'BASE_URL': getattr(settings, 'ANTHROPIC_BASE_URL', '')
                }
            elif connector_id == 'gemini':
                config = {
                    'MODEL_NAME': getattr(settings, 'GEMINI_MODEL', ''),
                    'API_KEY': getattr(settings, 'GEMINI_API_KEY', ''),
                    'BASE_URL': getattr(settings, 'GEMINI_BASE_URL', '')
                }
                
        return config

    def _call_litellm(self, prompt: str, connector_id: str, **kwargs) -> str:
        """Prepares and executes the request to any LLM via LiteLLM."""
        config = self._get_llm_config(connector_id)
        
        if not config:
            raise LLMGatewayError(f"Connector '{connector_id}' is not configured in Watcher.")

        model = config.get('MODEL_NAME')
        api_key = config.get('API_KEY')
        base_url = config.get('BASE_URL')

        if not model:
            raise LLMGatewayError(f"The MODEL_NAME field is missing for {connector_id}.")

        call_kwargs = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "timeout": kwargs.get("timeout", 15)
        }
        
        if api_key:
            call_kwargs["api_key"] = api_key
        if base_url:
            call_kwargs["api_base"] = base_url

        try:
            response = litellm.completion(**call_kwargs)
            return response.choices[0].message.content
            
        except litellm.APIConnectionError as e:
            raise LLMConnectionError(f"Unable to reach API ({connector_id}): {str(e)}")
        except litellm.AuthenticationError as e:
            raise LLMAuthenticationError(f"Authentication error ({connector_id}): {str(e)}")
        except litellm.RateLimitError as e:
            raise LLMQuotaExceededError(f"Quota or rate limit exceeded ({connector_id}): {str(e)}")
        except Exception as e:
            raise LLMGatewayError(f"Unexpected error with {connector_id}: {str(e)}")

    def _fallback_local(self, prompt: str) -> str:
        """Triggers the local model if remote APIs are inaccessible."""
        local_model_name=getattr(settings, 'LOCAL_FALLBACK_MODEL', 'google/flan-t5-base')
        logger.warning(f"Emergency fallback to the local {local_model_name} model...")
        
        try:
            from transformers import pipeline
            summarizer = pipeline("text-generation", model=local_model_name)
            response = summarizer(prompt, max_new_tokens=250, do_sample=False)
            return response[0]['generated_text']
        except Exception as e:
            logger.error(f"Critical failure of local fallback: {str(e)}")
            raise LLMGatewayError("All models, including the emergency local fallback, have failed.")

    def generate_text(self, prompt: str, provider_name: str = None, **kwargs) -> str:
        """Generates text, automatically switching to fallback if the main provider fails."""

        if not provider_name:
            try:
                from connectors.models import ConnectorOverride
                default_override = ConnectorOverride.objects.filter(is_default_llm=True).first()
                
                if default_override:
                    connector_id = default_override.connector_id
                else:
                    connector_id = getattr(settings, 'DEFAULT_LLM_PROVIDER', 'None')
            except Exception as e:
                logger.warning(f"Failed to fetch default LLM from DB: {str(e)}")
                connector_id = getattr(settings, 'DEFAULT_LLM_PROVIDER', 'None')
        else:
            connector_id = provider_name
        
        try:
            return self._call_litellm(prompt, connector_id, **kwargs)
            
        except (LLMConnectionError, LLMGatewayError) as e:
            fallback_name = getattr(settings, 'FALLBACK_LLM_PROVIDER', 'huggingface_local')
            
            logger.warning(f"Main connector '{connector_id}' failed. Reason: {str(e)}")
            
            if fallback_name == 'huggingface_local':
                return self._fallback_local(prompt)
            else:
                logger.warning(f"Attempting to switch to fallback connector: '{fallback_name}'.")
                return self._call_litellm(prompt, fallback_name, **kwargs)

    def summarize(self, text: str, provider_name: str = None, **kwargs) -> str:
        """Summarizes text, automatically switching to fallback if the main provider fails."""
        prompt = f"Please summarize the following text comprehensively:\n\n{text}"
        return self.generate_text(prompt, provider_name, **kwargs)

llm_router = LLMRouter()