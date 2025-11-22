"""
AI Provider Abstraction Layer

Supports multiple AI providers: OpenAI, Anthropic (Claude), and Google (Gemini)
"""

import os
import json
from abc import ABC, abstractmethod
from enum import Enum
from typing import Optional

import google.generativeai as genai
import openai
import anthropic


class AIProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"


class AIModel(str, Enum):
    # OpenAI Models
    GPT_4O = "gpt-4o"
    GPT_4O_MINI = "gpt-4o-mini"
    GPT_4_1 = "gpt-4.1"
    GPT_4_1_MINI = "gpt-4.1-mini"
    O3_MINI = "o3-mini"

    # Anthropic Models
    CLAUDE_SONNET_4 = "claude-sonnet-4-20250514"
    CLAUDE_OPUS_4 = "claude-opus-4-20250514"
    CLAUDE_3_7_SONNET = "claude-3-7-sonnet-20250219"
    CLAUDE_3_5_HAIKU = "claude-3-5-haiku-20241022"

    # Google Models
    GEMINI_2_0_FLASH_lite = "gemini-2.0-flash-lite"
    GEMINI_2_0_FLASH = "gemini-2.0-flash"
    GEMINI_2_0_PRO = "gemini-2.0-pro"


# Map models to their providers
MODEL_PROVIDER_MAP = {
    AIModel.GPT_4O: AIProvider.OPENAI,
    AIModel.GPT_4O_MINI: AIProvider.OPENAI,
    AIModel.GPT_4_1: AIProvider.OPENAI,
    AIModel.GPT_4_1_MINI: AIProvider.OPENAI,
    AIModel.O3_MINI: AIProvider.OPENAI,
    AIModel.CLAUDE_SONNET_4: AIProvider.ANTHROPIC,
    AIModel.CLAUDE_OPUS_4: AIProvider.ANTHROPIC,
    AIModel.CLAUDE_3_7_SONNET: AIProvider.ANTHROPIC,
    AIModel.CLAUDE_3_5_HAIKU: AIProvider.ANTHROPIC,
    AIModel.GEMINI_2_0_PRO: AIProvider.GOOGLE,
    AIModel.GEMINI_2_0_FLASH: AIProvider.GOOGLE,
    AIModel.GEMINI_2_0_FLASH_lite: AIProvider.GOOGLE,
}


class BaseProvider(ABC):
    """Abstract base class for AI providers"""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        json_mode: bool = False,
    ) -> str:
        """Generate a response from the AI model"""
        pass


class OpenAIProvider(BaseProvider):
    """OpenAI API Provider (GPT-4, GPT-4o, etc.)"""

    # Models that don't support custom temperature (only temperature=1)
    # o-series reasoning models don't support temperature parameter
    NO_TEMPERATURE_MODELS = {"o1", "o1-mini", "o1-preview", "o3", "o3-mini", "o3-pro", "o4-mini"}

    def __init__(self, model: str):
        self.model = model
        self.client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        json_mode: bool = False,
    ) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        kwargs = {
            "model": self.model,
            "messages": messages,
        }

        # Only add temperature for models that support it
        if not any(self.model.startswith(m) for m in self.NO_TEMPERATURE_MODELS):
            kwargs["temperature"] = temperature

        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = await self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content


class AnthropicProvider(BaseProvider):
    """Anthropic API Provider (Claude models)"""

    def __init__(self, model: str):
        self.model = model
        self.client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        json_mode: bool = False,
    ) -> str:
        # For JSON mode, add instruction to the prompt
        if json_mode:
            prompt = f"{prompt}\n\nIMPORTANT: Respond with valid JSON only, no markdown formatting."

        kwargs = {
            "model": self.model,
            "max_tokens": 2048,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }

        if system_prompt:
            kwargs["system"] = system_prompt

        response = await self.client.messages.create(**kwargs)
        return response.content[0].text


class GoogleProvider(BaseProvider):
    """Google Generative AI Provider (Gemini models)"""

    def __init__(self, model: str):
        self.model_name = model
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        json_mode: bool = False,
    ) -> str:
        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt,
            generation_config={
                "temperature": temperature,
                "response_mime_type": "application/json" if json_mode else "text/plain",
            },
        )

        response = model.generate_content(prompt)
        return response.text


def get_provider(model: AIModel) -> BaseProvider:
    """Factory function to get the appropriate provider for a model"""
    provider_type = MODEL_PROVIDER_MAP.get(model)

    if provider_type == AIProvider.OPENAI:
        return OpenAIProvider(model.value)
    elif provider_type == AIProvider.ANTHROPIC:
        return AnthropicProvider(model.value)
    elif provider_type == AIProvider.GOOGLE:
        return GoogleProvider(model.value)
    else:
        raise ValueError(f"Unknown model: {model}")


def get_available_models() -> list[dict]:
    """Return list of all available models with their metadata"""
    return [
        # OpenAI
        {
            "id": AIModel.GPT_4O.value,
            "name": "GPT-4o",
            "provider": "OpenAI",
            "description": "Flagship multimodal model, great for most tasks",
        },
        {
            "id": AIModel.GPT_4O_MINI.value,
            "name": "GPT-4o Mini",
            "provider": "OpenAI",
            "description": "Fast and cost-effective for simpler tasks",
        },
        {
            "id": AIModel.GPT_4_1.value,
            "name": "GPT-4.1",
            "provider": "OpenAI",
            "description": "Latest GPT model, excellent coding and long context",
        },
        {
            "id": AIModel.GPT_4_1_MINI.value,
            "name": "GPT-4.1 Mini",
            "provider": "OpenAI",
            "description": "Smaller GPT-4.1, fast with good performance",
        },
        {
            "id": AIModel.O3_MINI.value,
            "name": "O3 Mini",
            "provider": "OpenAI",
            "description": "Reasoning model for complex problem solving",
        },
        # Anthropic
        {
            "id": AIModel.CLAUDE_SONNET_4.value,
            "name": "Claude Sonnet 4",
            "provider": "Anthropic",
            "description": "Latest Sonnet, best balance of intelligence and speed",
        },
        {
            "id": AIModel.CLAUDE_OPUS_4.value,
            "name": "Claude Opus 4",
            "provider": "Anthropic",
            "description": "Most powerful Claude model for complex tasks",
        },
        {
            "id": AIModel.CLAUDE_3_7_SONNET.value,
            "name": "Claude 3.7 Sonnet",
            "provider": "Anthropic",
            "description": "Hybrid reasoning model with extended thinking",
        },
        {
            "id": AIModel.CLAUDE_3_5_HAIKU.value,
            "name": "Claude 3.5 Haiku",
            "provider": "Anthropic",
            "description": "Fastest Claude model, great for quick tasks",
        },
        # Google
        {
            "id": AIModel.GEMINI_2_0_PRO.value,
            "name": "Gemini 2.0 Pro",
            "provider": "Google",
            "description": "Advanced reasoning with long context",
        },
        {
            "id": AIModel.GEMINI_2_0_FLASH.value,
            "name": "Gemini 2.0 Flash",
            "provider": "Google",
            "description": "Fast and efficient Gemini model",
        },
        {
            "id": AIModel.GEMINI_2_0_FLASH_lite.value,
            "name": "Gemini 2.0 Flash Lite",
            "provider": "Google",
            "description": "Lightweight and fast Gemini model",
        },
    ]
