"""LLM API – list available models and check reachability."""

from fastapi import APIRouter

from app.services.llm_service import llm_list_models, llm_provider, llm_reachable

router = APIRouter()


@router.get("/health")
async def llm_health() -> dict:
    """Check if the configured LLM provider is reachable."""
    ok, err = await llm_reachable()
    return {"provider": llm_provider(), "reachable": ok, "error": err}


@router.get("/models", response_model=list[str])
async def list_models() -> list[str]:
    """Return list of model names for the configured provider."""
    return await llm_list_models()
