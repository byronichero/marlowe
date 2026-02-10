"""Security and auth placeholders for scaffold. Replace with JWT/OAuth when implementing."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Placeholder: no real validation in scaffold
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> dict | None:
    """Return current user payload or None (scaffold: no real auth)."""
    if credentials is None:
        return None
    # TODO: validate JWT and return user
    return {"sub": "scaffold-user", "email": "user@example.com", "role": "user"}
