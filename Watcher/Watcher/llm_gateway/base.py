from abc import ABC, abstractmethod
from typing import Any

class BaseLLMProvider(ABC):
    """
    Abstract base class defining the strict contract that all 
    LLM providers must implement.
    """

    @abstractmethod
    def get_name(self) -> str:
        """
        Returns the unique identifier of the provider (e.g., 'openai', 'huggingface').
        """
        pass

    @abstractmethod
    def generate_text(self, prompt: str, **kwargs: Any) -> str:
        """
        Generates raw text from a standard prompt.
        """
        pass

    @abstractmethod
    def summarize(self, text: str, **kwargs: Any) -> str:
        """
        Generates a summary from the provided text.
        """
        pass