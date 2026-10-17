"""Streaming chat with whichever LLM is configured: Gemini / Groq / OpenRouter / Ollama (OpenAI API) or Claude."""

import asyncio
import json
import re
import time
from collections.abc import AsyncIterator

import httpx

from ..config import settings

RETRIES = 3


class LLMError(RuntimeError):
    def __init__(self, message: str, status: int = 0):
        super().__init__(message)
        self.status = status

    @property
    def passing(self) -> bool:
        """Out of quota or overloaded: another provider may well work."""
        return self.status == 429 or self.status >= 500


async def stream_chat(system: str, messages: list[dict], max_tokens: int = 900) -> AsyncIterator[str]:
    """Yield the answer text as it is generated. `messages` are {"role": "user"|"assistant", "content": str}."""
    if settings.llm == "anthropic":
        async for piece in _anthropic(system, messages, max_tokens):
            yield piece
        return
    endpoints = settings.llm_endpoints()
    if not endpoints:
        raise LLMError("No LLM is configured")
    # Main provider first; if it's out of free quota or overloaded before saying anything, the backup answers.
    for i, endpoint in enumerate(endpoints):
        sent = False
        try:
            async for piece in _openai_stream(endpoint, system, messages, max_tokens):
                sent = True
                yield piece
            return
        except LLMError as exc:
            if sent or not exc.passing or i == len(endpoints) - 1:
                raise


async def _openai_stream(endpoint: tuple[str, str, str | None, str], system: str, messages: list[dict],
                         max_tokens: int) -> AsyncIterator[str]:
    provider, base_url, key, model = endpoint
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    body = {
        "model": model, "stream": True, "max_tokens": max_tokens, "temperature": 0.2,
        "messages": [{"role": "system", "content": system}, *messages],
    }
    # Reasoning models (gpt-oss) think before answering; keep that short so the answer fits and arrives quickly.
    if "gpt-oss" in model:
        body["reasoning_effort"] = "low"
        body["max_tokens"] = max_tokens + 600
    async with httpx.AsyncClient(timeout=httpx.Timeout(90, connect=15)) as client:
        for attempt in range(RETRIES + 1):
            async with client.stream("POST", f"{base_url}/chat/completions", json=body, headers=headers) as resp:
                if resp.status_code >= 400:
                    detail = (await resp.aread()).decode(errors="replace")[:400]
                    # "High demand" (503) and brief overloads pass in seconds; retry before showing an error.
                    if resp.status_code in (500, 502, 503, 504) and attempt < RETRIES:
                        await asyncio.sleep(2 * (attempt + 1))
                        continue
                    raise LLMError(_explain(provider, resp.status_code, detail), resp.status_code)
                async for piece in _sse_text(resp):
                    yield piece
                return


async def _sse_text(resp: httpx.Response) -> AsyncIterator[str]:
    """Text pieces from an OpenAI-style streaming response."""
    async for line in resp.aiter_lines():
        if not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            break
        try:
            choice = json.loads(data)["choices"][0]
        except (ValueError, KeyError, IndexError):
            continue
        piece = (choice.get("delta") or {}).get("content")
        if piece:
            yield piece


def _explain(provider: str, status: int, detail: str) -> str:
    if status in (401, 403):
        return f"The {provider} API key was rejected. Check it in apps/api/.env."
    if status in (500, 502, 503, 504):
        return f"{provider} is overloaded right now. Try again in a minute."
    if status == 429:
        # Free tiers limit requests per minute and per day. Gemini says how long to wait ("Please retry in 5h14m16s").
        wait = re.search(r"retry in ((?:\d+h)?(?:\d+m)?)(?:[\d.]+s)?", detail)
        if wait and wait.group(1):
            return f"The {provider} free limit is used up. It frees up again in {wait.group(1)}."
        return f"The {provider} free-tier limit was reached. Wait a minute and try again."
    if status == 404:
        return f"The {provider} model wasn't found. Set a model it offers in apps/api/.env. ({detail})"
    return f"{provider} returned an error ({status}): {detail}"


async def _anthropic(system: str, messages: list[dict], max_tokens: int) -> AsyncIterator[str]:
    from anthropic import APIStatusError, AsyncAnthropic

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        async with client.messages.stream(model=settings.anthropic_model, system=system, messages=messages,
                                          max_tokens=max_tokens, temperature=0.2) as stream:
            async for piece in stream.text_stream:
                yield piece
    except APIStatusError as exc:
        raise LLMError(_explain("anthropic", exc.status_code, str(exc.message)), exc.status_code) from exc


def complete_json(system: str, user: str, *, backup_first: bool = False, max_tokens: int = 1500) -> dict:
    """One non-streamed call that must return a JSON object (for background jobs like the knowledge graph).

    backup_first sends bulk work to the backup provider first (e.g. Groq), saving the main one's small free quota
    for conversations. Falls through to the other provider when one is out of quota or overloaded.
    """
    endpoints = settings.llm_endpoints()
    if not endpoints:
        raise LLMError("No LLM is configured")
    if backup_first:
        endpoints = endpoints[::-1]
    last: LLMError | None = None
    for provider, base_url, key, model in endpoints:
        body: dict = {
            "model": model, "max_tokens": max_tokens, "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        if "gpt-oss" in model:
            body["reasoning_effort"] = "low"
            body["max_tokens"] = max_tokens + 800
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        for attempt in range(RETRIES + 1):
            try:
                r = httpx.post(f"{base_url}/chat/completions", json=body, headers=headers, timeout=120)
            except httpx.HTTPError as exc:
                last = LLMError(f"{provider} couldn't be reached: {exc}", 503)
                break
            if r.status_code in (500, 502, 503, 504) and attempt < RETRIES:
                time.sleep(2 * (attempt + 1))
                continue
            if r.status_code >= 400:
                last = LLMError(_explain(provider, r.status_code, r.text[:400]), r.status_code)
                break
            try:
                content = r.json()["choices"][0]["message"]["content"] or ""
                return _loose_json(content)
            except (ValueError, KeyError, IndexError) as exc:
                last = LLMError(f"{provider} didn't return valid JSON: {exc}", 502)
                break
        if last is not None and not last.passing:
            raise last
    raise last or LLMError("No LLM answered")


def _loose_json(text: str) -> dict:
    """Parse a JSON object, tolerating ```json fences or a sentence around it."""
    text = text.strip()
    try:
        return json.loads(text)
    except ValueError:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
        raise
