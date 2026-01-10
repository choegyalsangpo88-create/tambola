# Auth Routes - User authentication endpoints
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import httpx
import uuid
import hashlib
import os
import random

from services.database import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])
db = get_db()


# ============ MODELS ============

class SessionExchangeRequest(BaseModel):
    session_id: str

class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    phone: Optional[str] = None
    avatar: str = "avatar1"


# ============ AUTH HELPER ============

async def get_current_user(request: Request) -> User:
    """Get current authenticated user from session"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user_doc)


# ============ ROUTES ============

@router.post("/session")
async def exchange_session(request: SessionExchangeRequest, response: Response):
    """Exchange session_id from OAuth for session_token"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            resp.raise_for_status()
            data = resp.json()
        
        user_doc = await db.users.find_one({"email": data["email"]}, {"_id": 0})
        
        if not user_doc:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user_data = {
                "user_id": user_id,
                "email": data["email"],
                "name": data["name"],
                "picture": data.get("picture"),
                "avatar": "avatar1",
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(user_data)
            user_doc = user_data
        else:
            await db.users.update_one(
                {"user_id": user_doc["user_id"]},
                {"$set": {"name": data["name"], "picture": data.get("picture")}}
            )
        
        session_token = data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        await db.user_sessions.insert_one({
            "user_id": user_doc["user_id"],
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        })
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7*24*60*60
        )
        
        return {"user": User(**user_doc).model_dump()}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current user info"""
    return user.model_dump()


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}


@router.post("/send-otp")
async def send_otp(data: SendOTPRequest):
    """Send OTP via WhatsApp"""
    from notifications import send_whatsapp_otp
    
    phone = data.phone.strip()
    if not phone.startswith('+'):
        phone = '+' + phone
    
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    await db.otp_codes.delete_many({"phone": phone})
    await db.otp_codes.insert_one({
        "phone": phone,
        "otp": otp,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    try:
        await send_whatsapp_otp(phone, otp)
        return {"message": "OTP sent successfully", "phone": phone}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(e)}")


@router.post("/verify-otp")
async def verify_otp(data: VerifyOTPRequest, response: Response):
    """Verify OTP and login/register user"""
    phone = data.phone.strip()
    if not phone.startswith('+'):
        phone = '+' + phone
    
    otp_doc = await db.otp_codes.find_one({"phone": phone}, {"_id": 0})
    if not otp_doc:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new one.")
    
    expires_at = otp_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await db.otp_codes.delete_one({"phone": phone})
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    if otp_doc["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    await db.otp_codes.delete_one({"phone": phone})
    
    user_doc = await db.users.find_one({"phone": phone}, {"_id": 0})
    new_user = False
    
    if not user_doc:
        if not data.name:
            return {"new_user": True, "message": "Please provide your name to complete registration"}
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "phone": phone,
            "name": data.name,
            "email": f"{phone.replace('+', '')}@phone.user",
            "avatar": "avatar1",
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user_doc)
        new_user = True
    
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    return {
        "user": User(**user_doc).model_dump(),
        "new_user": new_user
    }
