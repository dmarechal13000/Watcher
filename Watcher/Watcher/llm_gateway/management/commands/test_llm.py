from django.core.management.base import BaseCommand
from llm_gateway.router import llm_router
from django.conf import settings

class Command(BaseCommand):
    help = 'Test the LLM router and the fallback mechanism'

    def handle(self, *args, **kwargs):
        test_text = "Watcher is an automated system designed to monitor security alerts, analyze application logs, and detect potential threats in real-time before they impact the business."
        
        self.stdout.write(self.style.NOTICE("=== LLM ROUTER TEST ==="))
        
        default_provider = getattr(settings, 'DEFAULT_LLM_PROVIDER', None) or 'company_provider'
        self.stdout.write(f"\n1. Testing default provider: [{default_provider}]")
        
        try:
            summary = llm_router.summarize(test_text)
            self.stdout.write(self.style.SUCCESS("Success! Summary generated:"))
            self.stdout.write(summary)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Failed: {str(e)}"))
        provider_to_test = "openai" 
        self.stdout.write(f"\n2. Testing specific provider: [{provider_to_test}]")
        
        try:
            summary = llm_router.summarize(test_text, provider_name=provider_to_test)
            self.stdout.write(self.style.SUCCESS("Success! Summary generated:"))
            self.stdout.write(summary)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Failed (expected if no API key): {str(e)}"))