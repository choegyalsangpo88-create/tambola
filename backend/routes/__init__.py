# Routes package
from .auth import router as auth_router, get_current_user
from .tts import router as tts_router
from .games import router as games_router

__all__ = ['auth_router', 'tts_router', 'games_router', 'get_current_user']
