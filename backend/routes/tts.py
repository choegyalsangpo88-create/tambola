# TTS Routes - Text-to-Speech endpoints
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import random
import logging

from services.database import get_db
from emergentintegrations.llm.openai import OpenAITextToSpeech

router = APIRouter(prefix="/tts", tags=["Text-to-Speech"])
db = get_db()
logger = logging.getLogger(__name__)


# ============ MODELS ============

class CallerVoiceSettings(BaseModel):
    settings_id: str = "global"
    voice: str = "nova"
    gender: str = "female"
    speed: float = 1.0
    accent: str = "indian"
    prefix_lines: List[str] = []
    enabled: bool = True

class UpdateCallerSettingsRequest(BaseModel):
    voice: Optional[str] = None
    gender: Optional[str] = None
    speed: Optional[float] = None
    accent: Optional[str] = None
    prefix_lines: Optional[List[str]] = None
    enabled: Optional[bool] = None


# Default prefix lines
DEFAULT_PREFIX_LINES = [
    "And the next lucky number is...",
    "Coming up next...",
    "Get ready for...",
    "Here comes...",
    "Watch out for...",
    "The ball says...",
    "Fortune favors...",
    "Lady luck brings...",
]


# ============ ROUTES ============

@router.get("/settings")
async def get_caller_settings():
    """Get current caller voice settings"""
    settings = await db.caller_settings.find_one({"settings_id": "global"}, {"_id": 0})
    if not settings:
        settings = CallerVoiceSettings().model_dump()
        settings["prefix_lines"] = DEFAULT_PREFIX_LINES
    return settings


@router.put("/settings")
async def update_caller_settings(data: UpdateCallerSettingsRequest):
    """Update caller voice settings"""
    current = await db.caller_settings.find_one({"settings_id": "global"}, {"_id": 0})
    if not current:
        current = CallerVoiceSettings().model_dump()
        current["prefix_lines"] = DEFAULT_PREFIX_LINES
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    current.update(update_data)
    
    await db.caller_settings.update_one(
        {"settings_id": "global"},
        {"$set": current},
        upsert=True
    )
    
    return current


@router.post("/generate")
async def generate_tts(text: str, include_prefix: bool = True):
    """Generate TTS audio for number calling"""
    try:
        settings = await db.caller_settings.find_one({"settings_id": "global"}, {"_id": 0})
        if not settings:
            settings = CallerVoiceSettings().model_dump()
            settings["prefix_lines"] = DEFAULT_PREFIX_LINES
        
        full_text = text
        if include_prefix and settings.get("prefix_lines"):
            prefix = random.choice(settings["prefix_lines"])
            full_text = f"{prefix} {text}"
        
        try:
            tts = OpenAITextToSpeech()
            audio_base64 = await tts.text_to_speech(
                text=full_text,
                voice=settings.get("voice", "nova"),
                speed=settings.get("speed", 1.0)
            )
            
            return {
                "audio": audio_base64,
                "text": full_text,
                "voice": settings.get("voice", "nova"),
                "use_browser_tts": False
            }
        except Exception as e:
            logger.warning(f"Server TTS failed, falling back to browser: {e}")
            return {
                "text": full_text,
                "voice": settings.get("voice", "nova"),
                "speed": settings.get("speed", 1.0),
                "use_browser_tts": True
            }
    except Exception as e:
        logger.error(f"TTS generation error: {e}")
        return {
            "text": text,
            "use_browser_tts": True,
            "error": str(e)
        }
