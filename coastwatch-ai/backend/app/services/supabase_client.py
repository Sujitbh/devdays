"""
PelicanEye - Supabase Client

Initializes the Supabase client for database and auth operations.
"""

from supabase import create_client, Client

from app.config import SUPABASE_URL, SUPABASE_KEY

# Global Supabase client instance
_client: Client | None = None


def get_supabase() -> Client:
    """Return a singleton Supabase client."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set in .env. "
                "Get them from https://supabase.com/dashboard → Settings → API."
            )
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[PelicanEye] Supabase client initialized.")
    return _client
