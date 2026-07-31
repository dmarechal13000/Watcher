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

    @patch('llm_gateway.services.analyzer.llm_router.generate_text')
    def test_analyzer_stops_at_level_1_if_safe(self, mock_generate_text):
        """Test smart routing: stops at Level 1 if no threat is detected."""
        mock_generate_text.return_value = "NO"
        
        service = SecurityAnalyzerService()
        result = service.analyze([{"event": "normal_login"}])
        
        self.assertFalse(result["threat_detected"])
        self.assertFalse(result["routed_to_advanced_llm"])
        self.assertEqual(mock_generate_text.call_count, 1)

    @patch('llm_gateway.services.analyzer.llm_router.generate_text')
    def test_analyzer_escalates_to_level_2_if_threat(self, mock_generate_text):
        """Test smart routing: escalates to Level 2 if a threat is suspected."""
        mock_generate_text.side_effect = [
            "YES", 
            json.dumps({
                "threat_detected": True,
                "severity": "high",
                "attack_type": "brute_force",
                "summary": "Multiple failed logins detected.",
                "recommended_action": "Block IP"
            })
        ]
        
        service = SecurityAnalyzerService()
        result = service.analyze([{"event": "login_failed", "ip": "malicious"}])
        
        self.assertTrue(result["threat_detected"])
        self.assertTrue(result["routed_to_advanced_llm"])
        self.assertEqual(result["severity"], "high")
        self.assertEqual(mock_generate_text.call_count, 2)