import json
from django.test import TestCase
from unittest.mock import patch

from llm_gateway.utils.log_pruner import LogPruner
from llm_gateway.utils.token_manager import TokenManager
from llm_gateway.utils.prompt_builder import PromptBuilder
from llm_gateway.services.analyzer import SecurityAnalyzerService

class OptimizationTests(TestCase):
    
    def test_log_pruner_cleans_noisy_fields(self):
        """Test that noisy/useless fields are properly removed."""
        raw_log = {
            "ip": "192.168.1.10",
            "event": "login_failed",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
            "session_id": "ABC123XYZ",
            "nested_data": {
                "cookie": "secret_value",
                "valid_field": "keep_this"
            }
        }
        
        cleaned_log = LogPruner.clean_log_entry(raw_log)
        
        self.assertIn("ip", cleaned_log)
        self.assertIn("event", cleaned_log)
        self.assertNotIn("user_agent", cleaned_log)
        self.assertNotIn("session_id", cleaned_log)
        self.assertNotIn("cookie", cleaned_log["nested_data"])
        self.assertIn("valid_field", cleaned_log["nested_data"])

    def test_log_pruner_compresses_duplicates(self):
        """Test that identical logs are properly grouped and compressed."""
        logs = [
            {"ip": "1.1.1.1", "status": 404},
            {"ip": "1.1.1.1", "status": 404},
            {"ip": "2.2.2.2", "status": 200}
        ]
        
        compressed = LogPruner.compress_logs(logs)
        
        self.assertIn("[x2 occurrences]", compressed)
        self.assertIn("1.1.1.1", compressed)
        self.assertIn("2.2.2.2", compressed)

    def test_token_manager_truncation(self):
        """Test that truncation properly cuts logs that exceed the limit."""
        long_text = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
        
        truncated = TokenManager.truncate_logs(long_text, max_tokens=10)
        
        self.assertIn("WARNING: Remaining logs truncated", truncated)
        self.assertNotIn("Line 5", truncated)

    def test_prompt_builder_format(self):
        """Test that the prompt builder correctly formats logs with strict system instructions."""
        safe_logs_string = '{"ip": "192.168.1.100", "event": "brute_force_attempt"}'
        
        prompt = PromptBuilder.build_security_analysis_prompt(safe_logs_string)
        
        self.assertIsInstance(prompt, str)
        
        self.assertIn("You are a strict cybersecurity AI", prompt)
        self.assertIn("EXPECTED OUTPUT FORMAT", prompt)
        self.assertIn('"threat_detected": boolean', prompt)
        
        self.assertIn("192.168.1.100", prompt)
        self.assertIn("brute_force_attempt", prompt)


    @patch('llm_gateway.services.analyzer.SecurityAnalyzerService._call_remote_llm')
    def test_analyzer_successful_remote_analysis(self, mock_call_remote):
        """Test that the analysis via the remote connector succeeds."""
        mock_call_remote.return_value = "Analysis complete: No threat detected."
        
        service = SecurityAnalyzerService()
        result = service.analyze([{"event": "normal_login"}], active_connector_id="openai_llm")
        
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["source"], "openai_llm")
        self.assertEqual(result["analysis"], "Analysis complete: No threat detected.")
        mock_call_remote.assert_called_once()

    @patch('llm_gateway.services.analyzer.SecurityAnalyzerService._call_local_fallback')
    @patch('llm_gateway.services.analyzer.SecurityAnalyzerService._call_remote_llm')
    def test_analyzer_triggers_fallback_on_failure(self, mock_call_remote, mock_call_fallback):
        """Test that the system falls back to the local model if the remote API fails."""
        mock_call_remote.side_effect = Exception("API Down or Invalid Key")
        mock_call_fallback.return_value = "Local fallback analysis."
        
        service = SecurityAnalyzerService()
        result = service.analyze([{"event": "login_failed"}], active_connector_id="broken_llm")
        
        self.assertEqual(result["status"], "degraded")
        self.assertEqual(result["source"], "local_fallback")
        self.assertEqual(result["analysis"], "Local fallback analysis.")
        mock_call_remote.assert_called_once()
        mock_call_fallback.assert_called_once()