import json
import logging
from django.conf import settings
from llm_gateway.router import llm_router
from llm_gateway.utils.log_pruner import LogPruner
from llm_gateway.utils.token_manager import TokenManager
from llm_gateway.utils.prompt_builder import PromptBuilder

logger = logging.getLogger(__name__)

class SecurityAnalyzerService:
    """Service that coordinates LLM analysis using a cost-effective two-tier strategy."""

    def __init__(self):
        self.fast_provider = "huggingface_local" # If you want, you can use "ollama"
        
        self.smart_provider = getattr(settings, 'DEFAULT_LLM_PROVIDER', 'openai')

    def analyze(self, raw_logs: list) -> dict:
        """
        Exécute l'analyse à deux niveaux pour économiser les tokens.
        """
        optimized_logs = LogPruner.compress_logs(raw_logs)
        safe_logs = TokenManager.truncate_logs(optimized_logs, max_tokens=2500)

        triage_prompt = f"Are there any signs of cyber attacks in these logs? Answer ONLY 'YES' or 'NO'.\n\n{safe_logs}"
        
        try:
            logger.info("Executing Level 1 Triage (Local Model)...")
            triage_result = llm_router.generate_text(
                triage_prompt, 
                provider_name=self.fast_provider,
                max_tokens=10
            ).strip().upper()
            
            if "YES" not in triage_result:
                return {
                    "threat_detected": False,
                    "severity": "none",
                    "summary": "No threats detected during local triage.",
                    "routed_to_advanced_llm": False
                }
                
        except Exception as e:
            logger.warning(f"Level 1 Triage failed ({str(e)}), escalating to Level 2 directly.")

        logger.info("Threat suspected! Escalating to Level 2 Analysis...")
        investigation_prompt = PromptBuilder.build_security_analysis_prompt(safe_logs)
        
        raw_response = llm_router.generate_text(
            investigation_prompt, 
            provider_name=self.smart_provider
        )

        try:
            result = json.loads(raw_response)
            result["routed_to_advanced_llm"] = True
            return result
        except json.JSONDecodeError:
            logger.error(f"Failed to parse LLM response as JSON: {raw_response}")
            return {
                "error": "Advanced LLM did not return valid JSON.",
                "raw_response": raw_response
            }