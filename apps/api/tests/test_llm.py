"""The backup provider: when Gemini's free quota runs out, Groq answers instead."""

import asyncio

import pytest

from app.config import settings
from app.rag import llm


@pytest.fixture()
def two_providers(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "llm_backup", "groq")
    monkeypatch.setattr(settings, "gemini_api_key", "g-key")
    monkeypatch.setattr(settings, "groq_api_key", "q-key")


def run(gen) -> str:
    async def collect():
        return "".join([p async for p in gen])
    return asyncio.run(collect())


def fake_stream(failures: dict[str, int]):
    async def stream(endpoint, system, messages, max_tokens):
        provider = endpoint[0]
        if provider in failures:
            raise llm.LLMError(f"{provider} failed", failures[provider])
        yield f"answer from {provider}"
    return stream


def test_backup_answers_when_main_is_out_of_quota(two_providers, monkeypatch):
    assert settings.llm == "gemini" and settings.llm_backup_name == "groq"
    monkeypatch.setattr(llm, "_openai_stream", fake_stream({"gemini": 429}))
    assert run(llm.stream_chat("sys", [{"role": "user", "content": "hi"}])) == "answer from groq"


def test_main_answers_when_it_works(two_providers, monkeypatch):
    monkeypatch.setattr(llm, "_openai_stream", fake_stream({}))
    assert run(llm.stream_chat("sys", [])) == "answer from gemini"


def test_a_bad_key_is_reported_not_hidden(two_providers, monkeypatch):
    monkeypatch.setattr(llm, "_openai_stream", fake_stream({"gemini": 401}))
    with pytest.raises(llm.LLMError, match="gemini failed"):
        run(llm.stream_chat("sys", []))


def test_backup_alone_is_used_when_main_has_no_key(two_providers, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", None)
    assert settings.llm == "groq" and settings.llm_backup_name is None


def test_wait_time_is_read_from_the_error():
    msg = llm._explain("gemini", 429, "limit: 20 ... Please retry in 5h14m16.2s.")
    assert msg.endswith("in 5h14m.")
