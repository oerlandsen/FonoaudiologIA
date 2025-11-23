import os
from openai import AsyncOpenAI


class OpenAIService:
    """OpenAI service class."""

    def __init__(self):
        self.openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async def chat(self, text: str, model: str = "gpt-4o-mini", system_prompt: str = None) -> str:
        """Send text to OpenAI and get a response asynchronously.
        
        Args:
            text: The text to send to the model
            model: The model to use (default: gpt-4o-mini)
            system_prompt: Optional system prompt to set the behavior
            
        Returns:
            The response text from the model
        """
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": text})
        
        response = await self.openai.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=80,  # Limit to ~25 words (approximately 1 token per word)
            temperature=0.75,  # Balanced creativity
        )
        
        return response.choices[0].message.content
