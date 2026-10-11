from functools import lru_cache

from supabase import Client, create_client

from common import settings


@lru_cache(maxsize=1)
def db() -> Client:
    """Service-role client. Server side only: never expose this key to the browser."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
