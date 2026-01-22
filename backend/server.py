from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import random
import base64
import hashlib
import asyncio
from emergentintegrations.llm.openai import OpenAITextToSpeech
from ticket_generator import generate_full_sheet, generate_user_game_tickets, generate_authentic_ticket

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Background task flag
auto_game_task_running = False

# ============ MODELS ============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    phone: Optional[str] = None
    avatar: str = "avatar1"

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

class Game(BaseModel):
    model_config = ConfigDict(extra="ignore")
    game_id: str
    name: str
    date: str
    time: str
    price: float
    prize_pool: float
    prizes: Dict[str, float]
    status: str  # upcoming, live, completed
    ticket_count: int = 600
    available_tickets: int = 600
    created_at: datetime

class Ticket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ticket_id: str
    game_id: str
    ticket_number: str
    full_sheet_id: str  # Format: FS001, FS002, etc.
    ticket_position_in_sheet: int  # 1-6
    numbers: List[List[Optional[int]]]  # 3x9 grid
    is_booked: bool = False
    user_id: Optional[str] = None
    booking_status: str = "available"  # available, pending, confirmed

class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    booking_id: str
    user_id: str
    game_id: str
    ticket_ids: List[str]
    total_amount: float
    booking_date: datetime
    status: str  # pending, paid, cancelled (no deletion allowed)
    whatsapp_confirmed: bool = False
    whatsapp_opt_in: bool = True  # User opts in for WhatsApp notifications
    full_sheet_booked: bool = False  # True if all 6 tickets of a sheet are booked
    full_sheet_id: Optional[str] = None
    # Agent assignment fields
    assigned_agent_id: Optional[str] = None
    assigned_agent_name: Optional[str] = None
    player_phone: Optional[str] = None  # Player's WhatsApp number
    player_country_code: Optional[str] = None  # +91, +33, +1, etc.
    # Expiry mechanism (10 minutes for pending bookings)
    expires_at: Optional[datetime] = None
    payment_confirmed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[str] = None  # agent_id or "system" for auto-expiry

class GameSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    game_id: str
    called_numbers: List[int]
    current_number: Optional[int] = None
    start_time: datetime
    winners: Dict[str, Any] = Field(default_factory=dict)

# Input Models
class SessionExchangeRequest(BaseModel):
    session_id: str

class CreateGameRequest(BaseModel):
    name: str
    date: str
    time: str
    price: float
    total_tickets: int = 600
    prizes: Dict[str, float]

class BookTicketsRequest(BaseModel):
    game_id: str
    ticket_ids: List[str]

class CallNumberRequest(BaseModel):
    game_id: str

class DeclareWinnerRequest(BaseModel):
    game_id: str
    prize_type: str
    user_id: str
    ticket_id: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None

# Booking Request Models (for approval workflow)
class BookingRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    request_id: str
    user_id: str
    user_name: str
    user_email: str
    user_phone: Optional[str] = None
    game_id: str
    ticket_ids: List[str]
    total_amount: float
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime
    admin_notes: Optional[str] = None

class TicketRequestInput(BaseModel):
    game_id: str
    ticket_ids: List[str]

class ApproveRejectRequest(BaseModel):
    admin_notes: Optional[str] = None

class EditTicketHolderRequest(BaseModel):
    holder_name: str

# Caller Voice Settings Model
class CallerVoiceSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    settings_id: str = "global"
    voice: str = "nova"  # alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer
    gender: str = "female"  # male, female
    speed: float = 1.0  # 0.5 = slow, 1.0 = normal, 1.5 = fast
    accent: str = "indian"  # indian, british, american, neutral
    prefix_lines: List[str] = []  # Custom funny lines before number calling
    enabled: bool = True

class UpdateCallerSettingsRequest(BaseModel):
    voice: Optional[str] = None
    gender: Optional[str] = None
    speed: Optional[float] = None
    accent: Optional[str] = None
    prefix_lines: Optional[List[str]] = None
    enabled: Optional[bool] = None

# Admin Login Models
class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_token: str
    created_at: datetime
    expires_at: datetime
    role: str = "super_admin"  # super_admin or agent

# Agent Models for Multi-Region WhatsApp System
class Agent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    agent_id: str
    name: str
    username: str
    password_hash: str
    whatsapp_number: str  # Agent's WhatsApp number for click-to-chat
    region: str  # india, france, canada, etc.
    country_codes: List[str] = Field(default_factory=list)  # ["+91"] for India
    is_active: bool = True
    created_at: datetime
    total_bookings: int = 0
    pending_bookings: int = 0

class CreateAgentRequest(BaseModel):
    name: str
    username: str
    password: str
    whatsapp_number: str
    region: str
    country_codes: List[str]

class AgentLoginRequest(BaseModel):
    username: str
    password: str

class AgentSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_token: str
    agent_id: str
    created_at: datetime
    expires_at: datetime

# Country code to region mapping
COUNTRY_CODE_REGIONS = {
    "+91": "india",
    "+33": "france",
    "+1": "canada",  # Also covers USA
}

# User Game Models (for Create Your Own Game feature)
class UserGame(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_game_id: str
    host_user_id: str
    host_name: str
    name: str
    date: str
    time: str
    max_tickets: int = 90
    prizes_description: str = ""
    share_code: str  # Short unique code for sharing
    status: str = "upcoming"  # upcoming, live, completed
    created_at: datetime
    players: List[Dict[str, Any]] = Field(default_factory=list)  # [{name, tickets: []}]

class CreateUserGameRequest(BaseModel):
    name: str
    date: str
    time: str
    max_tickets: int = 90
    prizes_description: str = ""

class UpdateUserGameRequest(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    max_tickets: Optional[int] = None
    prizes_description: Optional[str] = None

class JoinUserGameRequest(BaseModel):
    player_name: str
    ticket_count: int = 1
    ticket_ids: Optional[List[str]] = None  # If provided, use these specific tickets

# WhatsApp OTP Models
class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None  # Required for new users

# WhatsApp Message Tracking Models
class WhatsAppMessageLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    game_id: str
    message_type: str  # booking_confirmation, game_reminder, join_link
    template_name: str = ""  # Template identifier used
    recipient_user_id: Optional[str] = None
    recipient_phone: str
    recipient_name: str
    booking_id: Optional[str] = None
    sent_at: datetime
    sent_by_admin: bool = True
    status: str = "sent"  # sent, delivered, failed
    delivery_status: str = "pending"  # pending, delivered, read, failed
    failure_reason: Optional[str] = None
    # Logs are immutable - no update operations allowed

class SendBookingConfirmationRequest(BaseModel):
    booking_id: str

class SendGameReminderRequest(BaseModel):
    game_id: str

class SendJoinLinkRequest(BaseModel):
    game_id: str
    user_id: str

class SendWinnerAnnouncementRequest(BaseModel):
    game_id: str
    prize_type: str
    winner_user_id: str
    ticket_id: Optional[str] = None

# Game Control Log Models
class GameControlLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    game_id: str
    action: str
    details: Dict[str, Any] = Field(default_factory=dict)
    admin_user: str = "admin"
    timestamp: datetime

# ============ AUTH HELPER ============

async def get_current_user(request: Request) -> User:
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify session
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user_doc)

# ============ ADMIN AUTH HELPER ============

async def verify_admin(request: Request):
    """Verify admin session token"""
    # Check cookie first
    admin_token = request.cookies.get("admin_session_token")
    
    # Fallback to Authorization header
    if not admin_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Admin "):
            admin_token = auth_header.split(" ")[1]
    
    if not admin_token:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    
    # Verify admin session
    session_doc = await db.admin_sessions.find_one({"session_token": admin_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid admin session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await db.admin_sessions.delete_one({"session_token": admin_token})
        raise HTTPException(status_code=401, detail="Admin session expired")
    
    return True

# ============ AGENT AUTH HELPER ============

async def verify_agent(request: Request):
    """Verify agent session token and return agent data"""
    # Check cookie first
    agent_token = request.cookies.get("agent_session_token")
    
    # Fallback to Authorization header
    if not agent_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Agent "):
            agent_token = auth_header.split(" ")[1]
    
    if not agent_token:
        raise HTTPException(status_code=401, detail="Agent authentication required")
    
    # Verify agent session
    session_doc = await db.agent_sessions.find_one({"session_token": agent_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid agent session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await db.agent_sessions.delete_one({"session_token": agent_token})
        raise HTTPException(status_code=401, detail="Agent session expired")
    
    # Get agent data
    agent_doc = await db.agents.find_one({"agent_id": session_doc["agent_id"]}, {"_id": 0})
    if not agent_doc:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if not agent_doc.get("is_active", True):
        raise HTTPException(status_code=403, detail="Agent account is deactivated")
    
    return agent_doc

def get_region_from_phone(phone: str) -> str:
    """Determine region from phone number country code"""
    if not phone:
        return "india"  # Default region
    
    # Clean phone number
    phone = phone.strip().replace(" ", "")
    
    # Check country codes (longest first for accuracy)
    if phone.startswith("+91"):
        return "india"
    elif phone.startswith("+33"):
        return "france"
    elif phone.startswith("+1"):
        return "canada"
    else:
        return "india"  # Default fallback

async def assign_agent_to_booking(player_phone: str) -> Optional[dict]:
    """Auto-assign an agent based on player's phone region"""
    region = get_region_from_phone(player_phone)
    
    # Find active agents in that region, sorted by least pending bookings
    agent = await db.agents.find_one(
        {"region": region, "is_active": True},
        {"_id": 0},
        sort=[("pending_bookings", 1)]
    )
    
    # Fallback to any active agent if no regional match
    if not agent:
        agent = await db.agents.find_one(
            {"is_active": True},
            {"_id": 0},
            sort=[("pending_bookings", 1)]
        )
    
    return agent

async def release_booking_tickets(booking_id: str, game_id: str, ticket_ids: List[str]):
    """Release tickets back to availability when booking is cancelled"""
    # Update tickets to be available again
    await db.tickets.update_many(
        {"ticket_id": {"$in": ticket_ids}, "game_id": game_id},
        {
            "$set": {
                "is_booked": False,
                "booking_status": "available",
                "user_id": None,
                "holder_name": None,
                "booked_at": None
            }
        }
    )

async def check_and_expire_pending_bookings():
    """Background task to expire pending bookings after 10 minutes"""
    now = datetime.now(timezone.utc)
    
    # Find expired pending bookings
    expired_bookings = await db.bookings.find({
        "status": "pending",
        "expires_at": {"$lte": now}
    }, {"_id": 0}).to_list(100)
    
    for booking in expired_bookings:
        # Cancel the booking
        await db.bookings.update_one(
            {"booking_id": booking["booking_id"]},
            {
                "$set": {
                    "status": "cancelled",
                    "cancelled_at": now,
                    "cancelled_by": "system"
                }
            }
        )
        
        # Release tickets
        await release_booking_tickets(
            booking["booking_id"],
            booking["game_id"],
            booking.get("ticket_ids", [])
        )
        
        # Update agent pending count
        if booking.get("assigned_agent_id"):
            await db.agents.update_one(
                {"agent_id": booking["assigned_agent_id"]},
                {"$inc": {"pending_bookings": -1}}
            )
        
        logger.info(f"Auto-expired booking {booking['booking_id']}")

# ============ AUTH ROUTES ============

@api_router.post("/auth/session")
async def exchange_session(request: SessionExchangeRequest, response: Response):
    """Exchange session_id for session_token"""
    try:
        logger.info(f"Auth session exchange started for session_id: {request.session_id[:10]}...")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            logger.info(f"Emergent auth response status: {resp.status_code}")
            resp.raise_for_status()
            data = resp.json()
        
        logger.info(f"User email from OAuth: {data.get('email', 'N/A')}")
        
        # Check if user exists
        user_doc = await db.users.find_one({"email": data["email"]}, {"_id": 0})
        
        if not user_doc:
            # Create new user
            logger.info("Creating new user...")
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
            logger.info(f"New user created: {user_id}")
        else:
            # Update existing user info
            logger.info(f"Updating existing user: {user_doc['user_id']}")
            await db.users.update_one(
                {"user_id": user_doc["user_id"]},
                {"$set": {"name": data["name"], "picture": data.get("picture")}}
            )
        
        # Create session
        session_token = data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        await db.user_sessions.insert_one({
            "user_id": user_doc["user_id"],
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        })
        
        logger.info("Session created successfully")
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7*24*60*60
        )
        
        # Return user AND session_token in body for mobile fallback
        result = {
            "user": User(**user_doc).model_dump(),
            "session_token": session_token  # Fallback for mobile
        }
        logger.info("Auth session exchange completed successfully")
        return result
    
    except httpx.HTTPStatusError as e:
        logger.error(f"Emergent auth API error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(status_code=400, detail=f"OAuth provider error: {str(e)}")
    except Exception as e:
        logger.error(f"Auth session exchange error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}

# ============ ADMIN AUTH ROUTES ============

@api_router.post("/admin/login")
async def admin_login(login_data: AdminLoginRequest, response: Response):
    """Admin login with username and password"""
    admin_username = os.environ.get("ADMIN_USERNAME")
    admin_password_hash = os.environ.get("ADMIN_PASSWORD_HASH")
    
    if not admin_username or not admin_password_hash:
        raise HTTPException(status_code=500, detail="Admin not configured")
    
    # Verify credentials
    if login_data.username != admin_username:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Hash provided password and compare
    provided_hash = hashlib.sha256(login_data.password.encode()).hexdigest()
    if provided_hash != admin_password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create admin session
    session_token = f"admin_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    
    # Store session
    await db.admin_sessions.insert_one({
        "session_token": session_token,
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at
    })
    
    # Set cookie
    response.set_cookie(
        key="admin_session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=24*60*60  # 24 hours
    )
    
    return {"success": True, "message": "Admin logged in", "token": session_token}

@api_router.post("/admin/logout")
async def admin_logout(request: Request, response: Response):
    """Admin logout"""
    admin_token = request.cookies.get("admin_session_token")
    if admin_token:
        await db.admin_sessions.delete_one({"session_token": admin_token})
    response.delete_cookie("admin_session_token", path="/")
    return {"message": "Admin logged out"}

@api_router.get("/admin/verify")
async def verify_admin_session(request: Request):
    """Verify admin session is valid"""
    try:
        await verify_admin(request)
        return {"valid": True}
    except HTTPException:
        return {"valid": False}

# ============ AGENT MANAGEMENT ENDPOINTS (ADMIN ONLY) ============

@api_router.post("/admin/agents")
async def create_agent(agent_data: CreateAgentRequest, request: Request, _: bool = Depends(verify_admin)):
    """Create a new agent (Super Admin only)"""
    # Check if username already exists
    existing = await db.agents.find_one({"username": agent_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    agent_id = f"agent_{uuid.uuid4().hex[:8]}"
    password_hash = hashlib.sha256(agent_data.password.encode()).hexdigest()
    
    agent_doc = {
        "agent_id": agent_id,
        "name": agent_data.name,
        "username": agent_data.username,
        "password_hash": password_hash,
        "whatsapp_number": agent_data.whatsapp_number,
        "region": agent_data.region.lower(),
        "country_codes": agent_data.country_codes,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "total_bookings": 0,
        "pending_bookings": 0
    }
    
    await db.agents.insert_one(agent_doc)
    
    # Return without password_hash and _id (MongoDB adds _id after insert)
    del agent_doc["password_hash"]
    if "_id" in agent_doc:
        del agent_doc["_id"]
    return {"success": True, "agent": agent_doc}

@api_router.get("/admin/agents")
async def list_agents(request: Request, _: bool = Depends(verify_admin)):
    """List all agents (Super Admin only)"""
    agents = await db.agents.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {"agents": agents, "total": len(agents)}

@api_router.get("/admin/agents/{agent_id}")
async def get_agent(agent_id: str, request: Request, _: bool = Depends(verify_admin)):
    """Get agent details (Super Admin only)"""
    agent = await db.agents.find_one({"agent_id": agent_id}, {"_id": 0, "password_hash": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get agent's booking stats
    bookings = await db.bookings.find({"assigned_agent_id": agent_id}, {"_id": 0}).to_list(1000)
    agent["booking_stats"] = {
        "total": len(bookings),
        "pending": len([b for b in bookings if b["status"] == "pending"]),
        "paid": len([b for b in bookings if b["status"] == "paid"]),
        "cancelled": len([b for b in bookings if b["status"] == "cancelled"])
    }
    
    return agent

@api_router.put("/admin/agents/{agent_id}")
async def update_agent(agent_id: str, request: Request, _: bool = Depends(verify_admin)):
    """Update agent details (Super Admin only)"""
    body = await request.json()
    
    agent = await db.agents.find_one({"agent_id": agent_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    update_data = {}
    allowed_fields = ["name", "whatsapp_number", "region", "country_codes", "is_active"]
    
    for field in allowed_fields:
        if field in body:
            update_data[field] = body[field]
    
    # Handle password update separately
    if "password" in body and body["password"]:
        update_data["password_hash"] = hashlib.sha256(body["password"].encode()).hexdigest()
    
    if update_data:
        await db.agents.update_one({"agent_id": agent_id}, {"$set": update_data})
    
    return {"success": True, "message": "Agent updated"}

@api_router.delete("/admin/agents/{agent_id}")
async def delete_agent(agent_id: str, request: Request, _: bool = Depends(verify_admin)):
    """Deactivate an agent (Super Admin only) - soft delete"""
    agent = await db.agents.find_one({"agent_id": agent_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Soft delete - just deactivate
    await db.agents.update_one(
        {"agent_id": agent_id},
        {"$set": {"is_active": False}}
    )
    
    # End all active sessions for this agent
    await db.agent_sessions.delete_many({"agent_id": agent_id})
    
    return {"success": True, "message": "Agent deactivated"}

# ============ AGENT AUTH ENDPOINTS ============

@api_router.post("/agent/login")
async def agent_login(login_data: AgentLoginRequest, response: Response):
    """Agent login with username and password"""
    agent = await db.agents.find_one({"username": login_data.username}, {"_id": 0})
    
    if not agent:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not agent.get("is_active", True):
        raise HTTPException(status_code=403, detail="Agent account is deactivated")
    
    # Verify password
    provided_hash = hashlib.sha256(login_data.password.encode()).hexdigest()
    if provided_hash != agent.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create agent session
    session_token = f"agent_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(hours=12)
    
    await db.agent_sessions.insert_one({
        "session_token": session_token,
        "agent_id": agent["agent_id"],
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at
    })
    
    response.set_cookie(
        key="agent_session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=12*60*60
    )
    
    # Return agent info without password
    del agent["password_hash"]
    return {"success": True, "agent": agent, "token": session_token}

@api_router.post("/agent/logout")
async def agent_logout(request: Request, response: Response):
    """Agent logout"""
    agent_token = request.cookies.get("agent_session_token")
    auth_header = request.headers.get("Authorization")
    if not agent_token and auth_header and auth_header.startswith("Agent "):
        agent_token = auth_header.split(" ")[1]
    
    if agent_token:
        await db.agent_sessions.delete_one({"session_token": agent_token})
    response.delete_cookie("agent_session_token", path="/")
    return {"message": "Agent logged out"}

@api_router.get("/agent/verify")
async def verify_agent_session(request: Request):
    """Verify agent session is valid"""
    try:
        agent = await verify_agent(request)
        if "password_hash" in agent:
            del agent["password_hash"]
        return {"valid": True, "agent": agent}
    except HTTPException:
        return {"valid": False}

@api_router.get("/agent/me")
async def get_agent_profile(agent: dict = Depends(verify_agent)):
    """Get current agent profile"""
    if "password_hash" in agent:
        del agent["password_hash"]
    return agent

# ============ AGENT BOOKING ENDPOINTS ============

@api_router.get("/agent/dashboard")
async def get_agent_dashboard(agent: dict = Depends(verify_agent)):
    """Get agent dashboard stats"""
    agent_id = agent["agent_id"]
    
    # Get agent's bookings
    bookings = await db.bookings.find({"assigned_agent_id": agent_id}, {"_id": 0}).to_list(1000)
    
    pending = [b for b in bookings if b["status"] == "pending"]
    paid = [b for b in bookings if b["status"] == "paid"]
    cancelled = [b for b in bookings if b["status"] == "cancelled"]
    
    # Get today's stats
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    todays_bookings = [b for b in bookings if b.get("booking_date") and 
                       (b["booking_date"] if isinstance(b["booking_date"], datetime) else datetime.fromisoformat(str(b["booking_date"]))) >= today]
    
    # Calculate revenue
    total_revenue = sum(b.get("total_amount", 0) for b in paid)
    
    return {
        "agent": {
            "name": agent["name"],
            "region": agent["region"],
            "whatsapp_number": agent["whatsapp_number"]
        },
        "stats": {
            "total_bookings": len(bookings),
            "pending_bookings": len(pending),
            "paid_bookings": len(paid),
            "cancelled_bookings": len(cancelled),
            "todays_bookings": len(todays_bookings),
            "total_revenue": total_revenue
        }
    }

@api_router.get("/agent/bookings")
async def get_agent_bookings(
    agent: dict = Depends(verify_agent),
    status: Optional[str] = None,
    game_id: Optional[str] = None
):
    """Get agent's assigned bookings only"""
    agent_id = agent["agent_id"]
    
    query = {"assigned_agent_id": agent_id}
    if status:
        query["status"] = status
    if game_id:
        query["game_id"] = game_id
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("booking_date", -1).to_list(500)
    
    # Enrich with game and user info
    for booking in bookings:
        game = await db.games.find_one({"game_id": booking["game_id"]}, {"_id": 0, "name": 1, "date": 1, "time": 1, "status": 1, "price": 1})
        booking["game"] = game
        
        user = await db.users.find_one({"user_id": booking["user_id"]}, {"_id": 0, "name": 1, "phone": 1})
        booking["user"] = user
        
        # Get ticket numbers
        tickets = await db.tickets.find({"ticket_id": {"$in": booking.get("ticket_ids", [])}}, {"_id": 0, "ticket_number": 1}).to_list(20)
        booking["ticket_numbers"] = [t["ticket_number"] for t in tickets]
    
    return {"bookings": bookings, "total": len(bookings)}

@api_router.put("/agent/bookings/{booking_id}/mark-paid")
async def agent_mark_booking_paid(booking_id: str, agent: dict = Depends(verify_agent)):
    """Agent marks a pending booking as paid after manual WhatsApp payment verification"""
    agent_id = agent["agent_id"]
    
    # Get booking
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # STRICT VALIDATION: Agent can only access their own bookings
    if booking.get("assigned_agent_id") != agent_id:
        raise HTTPException(status_code=403, detail="You can only manage your own assigned bookings")
    
    # STRICT VALIDATION: Only pending bookings can be marked as paid
    if booking["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot mark {booking['status']} booking as paid")
    
    # Get game status
    game = await db.games.find_one({"game_id": booking["game_id"]}, {"_id": 0, "status": 1})
    
    # STRICT VALIDATION: Cannot modify bookings for completed games
    if game and game.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Cannot modify bookings for completed games")
    
    # Update booking status
    now = datetime.now(timezone.utc)
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {
            "$set": {
                "status": "paid",
                "payment_confirmed_at": now,
                "expires_at": None  # Clear expiry for paid bookings
            }
        }
    )
    
    # Update ticket statuses
    await db.tickets.update_many(
        {"ticket_id": {"$in": booking.get("ticket_ids", [])}},
        {"$set": {"booking_status": "confirmed"}}
    )
    
    # Update agent stats
    await db.agents.update_one(
        {"agent_id": agent_id},
        {
            "$inc": {"pending_bookings": -1, "total_bookings": 1}
        }
    )
    
    return {"success": True, "message": "Booking marked as paid"}

@api_router.put("/agent/bookings/{booking_id}/cancel")
async def agent_cancel_booking(booking_id: str, agent: dict = Depends(verify_agent)):
    """Agent cancels/unbooks a pending booking - releases tickets back to availability"""
    agent_id = agent["agent_id"]
    
    # Get booking
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # STRICT VALIDATION: Agent can only access their own bookings
    if booking.get("assigned_agent_id") != agent_id:
        raise HTTPException(status_code=403, detail="You can only manage your own assigned bookings")
    
    # STRICT VALIDATION: Only pending bookings can be cancelled by agents
    if booking["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot cancel {booking['status']} booking. Only pending bookings can be cancelled.")
    
    # Get game status
    game = await db.games.find_one({"game_id": booking["game_id"]}, {"_id": 0, "status": 1})
    
    # STRICT VALIDATION: Cannot cancel bookings for live or completed games
    if game and game.get("status") in ["live", "completed"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel bookings for {game['status']} games")
    
    # Cancel booking (soft delete - status change)
    now = datetime.now(timezone.utc)
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": now,
                "cancelled_by": agent_id
            }
        }
    )
    
    # Release tickets back to availability
    await release_booking_tickets(
        booking_id,
        booking["game_id"],
        booking.get("ticket_ids", [])
    )
    
    # Update agent stats
    await db.agents.update_one(
        {"agent_id": agent_id},
        {"$inc": {"pending_bookings": -1}}
    )
    
    return {"success": True, "message": "Booking cancelled and tickets released"}

@api_router.get("/agent/games")
async def get_agent_games(agent: dict = Depends(verify_agent)):
    """Get games that agent has bookings for"""
    agent_id = agent["agent_id"]
    
    # Get unique game IDs from agent's bookings
    bookings = await db.bookings.find({"assigned_agent_id": agent_id}, {"_id": 0, "game_id": 1}).to_list(1000)
    game_ids = list(set(b["game_id"] for b in bookings))
    
    # Get games
    games = await db.games.find({"game_id": {"$in": game_ids}}, {"_id": 0}).sort("date", -1).to_list(100)
    
    # Add booking counts for each game
    for game in games:
        game_bookings = [b for b in bookings if b.get("game_id") == game["game_id"]]
        game["agent_bookings"] = len(game_bookings)
    
    return {"games": games, "total": len(games)}

# ============ PUBLIC BOOKING WITH AGENT ASSIGNMENT ============

@api_router.post("/bookings/with-agent")
async def create_booking_with_agent(
    game_id: str,
    ticket_ids: List[str],
    player_phone: str,
    player_name: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Create a booking and auto-assign an agent based on player's phone region"""
    # Get game
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game.get("status") != "upcoming":
        raise HTTPException(status_code=400, detail="Can only book tickets for upcoming games")
    
    # Format phone and determine region
    formatted_phone = format_phone(player_phone)
    country_code = None
    for code in ["+91", "+33", "+1"]:
        if formatted_phone.startswith(code):
            country_code = code
            break
    
    # Auto-assign agent based on region
    assigned_agent = await assign_agent_to_booking(formatted_phone)
    
    # Create booking with 10-minute expiry
    booking_id = f"bk_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=10)
    
    booking_doc = {
        "booking_id": booking_id,
        "user_id": user.user_id,
        "game_id": game_id,
        "ticket_ids": ticket_ids,
        "total_amount": len(ticket_ids) * game.get("price", 0),
        "booking_date": now,
        "status": "pending",
        "player_phone": formatted_phone,
        "player_country_code": country_code,
        "assigned_agent_id": assigned_agent["agent_id"] if assigned_agent else None,
        "assigned_agent_name": assigned_agent["name"] if assigned_agent else None,
        "expires_at": expires_at,
        "whatsapp_opt_in": True
    }
    
    await db.bookings.insert_one(booking_doc)
    
    # Update ticket statuses
    await db.tickets.update_many(
        {"ticket_id": {"$in": ticket_ids}},
        {
            "$set": {
                "is_booked": True,
                "booking_status": "pending",
                "user_id": user.user_id,
                "holder_name": player_name or user.name,
                "booked_at": now
            }
        }
    )
    
    # Update agent pending count
    if assigned_agent:
        await db.agents.update_one(
            {"agent_id": assigned_agent["agent_id"]},
            {"$inc": {"pending_bookings": 1}}
        )
    
    # Return booking with agent WhatsApp for click-to-chat
    return {
        "booking_id": booking_id,
        "status": "pending",
        "expires_at": expires_at.isoformat(),
        "assigned_agent": {
            "name": assigned_agent["name"] if assigned_agent else None,
            "whatsapp_number": assigned_agent["whatsapp_number"] if assigned_agent else None,
            "region": assigned_agent["region"] if assigned_agent else None
        } if assigned_agent else None,
        "message": "Booking created. Contact the agent on WhatsApp to complete payment."
    }

@api_router.get("/agents/by-region/{region}")
async def get_agent_for_region(region: str):
    """Get the assigned agent's WhatsApp for a region (for click-to-chat redirect)"""
    agent = await db.agents.find_one(
        {"region": region.lower(), "is_active": True},
        {"_id": 0, "name": 1, "whatsapp_number": 1, "region": 1}
    )
    
    if not agent:
        # Fallback to any active agent
        agent = await db.agents.find_one(
            {"is_active": True},
            {"_id": 0, "name": 1, "whatsapp_number": 1, "region": 1}
        )
    
    if not agent:
        raise HTTPException(status_code=404, detail="No agents available")
    
    return agent

# ============ WHATSAPP OTP AUTH ============

def generate_otp():
    """Generate a 6-digit OTP"""
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])

def format_phone(phone: str) -> str:
    """Format phone number to E.164 format"""
    phone = phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        # Assume Indian number if no country code
        if phone.startswith("0"):
            phone = phone[1:]
        phone = "+91" + phone
    return phone

@api_router.post("/auth/send-otp")
async def send_otp(request: SendOTPRequest):
    """Send OTP via WhatsApp"""
    from notifications import send_whatsapp_message
    
    phone = format_phone(request.phone)
    otp = generate_otp()
    
    # Store OTP in database with expiry
    await db.otp_codes.delete_many({"phone": phone})  # Remove old OTPs
    await db.otp_codes.insert_one({
        "phone": phone,
        "otp": otp,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "verified": False
    })
    
    # Send OTP via WhatsApp
    message = f"""🔐 *Tambola Login OTP*

Your OTP is: *{otp}*

This code expires in 10 minutes.
Do not share this code with anyone.

If you didn't request this, please ignore."""
    
    result = send_whatsapp_message(phone, message)
    
    if result:
        return {"success": True, "message": "OTP sent to your WhatsApp"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")

@api_router.post("/auth/verify-otp")
async def verify_otp(request: VerifyOTPRequest, response: Response):
    """Verify OTP and login/register user"""
    phone = format_phone(request.phone)
    
    # Find OTP record
    otp_record = await db.otp_codes.find_one({
        "phone": phone,
        "otp": request.otp,
        "verified": False
    }, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Check expiry
    expires_at = otp_record["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    # Mark OTP as verified
    await db.otp_codes.update_one(
        {"phone": phone, "otp": request.otp},
        {"$set": {"verified": True}}
    )
    
    # Check if user exists
    user_doc = await db.users.find_one({"phone": phone}, {"_id": 0})
    
    if not user_doc:
        # New user - need name
        if not request.name:
            return {
                "success": True,
                "new_user": True,
                "message": "OTP verified. Please provide your name to complete registration."
            }
        
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_data = {
            "user_id": user_id,
            "email": f"{phone.replace('+', '')}@phone.user",  # Placeholder email
            "name": request.name,
            "phone": phone,
            "avatar": "avatar1",
            "auth_method": "whatsapp",
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user_data)
        user_doc = user_data
    
    # Create session
    session_token = uuid.uuid4().hex + uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    # Clean up OTP
    await db.otp_codes.delete_many({"phone": phone})
    
    return {
        "success": True,
        "new_user": False,
        "user": User(**user_doc).model_dump(),
        "session_token": session_token  # Include for mobile localStorage fallback
    }

# ============ GAME ROUTES ============

@api_router.get("/games", response_model=List[Game])
async def get_games(status: Optional[str] = None, include_recent_completed: bool = False):
    """
    Get games. By default excludes completed games older than 5 minutes.
    - status: Filter by specific status (upcoming, live, completed)
    - include_recent_completed: If True, includes games completed within last 5 mins
    """
    if status:
        query = {"status": status}
    else:
        # Default: Get upcoming and live games, plus recently completed (within 5 mins)
        five_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
        query = {
            "$or": [
                {"status": {"$in": ["upcoming", "live"]}},
                {
                    "status": "completed",
                    "completed_at": {"$gte": five_mins_ago.isoformat()}
                }
            ]
        }
    
    games = await db.games.find(query, {"_id": 0}).to_list(100)
    return games

@api_router.get("/games/recent-completed")
async def get_recent_completed_games():
    """Get games completed within the last 5 minutes (for showing in live section with 'Just Ended' badge)"""
    five_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
    
    games = await db.games.find({
        "status": "completed",
        "completed_at": {"$gte": five_mins_ago.isoformat()}
    }, {"_id": 0}).sort("completed_at", -1).to_list(20)
    
    # Enrich with winner info
    for game in games:
        session = await db.game_sessions.find_one({"game_id": game["game_id"]}, {"_id": 0, "winners": 1})
        game["winners"] = session.get("winners", {}) if session else {}
    
    return games

@api_router.get("/games/completed")
async def get_completed_games():
    """Get archived completed games (older than 5 minutes) for results section"""
    five_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
    
    # Get games completed more than 5 minutes ago
    games = await db.games.find({
        "status": "completed",
        "$or": [
            {"completed_at": {"$lt": five_mins_ago.isoformat()}},
            {"completed_at": {"$exists": False}}  # Handle old games without completed_at
        ]
    }, {"_id": 0}).sort("completed_at", -1).to_list(100)
    
    # Enrich with winner info
    for game in games:
        session = await db.game_sessions.find_one({"game_id": game["game_id"]}, {"_id": 0, "winners": 1})
        game["winners"] = session.get("winners", {}) if session else {}
    
    return games

@api_router.get("/games/{game_id}", response_model=Game)
async def get_game(game_id: str):
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@api_router.post("/games", response_model=Game)
async def create_game(game_data: CreateGameRequest):
    # Check for duplicate game (same name + date + time)
    existing_game = await db.games.find_one({
        "name": game_data.name,
        "date": game_data.date,
        "time": game_data.time
    })
    
    if existing_game:
        raise HTTPException(
            status_code=400,
            detail=f"A game with the same name, date, and time already exists. Please change at least one field (e.g., time) to create a new game."
        )
    
    game_id = f"game_{uuid.uuid4().hex[:8]}"
    
    prizes = dict(game_data.prizes)
    # Full Sheet Bonus removed - no longer auto-added
    
    prize_pool = sum(prizes.values())
    
    total_tickets = game_data.dict().get('total_tickets', 600)
    
    # Validate tickets must be multiple of 6 (for full sheets)
    if total_tickets % 6 != 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Total tickets must be a multiple of 6 (for full sheets). Got {total_tickets}. Try {(total_tickets // 6) * 6} or {((total_tickets // 6) + 1) * 6}."
        )
    
    if total_tickets < 6:
        raise HTTPException(status_code=400, detail="Minimum 6 tickets (1 full sheet) required")
    
    game = {
        "game_id": game_id,
        "name": game_data.name,
        "date": game_data.date,
        "time": game_data.time,
        "price": game_data.price,
        "prize_pool": prize_pool,
        "prizes": prizes,
        "status": "upcoming",
        "ticket_count": total_tickets,
        "available_tickets": total_tickets,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.games.insert_one(game)
    
    # Auto-generate tickets for the game using full sheet rule
    # Each full sheet has 6 tickets containing all numbers 1-90
    tickets = []
    ticket_counter = 1
    num_sheets = total_tickets // 6  # Exact number of full sheets
    
    for sheet_num in range(1, num_sheets + 1):
        full_sheet = generate_full_sheet()
        sheet_id = f"FS{sheet_num:03d}"
        
        # Calculate Full Sheet Corner numbers ONCE when sheet is created
        # Corner numbers are: TL and TR of Ticket 1, BL and BR of Ticket 6
        first_ticket_numbers = full_sheet[0]  # Ticket 1
        last_ticket_numbers = full_sheet[5]   # Ticket 6
        
        def get_row_corners(row):
            """Get leftmost and rightmost numbers in a row"""
            nums_with_pos = [(idx, num) for idx, num in enumerate(row) if num is not None]
            if len(nums_with_pos) < 2:
                return None, None
            nums_with_pos.sort(key=lambda x: x[0])
            return nums_with_pos[0][1], nums_with_pos[-1][1]
        
        top_left, top_right = get_row_corners(first_ticket_numbers[0])  # First row of Ticket 1
        bottom_left, bottom_right = get_row_corners(last_ticket_numbers[2])  # Last row of Ticket 6
        
        # Store corner numbers for this full sheet
        sheet_corner_numbers = [top_left, top_right, bottom_left, bottom_right]
        
        for ticket_num_in_sheet, ticket_numbers in enumerate(full_sheet, 1):
            ticket = {
                "ticket_id": f"{game_id}_T{ticket_counter:03d}",
                "game_id": game_id,
                "ticket_number": f"T{ticket_counter:03d}",
                "full_sheet_id": sheet_id,
                "ticket_position_in_sheet": ticket_num_in_sheet,
                "numbers": ticket_numbers,
                "is_booked": False,
                "booking_status": "available",
                "sheet_corner_numbers": sheet_corner_numbers  # Store FSC corners on each ticket
            }
            tickets.append(ticket)
            ticket_counter += 1
    
    if tickets:
        await db.tickets.insert_many(tickets)
    
    return Game(**game)

@api_router.put("/games/{game_id}", response_model=Game)
async def update_game(game_id: str, game_data: CreateGameRequest):
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Only allow editing upcoming games
    if game["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Can only edit upcoming games")
    
    prize_pool = sum(game_data.prizes.values())
    
    update_data = {
        "name": game_data.name,
        "date": game_data.date,
        "time": game_data.time,
        "price": game_data.price,
        "prize_pool": prize_pool,
        "prizes": game_data.prizes
    }
    
    await db.games.update_one(
        {"game_id": game_id},
        {"$set": update_data}
    )
    
    updated_game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    return Game(**updated_game)

# ============ TICKET ROUTES ============

# Ticket generation now uses ticket_generator.py module
# The generate_full_sheet function is imported from there

@api_router.post("/games/{game_id}/generate-tickets")
async def generate_tickets(game_id: str):
    """Generate 600 tickets (100 Full Sheets × 6 tickets each) for a game"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check if tickets already exist
    existing_count = await db.tickets.count_documents({"game_id": game_id})
    if existing_count > 0:
        return {"message": f"Tickets already generated ({existing_count} tickets)"}
    
    tickets = []
    ticket_counter = 1
    
    # Generate 100 Full Sheets (each with 6 tickets)
    for sheet_num in range(1, 101):
        full_sheet = generate_full_sheet()
        sheet_id = f"FS{sheet_num:03d}"
        
        for ticket_num_in_sheet, ticket_numbers in enumerate(full_sheet, 1):
            ticket = {
                "ticket_id": f"{game_id}_T{ticket_counter:03d}",
                "game_id": game_id,
                "ticket_number": f"T{ticket_counter:03d}",
                "full_sheet_id": sheet_id,
                "ticket_position_in_sheet": ticket_num_in_sheet,
                "numbers": ticket_numbers,
                "is_booked": False,
                "booking_status": "available"
            }
            tickets.append(ticket)
            ticket_counter += 1
    
    await db.tickets.insert_many(tickets)
    return {"message": f"Generated 600 tickets (100 Full Sheets × 6 tickets) for game {game_id}"}

@api_router.get("/games/{game_id}/tickets")
async def get_game_tickets(
    game_id: str,
    page: int = 1,
    limit: int = 20,
    available_only: bool = False
):
    skip = (page - 1) * limit
    query = {"game_id": game_id}
    if available_only:
        query["is_booked"] = False
    
    tickets = await db.tickets.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.tickets.count_documents(query)
    
    return {
        "tickets": tickets,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

# ============ BOOKING ROUTES ============

@api_router.post("/bookings", response_model=Booking)
async def create_booking(
    booking_data: BookTicketsRequest,
    user: User = Depends(get_current_user)
):
    game = await db.games.find_one({"game_id": booking_data.game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check tickets are available
    tickets = await db.tickets.find(
        {"ticket_id": {"$in": booking_data.ticket_ids}, "is_booked": False},
        {"_id": 0}
    ).to_list(len(booking_data.ticket_ids))
    
    if len(tickets) != len(booking_data.ticket_ids):
        raise HTTPException(status_code=400, detail="Some tickets are already booked")
    
    # Check for Full Sheet booking (all 6 tickets of same sheet) - for Full Sheet Corner eligibility
    full_sheets = {}
    for ticket in tickets:
        sheet_id = ticket.get("full_sheet_id", "")
        if sheet_id not in full_sheets:
            full_sheets[sheet_id] = []
        full_sheets[sheet_id].append(ticket["ticket_position_in_sheet"])
    
    # Check if any full sheet has all 6 tickets
    full_sheet_booked = False
    booked_sheet_id = None
    for sheet_id, positions in full_sheets.items():
        if len(positions) == 6 and set(positions) == {1, 2, 3, 4, 5, 6}:
            full_sheet_booked = True
            booked_sheet_id = sheet_id
            break
    
    # Create booking
    booking_id = f"booking_{uuid.uuid4().hex[:8]}"
    total_amount = game["price"] * len(booking_data.ticket_ids)
    
    booking = {
        "booking_id": booking_id,
        "user_id": user.user_id,
        "game_id": booking_data.game_id,
        "ticket_ids": booking_data.ticket_ids,
        "total_amount": total_amount,
        "booking_date": datetime.now(timezone.utc),
        "status": "pending",
        "whatsapp_confirmed": False,
        "full_sheet_booked": full_sheet_booked,
        "full_sheet_id": booked_sheet_id
    }
    
    await db.bookings.insert_one(booking)
    
    # Mark tickets as booked
    update_fields = {
        "is_booked": True,
        "user_id": user.user_id,
        "booking_status": "pending",
        "holder_name": user.name
    }
    
    # If this is a full sheet booking, mark those tickets specially
    if full_sheet_booked and booked_sheet_id:
        # Mark the full sheet tickets with booking_type = "FULL_SHEET"
        await db.tickets.update_many(
            {"ticket_id": {"$in": booking_data.ticket_ids}, "full_sheet_id": booked_sheet_id},
            {
                "$set": {
                    **update_fields,
                    "booking_type": "FULL_SHEET",
                    "full_sheet_booked": True
                }
            }
        )
        # Mark remaining tickets (if any) as regular
        non_sheet_tickets = [t["ticket_id"] for t in tickets if t.get("full_sheet_id") != booked_sheet_id]
        if non_sheet_tickets:
            await db.tickets.update_many(
                {"ticket_id": {"$in": non_sheet_tickets}},
                {"$set": {**update_fields, "booking_type": "RANDOM"}}
            )
    else:
        # Regular booking - mark all as random
        await db.tickets.update_many(
            {"ticket_id": {"$in": booking_data.ticket_ids}},
            {"$set": {**update_fields, "booking_type": "RANDOM"}}
        )
    
    # Update available tickets count
    await db.games.update_one(
        {"game_id": booking_data.game_id},
        {"$inc": {"available_tickets": -len(booking_data.ticket_ids)}}
    )
    
    return Booking(**booking)

@api_router.get("/bookings/my", response_model=List[Booking])
async def get_my_bookings(user: User = Depends(get_current_user)):
    bookings = await db.bookings.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    return bookings

@api_router.get("/bookings/{booking_id}/tickets")
async def get_booking_tickets(booking_id: str, user: User = Depends(get_current_user)):
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    tickets = await db.tickets.find(
        {"ticket_id": {"$in": booking["ticket_ids"]}},
        {"_id": 0}
    ).to_list(len(booking["ticket_ids"]))
    
    game = await db.games.find_one({"game_id": booking["game_id"]}, {"_id": 0})
    
    return {
        "booking": booking,
        "tickets": tickets,
        "game": game
    }

# ============ ADMIN ROUTES ============

@api_router.get("/admin/bookings")
async def get_all_bookings(request: Request, status: Optional[str] = None, _: bool = Depends(verify_admin)):
    query = {} if not status else {"status": status}
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(100)
    
    # Enrich with user and game info
    for booking in bookings:
        user = await db.users.find_one({"user_id": booking["user_id"]}, {"_id": 0})
        game = await db.games.find_one({"game_id": booking["game_id"]}, {"_id": 0})
        booking["user"] = user
        booking["game"] = game
    
    return bookings

@api_router.put("/admin/bookings/{booking_id}/confirm")
async def confirm_booking(booking_id: str, request: Request, _: bool = Depends(verify_admin)):
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    result = await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "confirmed", "whatsapp_confirmed": True}}
    )
    
    # Get user info for holder name
    user = await db.users.find_one({"user_id": booking["user_id"]}, {"_id": 0})
    holder_name = user.get("name", "Player") if user else "Player"
    
    # Update ticket status with holder name
    await db.tickets.update_many(
        {"ticket_id": {"$in": booking["ticket_ids"]}},
        {"$set": {
            "booking_status": "confirmed",
            "holder_name": holder_name,
            "booked_by_name": holder_name
        }}
    )
    
    return {"message": "Booking confirmed"}

# ============ ADMIN GAME MANAGEMENT ============

@api_router.delete("/admin/games/{game_id}")
async def delete_game(game_id: str, request: Request, force: bool = False, _: bool = Depends(verify_admin)):
    """Delete a game and all associated tickets/bookings"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Only allow deleting live games with force=True
    if game["status"] == "live" and not force:
        raise HTTPException(status_code=400, detail="Cannot delete a live game. Use force=true to override.")
    
    # Delete all associated data
    await db.tickets.delete_many({"game_id": game_id})
    await db.bookings.delete_many({"game_id": game_id})
    await db.booking_requests.delete_many({"game_id": game_id})
    await db.game_sessions.delete_many({"game_id": game_id})
    await db.games.delete_one({"game_id": game_id})
    
    return {"message": f"Game {game_id} and all associated data deleted"}

@api_router.get("/admin/games/{game_id}/tickets")
async def get_game_tickets_admin(game_id: str, request: Request, status: Optional[str] = None, _: bool = Depends(verify_admin)):
    """Get all tickets for a game with booking info (admin)"""
    query = {"game_id": game_id}
    if status:
        if status == "booked":
            query["is_booked"] = True
        elif status == "available":
            query["is_booked"] = False
    
    tickets = await db.tickets.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with user info for booked tickets
    for ticket in tickets:
        if ticket.get("user_id"):
            user = await db.users.find_one({"user_id": ticket["user_id"]}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
            ticket["holder"] = user
    
    return {"tickets": tickets, "total": len(tickets)}

@api_router.put("/admin/tickets/{ticket_id}/holder")
async def update_ticket_holder_name(ticket_id: str, data: EditTicketHolderRequest, request: Request, _: bool = Depends(verify_admin)):
    """Edit the holder name for a booked ticket"""
    ticket = await db.tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if not ticket.get("is_booked"):
        raise HTTPException(status_code=400, detail="Ticket is not booked")
    
    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"holder_name": data.holder_name}}
    )
    
    return {"message": f"Ticket holder updated to {data.holder_name}"}

@api_router.post("/admin/tickets/{ticket_id}/cancel")
async def cancel_ticket(ticket_id: str, request: Request, _: bool = Depends(verify_admin)):
    """Cancel a booked ticket and return it to available pool"""
    ticket = await db.tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if not ticket.get("is_booked"):
        raise HTTPException(status_code=400, detail="Ticket is not booked")
    
    game_id = ticket["game_id"]
    
    # Reset ticket to available
    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "is_booked": False,
            "user_id": None,
            "booking_status": "available",
            "holder_name": None
        }}
    )
    
    # Update game available tickets count
    await db.games.update_one(
        {"game_id": game_id},
        {"$inc": {"available_tickets": 1}}
    )
    
    # Remove from booking if exists
    await db.bookings.update_many(
        {"ticket_ids": ticket_id},
        {"$pull": {"ticket_ids": ticket_id}}
    )
    
    return {"message": "Ticket cancelled and returned to available pool"}

# ============ BOOKING REQUEST (APPROVAL WORKFLOW) ============

@api_router.post("/booking-requests")
async def create_booking_request(
    request_data: TicketRequestInput,
    user: User = Depends(get_current_user)
):
    """User requests tickets - goes to pending for admin approval"""
    game = await db.games.find_one({"game_id": request_data.game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Game is not accepting bookings")
    
    # Check tickets are available
    tickets = await db.tickets.find(
        {"ticket_id": {"$in": request_data.ticket_ids}, "is_booked": False},
        {"_id": 0}
    ).to_list(len(request_data.ticket_ids))
    
    if len(tickets) != len(request_data.ticket_ids):
        raise HTTPException(status_code=400, detail="Some tickets are not available")
    
    # Check user doesn't already have pending request for these tickets
    existing = await db.booking_requests.find_one({
        "user_id": user.user_id,
        "game_id": request_data.game_id,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending request for this game")
    
    # Create booking request
    request_id = f"req_{uuid.uuid4().hex[:8]}"
    total_amount = game["price"] * len(request_data.ticket_ids)
    
    booking_request = {
        "request_id": request_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "user_email": user.email,
        "user_phone": user.phone if hasattr(user, 'phone') else None,
        "game_id": request_data.game_id,
        "ticket_ids": request_data.ticket_ids,
        "total_amount": total_amount,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.booking_requests.insert_one(booking_request)
    
    # Temporarily reserve tickets
    await db.tickets.update_many(
        {"ticket_id": {"$in": request_data.ticket_ids}},
        {"$set": {"booking_status": "pending", "reserved_by": user.user_id}}
    )
    
    return {
        "request_id": request_id,
        "message": "Booking request submitted. Awaiting admin approval.",
        "total_amount": total_amount
    }

@api_router.get("/booking-requests/my")
async def get_my_booking_requests(user: User = Depends(get_current_user)):
    """Get user's booking requests"""
    requests = await db.booking_requests.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).to_list(100)
    return requests

@api_router.get("/booking-requests/{request_id}")
async def get_booking_request(request_id: str, user: User = Depends(get_current_user)):
    """Get a specific booking request by ID (for checkout page)"""
    req = await db.booking_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Booking request not found")
    
    # Verify user owns this request
    if req["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this booking request")
    
    # Enrich with game info
    game = await db.games.find_one({"game_id": req["game_id"]}, {"_id": 0, "name": 1, "date": 1, "time": 1, "price": 1})
    if game:
        req["game_name"] = game.get("name", "Tambola Game")
        req["game_date"] = game.get("date")
        req["game_time"] = game.get("time")
    
    # Get ticket numbers
    tickets = await db.tickets.find(
        {"ticket_id": {"$in": req.get("ticket_ids", [])}},
        {"_id": 0, "ticket_number": 1}
    ).to_list(100)
    req["ticket_numbers"] = [t["ticket_number"] for t in tickets]
    req["ticket_count"] = len(req.get("ticket_ids", []))
    
    return req

@api_router.get("/admin/booking-requests")
async def get_all_booking_requests(request: Request, status: Optional[str] = None, _: bool = Depends(verify_admin)):
    """Get all booking requests (admin)"""
    query = {} if not status else {"status": status}
    requests = await db.booking_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with game info
    for req in requests:
        game = await db.games.find_one({"game_id": req["game_id"]}, {"_id": 0, "name": 1, "date": 1, "time": 1})
        req["game"] = game
    
    return requests

@api_router.put("/admin/booking-requests/{request_id}/approve")
async def approve_booking_request(request_id: str, request: Request, data: ApproveRejectRequest = None, _: bool = Depends(verify_admin)):
    """Approve a booking request"""
    req = await db.booking_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req['status']}")
    
    # Create actual booking
    booking_id = f"booking_{uuid.uuid4().hex[:8]}"
    booking = {
        "booking_id": booking_id,
        "user_id": req["user_id"],
        "game_id": req["game_id"],
        "ticket_ids": req["ticket_ids"],
        "total_amount": req["total_amount"],
        "booking_date": datetime.now(timezone.utc),
        "status": "confirmed",
        "whatsapp_confirmed": True
    }
    
    await db.bookings.insert_one(booking)
    
    # Mark tickets as booked
    await db.tickets.update_many(
        {"ticket_id": {"$in": req["ticket_ids"]}},
        {"$set": {
            "is_booked": True,
            "user_id": req["user_id"],
            "booking_status": "confirmed",
            "holder_name": req["user_name"]
        }}
    )
    
    # Update available tickets count
    await db.games.update_one(
        {"game_id": req["game_id"]},
        {"$inc": {"available_tickets": -len(req["ticket_ids"])}}
    )
    
    # Update request status
    update_data = {"status": "approved", "approved_at": datetime.now(timezone.utc)}
    if data and data.admin_notes:
        update_data["admin_notes"] = data.admin_notes
    
    await db.booking_requests.update_one(
        {"request_id": request_id},
        {"$set": update_data}
    )
    
    return {"message": "Booking approved", "booking_id": booking_id}

@api_router.put("/admin/booking-requests/{request_id}/reject")
async def reject_booking_request(request_id: str, request: Request, data: ApproveRejectRequest = None, _: bool = Depends(verify_admin)):
    """Reject a booking request"""
    req = await db.booking_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req['status']}")
    
    # Release reserved tickets
    await db.tickets.update_many(
        {"ticket_id": {"$in": req["ticket_ids"]}},
        {"$set": {"booking_status": "available", "reserved_by": None}}
    )
    
    # Update request status
    update_data = {"status": "rejected", "rejected_at": datetime.now(timezone.utc)}
    if data and data.admin_notes:
        update_data["admin_notes"] = data.admin_notes
    
    await db.booking_requests.update_one(
        {"request_id": request_id},
        {"$set": update_data}
    )
    
    return {"message": "Booking request rejected"}

# ============ CALLER VOICE SETTINGS ============

# Default prefix lines for Tambola
DEFAULT_PREFIX_LINES = [
    "Agle number pe dhyan do...",
    "Lucky number aa raha hai...",
    "Ready everyone?",
    "Tambola ke raja kehte hain...",
    "Ek aur special number...",
    "Housie housie!",
    "Check your tickets for...",
    "And the next number is...",
    "Get ready to mark...",
    "Bole toh..."
]

# Voice mapping based on gender
VOICE_MAP = {
    "female": ["nova", "shimmer", "coral", "alloy"],
    "male": ["onyx", "echo", "fable", "ash"]
}

@api_router.get("/admin/caller-settings")
async def get_caller_settings(request: Request, _: bool = Depends(verify_admin)):
    """Get global caller voice settings"""
    settings = await db.caller_settings.find_one({"settings_id": "global"}, {"_id": 0})
    
    if not settings:
        # Create default settings
        settings = {
            "settings_id": "global",
            "voice": "nova",
            "gender": "female",
            "speed": 1.0,
            "accent": "indian",
            "prefix_lines": DEFAULT_PREFIX_LINES.copy(),
            "enabled": True
        }
        await db.caller_settings.insert_one(settings)
    
    return settings

@api_router.put("/admin/caller-settings")
async def update_caller_settings(data: UpdateCallerSettingsRequest, request: Request, _: bool = Depends(verify_admin)):
    """Update global caller voice settings"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    # Auto-select appropriate voice based on gender
    if "gender" in update_data:
        voices = VOICE_MAP.get(update_data["gender"], VOICE_MAP["female"])
        if "voice" not in update_data or update_data.get("voice") not in voices:
            update_data["voice"] = voices[0]
    
    if update_data:
        await db.caller_settings.update_one(
            {"settings_id": "global"},
            {"$set": update_data},
            upsert=True
        )
    
    # Fetch and return updated settings
    settings = await db.caller_settings.find_one({"settings_id": "global"}, {"_id": 0})
    return settings

@api_router.post("/admin/caller-settings/prefix-lines")
async def add_prefix_line(line: str, request: Request, _: bool = Depends(verify_admin)):
    """Add a custom prefix line"""
    await db.caller_settings.update_one(
        {"settings_id": "global"},
        {"$push": {"prefix_lines": line}},
        upsert=True
    )
    return {"message": "Prefix line added"}

@api_router.delete("/admin/caller-settings/prefix-lines/{index}")
async def delete_prefix_line(index: int, request: Request, _: bool = Depends(verify_admin)):
    """Delete a prefix line by index"""
    settings = await db.caller_settings.find_one({"settings_id": "global"}, {"_id": 0})
    if not settings or "prefix_lines" not in settings:
        raise HTTPException(status_code=404, detail="No prefix lines found")
    
    if index < 0 or index >= len(settings["prefix_lines"]):
        raise HTTPException(status_code=400, detail="Invalid index")
    
    prefix_lines = settings["prefix_lines"]
    del prefix_lines[index]
    
    await db.caller_settings.update_one(
        {"settings_id": "global"},
        {"$set": {"prefix_lines": prefix_lines}}
    )
    return {"message": "Prefix line deleted"}

@api_router.post("/admin/caller-settings/reset-prefix-lines")
async def reset_prefix_lines(request: Request, _: bool = Depends(verify_admin)):
    """Reset prefix lines to defaults"""
    await db.caller_settings.update_one(
        {"settings_id": "global"},
        {"$set": {"prefix_lines": DEFAULT_PREFIX_LINES.copy()}},
        upsert=True
    )
    return {"message": "Prefix lines reset to defaults"}

# ============ TTS ENDPOINT ============

@api_router.post("/tts/generate")
async def generate_tts(text: str, include_prefix: bool = True):
    """Generate TTS audio for a number call using OpenAI TTS via emergentintegrations"""
    try:
        settings = await db.caller_settings.find_one({"settings_id": "global"}, {"_id": 0})
        if not settings:
            settings = {
                "voice": "nova",
                "speed": 1.0,
                "prefix_lines": DEFAULT_PREFIX_LINES.copy(),
                "enabled": True
            }
        
        if not settings.get("enabled"):
            return {"enabled": False, "audio": None}
        
        # Add random prefix line for the text display
        full_text = text
        if include_prefix and settings.get("prefix_lines"):
            prefix = random.choice(settings["prefix_lines"])
            full_text = f"{prefix} {text}"
        
        # TTS generation using emergentintegrations
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        
        if api_key:
            try:
                tts = OpenAITextToSpeech(api_key=api_key)
                
                # Generate speech as base64
                audio_base64 = await tts.generate_speech_base64(
                    text=full_text,
                    model="tts-1",
                    voice=settings.get("voice", "nova"),
                    speed=settings.get("speed", 1.0)
                )
                
                return {
                    "enabled": True,
                    "audio": audio_base64,
                    "text": full_text,
                    "format": "mp3",
                    "use_browser_tts": False
                }
            except Exception as e:
                logger.warning(f"OpenAI TTS failed, using browser fallback: {str(e)}")
        
        # Fallback: Return text for browser-based speech synthesis
        return {
            "enabled": True,
            "audio": None,
            "text": full_text,
            "format": None,
            "use_browser_tts": True,
            "voice_settings": {
                "voice": settings.get("voice", "nova"),
                "speed": settings.get("speed", 1.0),
                "gender": settings.get("gender", "female")
            }
        }
    except Exception as e:
        logger.error(f"TTS generation failed: {str(e)}")
        return {"enabled": False, "audio": None, "error": str(e)}

# ============ LIVE GAME ROUTES ============

@api_router.post("/games/{game_id}/start")
async def start_game(game_id: str):
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Update game status
    await db.games.update_one(
        {"game_id": game_id},
        {"$set": {"status": "live"}}
    )
    
    # Create game session
    session = {
        "game_id": game_id,
        "called_numbers": [],
        "current_number": None,
        "start_time": datetime.now(timezone.utc),
        "winners": {}
    }
    
    await db.game_sessions.insert_one(session)
    return {"message": "Game started"}

@api_router.post("/games/{game_id}/call-number")
async def call_number(game_id: str):
    session = await db.game_sessions.find_one({"game_id": game_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    called_numbers = session["called_numbers"]
    
    # Generate next number (1-90)
    available_numbers = [n for n in range(1, 91) if n not in called_numbers]
    if not available_numbers:
        return {" message": "All numbers called"}
    
    next_number = random.choice(available_numbers)
    
    # Update session
    await db.game_sessions.update_one(
        {"game_id": game_id},
        {
            "$push": {"called_numbers": next_number},
            "$set": {"current_number": next_number}
        }
    )
    
    # Auto-detect winners after calling number
    from winner_detection import auto_detect_winners
    from notifications import send_winner_email, send_winner_sms
    
    existing_winners = session.get("winners", {})
    
    # Get game prizes (dividends) for proper detection
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    game_dividends = game.get("prizes", {}) if game else {}
    
    new_winners = await auto_detect_winners(db, game_id, called_numbers + [next_number], existing_winners, game_dividends)
    
    # Update winners and send notifications
    if new_winners:
        game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
        all_winners = {**existing_winners, **new_winners}
        
        await db.game_sessions.update_one(
            {"game_id": game_id},
            {"$set": {"winners": all_winners}}
        )
        
        # Send notifications to new winners
        for prize_type, winner_info in new_winners.items():
            prize_amount = game["prizes"].get(prize_type, 0)
            
            # Get winner name - check holder_name first (from winner_detection), then fallback
            winner_name = winner_info.get("holder_name") or winner_info.get("user_name") or winner_info.get("name") or "Player"
            winner_email = winner_info.get("user_email", "")
            
            # Send email
            send_winner_email(
                winner_email,
                winner_name,
                prize_type,
                prize_amount,
                game["name"]
            )
            
            # Send SMS (if phone number available)
            user_id = winner_info.get("user_id")
            if user_id:
                user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
                if user and user.get("phone"):
                    send_winner_sms(
                        user["phone"],
                        winner_name,
                        prize_type,
                        prize_amount
                    )
            
            logger.info(f"🎉 Winner notified: {winner_name} - {prize_type} - ₹{prize_amount}")
    
    return {"number": next_number, "called_numbers": called_numbers + [next_number], "new_winners": list(new_winners.keys())}

@api_router.get("/games/{game_id}/session")
async def get_game_session(game_id: str):
    session = await db.game_sessions.find_one({"game_id": game_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    return session

@api_router.post("/games/{game_id}/declare-winner")
async def declare_winner(winner_data: DeclareWinnerRequest):
    session = await db.game_sessions.find_one({"game_id": winner_data.game_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    user = await db.users.find_one({"user_id": winner_data.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    game = await db.games.find_one({"game_id": winner_data.game_id}, {"_id": 0})
    
    # Update winners
    winners = session.get("winners", {})
    winners[winner_data.prize_type] = {
        "user_id": winner_data.user_id,
        "user_name": user["name"],
        "ticket_id": winner_data.ticket_id
    }
    
    await db.game_sessions.update_one(
        {"game_id": winner_data.game_id},
        {"$set": {"winners": winners}}
    )
    
    # Winner Notification (Mocked - Ready for integration)
    # To implement: Install SendGrid (pip install sendgrid) or use Push service
    # Send email: "Congratulations {user_name}! You won {prize_type} in {game_name}!"
    # "For claiming, share your account details on WhatsApp: [WHATSAPP_NUMBER]"
    logger.info(f"🎉 Winner notification: {user['email']} won {winner_data.prize_type} - Prize: ₹{game['prizes'].get(winner_data.prize_type, 0)}")
    logger.info(f"Email content: Congratulations {user['name']}! For claiming share ur account details in WhatsApp")
    
    return {"message": f"Winner declared for {winner_data.prize_type}. Notification sent!"}

@api_router.post("/games/{game_id}/end")
async def end_game(game_id: str):
    """End a game and run the Full Sheet Lucky Draw if configured"""
    
    # Get game details
    game = await db.games.find_one({"game_id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Get current session to access winners
    session = await db.game_sessions.find_one({"game_id": game_id})
    existing_winners = session.get("winners", {}) if session else {}
    
    # Check if Full Sheet Lucky Draw is a prize
    game_prizes = game.get("prizes", {})
    lucky_draw_prize = None
    lucky_draw_amount = 0
    
    for prize_name in game_prizes:
        if "lucky draw" in prize_name.lower() or "full sheet lucky" in prize_name.lower():
            lucky_draw_prize = prize_name
            lucky_draw_amount = game_prizes[prize_name]
            break
    
    lucky_draw_result = None
    
    # Run Full Sheet Lucky Draw if enabled and not already won
    if lucky_draw_prize and lucky_draw_prize not in existing_winners:
        # Get all eligible full sheets (complete 6-ticket bookings)
        pipeline = [
            {"$match": {"game_id": game_id, "is_booked": True}},
            {"$group": {
                "_id": "$full_sheet_id",
                "count": {"$sum": 1},
                "holder_name": {"$first": "$holder_name"},
                "booked_by_user_id": {"$first": "$booked_by_user_id"},
                "tickets": {"$push": "$ticket_number"}
            }},
            {"$match": {"count": 6, "_id": {"$ne": None}}}  # Only complete sheets
        ]
        
        eligible_sheets = await db.tickets.aggregate(pipeline).to_list(None)
        
        if eligible_sheets:
            # Randomly select winner
            import random
            winner_sheet = random.choice(eligible_sheets)
            
            # Sort ticket numbers for display
            tickets = sorted(winner_sheet["tickets"], key=lambda x: int(''.join(filter(str.isdigit, x)) or 0))
            first_ticket = tickets[0] if tickets else "T001"
            last_ticket = tickets[-1] if tickets else "T006"
            
            lucky_draw_result = {
                "full_sheet_id": winner_sheet["_id"],
                "holder_name": winner_sheet["holder_name"] or "Unknown",
                "user_id": winner_sheet["booked_by_user_id"],
                "ticket_number": winner_sheet["_id"],  # Display as FS003
                "ticket_range": f"{first_ticket}–{last_ticket}",
                "pattern": "Full Sheet Lucky Draw",
                "is_lucky_draw": True,
                "prize_amount": lucky_draw_amount,
                "eligible_count": len(eligible_sheets),
                "eligible_sheets": [s["_id"] for s in eligible_sheets]
            }
            
            # Store winner in session
            await db.game_sessions.update_one(
                {"game_id": game_id},
                {"$set": {f"winners.{lucky_draw_prize}": lucky_draw_result}},
                upsert=True
            )
            
            logger.info(f"🎰 LUCKY DRAW WINNER: {winner_sheet['holder_name']} - {winner_sheet['_id']}")
            logger.info(f"   Eligible sheets: {len(eligible_sheets)}")
    
    # Update game status
    await db.games.update_one(
        {"game_id": game_id},
        {"$set": {
            "status": "completed", 
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "lucky_draw_result": lucky_draw_result
        }}
    )
    
    return {
        "message": "Game ended",
        "lucky_draw": lucky_draw_result
    }

# ============ PROFILE ROUTES ============

@api_router.put("/profile")
async def update_profile(
    profile_data: UpdateProfileRequest,
    user: User = Depends(get_current_user)
):
    update_data = {}
    if profile_data.name:
        update_data["name"] = profile_data.name
    if profile_data.avatar:
        update_data["avatar"] = profile_data.avatar
    
    if update_data:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**updated_user)

# ============ USER GAMES ROUTES (Create Your Own Game) ============

def generate_share_code():
    """Generate a short unique share code"""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # Excluding confusing chars
    return ''.join(random.choices(chars, k=6))

def generate_user_game_tickets(max_tickets: int):
    """Generate tickets for a user game - simplified version"""
    tickets = []
    num_sheets = (max_tickets + 5) // 6  # Round up to full sheets
    ticket_counter = 1
    
    for sheet_num in range(1, num_sheets + 1):
        if ticket_counter > max_tickets:
            break
        full_sheet = generate_full_sheet()
        sheet_id = f"FS{sheet_num:03d}"
        
        for ticket_num_in_sheet, ticket_numbers in enumerate(full_sheet, 1):
            if ticket_counter > max_tickets:
                break
            ticket = {
                "ticket_id": f"UGT{ticket_counter:03d}",
                "ticket_number": f"T{ticket_counter:03d}",
                "full_sheet_id": sheet_id,
                "ticket_position_in_sheet": ticket_num_in_sheet,
                "numbers": ticket_numbers,
                "assigned_to": None
            }
            tickets.append(ticket)
            ticket_counter += 1
    
    return tickets

@api_router.post("/user-games")
async def create_user_game(
    game_data: CreateUserGameRequest,
    user: User = Depends(get_current_user)
):
    """Create a new user game for family/party"""
    
    # Check for duplicate game (same name + date + time by same host)
    existing = await db.user_games.find_one({
        "host_user_id": user.user_id,
        "name": game_data.name,
        "date": game_data.date,
        "time": game_data.time
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="A game with same name, date and time already exists. Please change at least one."
        )
    
    user_game_id = f"ug_{uuid.uuid4().hex[:8]}"
    share_code = generate_share_code()
    
    # Ensure share code is unique
    while await db.user_games.find_one({"share_code": share_code}):
        share_code = generate_share_code()
    
    # Generate tickets with proper structure using Full Sheets
    from ticket_generator import generate_full_sheet
    
    tickets = []
    num_sheets = (game_data.max_tickets + 5) // 6  # Round up to full sheets
    actual_ticket_count = 0
    
    for sheet_num in range(num_sheets):
        sheet_id = f"FS{sheet_num + 1:03d}"
        full_sheet = generate_full_sheet()
        
        for position, ticket_numbers in enumerate(full_sheet, 1):
            if actual_ticket_count >= game_data.max_tickets:
                break
            tickets.append({
                "ticket_id": f"t_{uuid.uuid4().hex[:8]}",
                "ticket_number": f"T{actual_ticket_count + 1:02d}",
                "full_sheet_id": sheet_id,
                "ticket_position_in_sheet": position,
                "numbers": ticket_numbers,
                "assigned_to": None,
                "assigned_to_id": None,
                "is_booked": False
            })
            actual_ticket_count += 1
        
        if actual_ticket_count >= game_data.max_tickets:
            break
    
    # Default dividends for user games
    dividends = {
        "Early Five": 0,
        "Top Line": 0,
        "Middle Line": 0,
        "Bottom Line": 0,
        "Full House": 0
    }
    
    user_game = {
        "user_game_id": user_game_id,
        "host_user_id": user.user_id,
        "host_name": user.name,
        "name": game_data.name,
        "date": game_data.date,
        "time": game_data.time,
        "max_tickets": game_data.max_tickets,
        "prizes_description": game_data.prizes_description,
        "share_code": share_code,
        "status": "upcoming",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "players": [],
        "tickets": tickets,
        "dividends": dividends,
        "called_numbers": [],
        "current_number": None,
        "winners": {},
        "auto_call_enabled": True
    }
    
    await db.user_games.insert_one(user_game)
    
    # Remove _id and tickets from response for lighter payload
    user_game.pop("_id", None)
    user_game.pop("tickets", None)
    
    return user_game

@api_router.get("/user-games/my")
async def get_my_user_games(user: User = Depends(get_current_user)):
    """Get all games created by current user"""
    games = await db.user_games.find(
        {"host_user_id": user.user_id},
        {"_id": 0, "tickets": 0}
    ).to_list(100)
    return games

@api_router.get("/user-games/code/{share_code}")
async def get_user_game_by_code(share_code: str):
    """Get game details by share code (public endpoint for joining)"""
    game = await db.user_games.find_one(
        {"share_code": share_code.upper()},
        {"_id": 0, "tickets": 0}
    )
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@api_router.get("/user-games/code/{share_code}/tickets")
async def get_user_game_tickets_by_code(share_code: str):
    """Get all tickets for a user game by share code (for ticket selection)"""
    game = await db.user_games.find_one(
        {"share_code": share_code.upper()},
        {"_id": 0}
    )
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    tickets = game.get("tickets", [])
    return {
        "user_game_id": game.get("user_game_id"),
        "name": game.get("name"),
        "status": game.get("status"),
        "tickets": tickets,
        "total": len(tickets),
        "available": len([t for t in tickets if not t.get("assigned_to")])
    }

@api_router.get("/user-games/{user_game_id}")
async def get_user_game(user_game_id: str):
    """Get full game details including tickets"""
    game = await db.user_games.find_one(
        {"user_game_id": user_game_id},
        {"_id": 0}
    )
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@api_router.put("/user-games/{user_game_id}")
async def update_user_game(
    user_game_id: str,
    game_data: UpdateUserGameRequest,
    user: User = Depends(get_current_user)
):
    """Update a user game (host only)"""
    game = await db.user_games.find_one({"user_game_id": user_game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["host_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can edit")
    
    if game["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Can only edit upcoming games")
    
    update_data = {k: v for k, v in game_data.model_dump().items() if v is not None}
    
    if update_data:
        await db.user_games.update_one(
            {"user_game_id": user_game_id},
            {"$set": update_data}
        )
    
    updated = await db.user_games.find_one(
        {"user_game_id": user_game_id},
        {"_id": 0, "tickets": 0}
    )
    return updated

@api_router.delete("/user-games/{user_game_id}")
async def delete_user_game(
    user_game_id: str,
    user: User = Depends(get_current_user)
):
    """Delete a user game (host only)"""
    game = await db.user_games.find_one({"user_game_id": user_game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["host_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can delete")
    
    await db.user_games.delete_one({"user_game_id": user_game_id})
    return {"message": "Game deleted successfully"}

@api_router.post("/user-games/{user_game_id}/join")
async def join_user_game(
    user_game_id: str,
    join_data: JoinUserGameRequest
):
    """Join a user game (public - just needs name). Supports specific ticket selection."""
    game = await db.user_games.find_one({"user_game_id": user_game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Cannot join game that has started")
    
    # Find available tickets
    tickets = game.get("tickets", [])
    available_tickets = [t for t in tickets if not t.get("assigned_to")]
    
    # If specific ticket_ids provided, use those
    if join_data.ticket_ids and len(join_data.ticket_ids) > 0:
        # Validate requested tickets are available
        available_ids = {t["ticket_id"] for t in available_tickets}
        requested_ids = set(join_data.ticket_ids)
        
        unavailable = requested_ids - available_ids
        if unavailable:
            raise HTTPException(
                status_code=400,
                detail=f"Some tickets are not available: {list(unavailable)}"
            )
        
        assigned_ticket_ids = join_data.ticket_ids
    else:
        # Random assignment based on ticket_count
        if len(available_tickets) < join_data.ticket_count:
            raise HTTPException(
                status_code=400,
                detail=f"Only {len(available_tickets)} tickets available"
            )
        
        assigned_ticket_ids = [available_tickets[i]["ticket_id"] for i in range(join_data.ticket_count)]
    
    # Assign tickets to player
    for t in tickets:
        if t["ticket_id"] in assigned_ticket_ids:
            t["assigned_to"] = join_data.player_name
    
    # Add player to players list
    player_entry = {
        "name": join_data.player_name,
        "tickets": assigned_ticket_ids,
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_games.update_one(
        {"user_game_id": user_game_id},
        {
            "$push": {"players": player_entry},
            "$set": {"tickets": tickets}
        }
    )
    
    # Get the assigned tickets to return
    player_tickets = [t for t in tickets if t["ticket_id"] in assigned_ticket_ids]
    
    return {
        "message": f"Welcome {join_data.player_name}!",
        "player_name": join_data.player_name,
        "tickets": player_tickets
    }

@api_router.post("/user-games/code/{share_code}/join")
async def join_user_game_by_code(
    share_code: str,
    join_data: JoinUserGameRequest
):
    """Join a user game by share code"""
    game = await db.user_games.find_one({"share_code": share_code.upper()}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return await join_user_game(game["user_game_id"], join_data)

@api_router.get("/user-games/{user_game_id}/players")
async def get_user_game_players(user_game_id: str):
    """Get list of players in a user game"""
    game = await db.user_games.find_one(
        {"user_game_id": user_game_id},
        {"_id": 0, "players": 1, "tickets": 1}
    )
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Enrich players with their ticket details
    tickets = {t["ticket_id"]: t for t in game.get("tickets", [])}
    players = []
    for player in game.get("players", []):
        # Handle both old format (list of ticket_ids) and new format (list of ticket dicts)
        player_ticket_list = player.get("tickets", [])
        player_tickets = []
        
        for item in player_ticket_list:
            if isinstance(item, str):
                # Old format: item is a ticket_id string
                if item in tickets:
                    player_tickets.append(tickets[item])
            elif isinstance(item, dict):
                # New format: item is already a ticket dict
                player_tickets.append(item)
        
        players.append({
            "name": player["name"],
            "ticket_count": len(player_tickets),
            "tickets": player_tickets,
            "joined_at": player.get("joined_at")
        })
    
    return {"players": players, "total": len(players)}

@api_router.post("/user-games/{user_game_id}/host-join")
async def host_join_user_game(
    user_game_id: str,
    ticket_count: int = 1,
    user: User = Depends(get_current_user)
):
    """Host joins their own game with tickets"""
    game = await db.user_games.find_one({"user_game_id": user_game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["host_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can use this endpoint")
    
    if game["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Cannot join game that has started")
    
    # Find available tickets
    tickets = game.get("tickets", [])
    available_tickets = [t for t in tickets if not t.get("assigned_to")]
    
    if len(available_tickets) < ticket_count:
        raise HTTPException(
            status_code=400,
            detail=f"Only {len(available_tickets)} tickets available"
        )
    
    # Get abbreviated name (e.g., "Anil Sharma" -> "A. Sharma")
    name_parts = (user.name or "Host").split()
    if len(name_parts) > 1:
        abbrev_name = f"{name_parts[0][0]}. {' '.join(name_parts[1:])}"
    else:
        abbrev_name = user.name or "Host"
    
    # Assign tickets to host
    assigned_ticket_ids = []
    for i in range(ticket_count):
        ticket_id = available_tickets[i]["ticket_id"]
        assigned_ticket_ids.append(ticket_id)
        for t in tickets:
            if t["ticket_id"] == ticket_id:
                t["assigned_to"] = abbrev_name
                t["user_id"] = user.user_id
                break
    
    # Add host to players list if not already
    players = game.get("players", [])
    host_player = next((p for p in players if p.get("user_id") == user.user_id), None)
    
    if host_player:
        host_player["tickets"].extend(assigned_ticket_ids)
    else:
        players.append({
            "name": abbrev_name,
            "user_id": user.user_id,
            "tickets": assigned_ticket_ids,
            "is_host": True,
            "joined_at": datetime.now(timezone.utc).isoformat()
        })
    
    await db.user_games.update_one(
        {"user_game_id": user_game_id},
        {"$set": {"tickets": tickets, "players": players}}
    )
    
    player_tickets = [t for t in tickets if t["ticket_id"] in assigned_ticket_ids]
    
    return {
        "message": f"Tickets assigned to {abbrev_name}",
        "tickets": player_tickets
    }

@api_router.post("/user-games/{user_game_id}/start")
async def start_user_game(
    user_game_id: str,
    user: User = Depends(get_current_user)
):
    """Start a user game (host only)"""
    game = await db.user_games.find_one({"user_game_id": user_game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["host_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can start")
    
    await db.user_games.update_one(
        {"user_game_id": user_game_id},
        {"$set": {"status": "live", "started_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Game started!"}

@api_router.post("/user-games/{user_game_id}/call-number")
async def call_user_game_number(
    user_game_id: str,
    user: User = Depends(get_current_user)
):
    """Call next number in user game (host only)"""
    game = await db.user_games.find_one({"user_game_id": user_game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["host_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can call numbers")
    
    if game["status"] != "live":
        raise HTTPException(status_code=400, detail="Game is not live")
    
    called_numbers = game.get("called_numbers", [])
    available = [n for n in range(1, 91) if n not in called_numbers]
    
    if not available:
        return {"message": "All numbers called", "called_numbers": called_numbers}
    
    next_number = random.choice(available)
    called_numbers.append(next_number)
    
    await db.user_games.update_one(
        {"user_game_id": user_game_id},
        {"$set": {"called_numbers": called_numbers, "current_number": next_number}}
    )
    
    return {
        "number": next_number,
        "called_numbers": called_numbers,
        "remaining": len(available) - 1
    }

@api_router.get("/user-games/{user_game_id}/session")
async def get_user_game_session(user_game_id: str):
    """Get current game session state for live polling"""
    game = await db.user_games.find_one(
        {"user_game_id": user_game_id},
        {"_id": 0, "called_numbers": 1, "current_number": 1, "status": 1, "winners": 1, "name": 1, "auto_call_enabled": 1}
    )
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@api_router.post("/user-games/{user_game_id}/end")
async def end_user_game(
    user_game_id: str,
    user: User = Depends(get_current_user)
):
    """End a user game (host only)"""
    game = await db.user_games.find_one({"user_game_id": user_game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["host_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only host can end")
    
    await db.user_games.update_one(
        {"user_game_id": user_game_id},
        {"$set": {"status": "completed", "ended_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Game ended!"}

# ============ GAME CONTROL & WHATSAPP ENDPOINTS ============

@api_router.get("/admin/games/{game_id}/control")
async def get_game_control_data(game_id: str, request: Request, _: bool = Depends(verify_admin)):
    """Get comprehensive game control data including tickets, bookings, logs, and WhatsApp status"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Get ticket sales summary
    total_tickets = game.get("ticket_count", 0)
    tickets = await db.tickets.find({"game_id": game_id}, {"_id": 0}).to_list(1000)
    booked_tickets = [t for t in tickets if t.get("is_booked")]
    confirmed_tickets = [t for t in booked_tickets if t.get("booking_status") == "confirmed"]
    
    # Get bookings with user info and ticket details
    bookings = await db.bookings.find({"game_id": game_id}, {"_id": 0}).to_list(100)
    for booking in bookings:
        user = await db.users.find_one({"user_id": booking["user_id"]}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        booking["user"] = user
        
        # Get ticket numbers for this booking
        booking_tickets = await db.tickets.find(
            {"ticket_id": {"$in": booking.get("ticket_ids", [])}},
            {"_id": 0, "ticket_number": 1, "ticket_id": 1, "numbers": 1}
        ).to_list(20)
        booking["tickets"] = booking_tickets
        booking["ticket_numbers"] = [t["ticket_number"] for t in booking_tickets]
        
        # Get WhatsApp opt-in status (default to True for backwards compatibility)
        booking["whatsapp_opt_in"] = booking.get("whatsapp_opt_in", True)
        
        # Check if booking confirmation was sent and get details
        confirmation_log = await db.whatsapp_logs.find_one({
            "booking_id": booking["booking_id"],
            "message_type": "booking_confirmation"
        }, {"_id": 0})
        booking["confirmation_sent"] = confirmation_log is not None
        booking["whatsapp_message_status"] = confirmation_log.get("status") if confirmation_log else None
        booking["whatsapp_sent_at"] = confirmation_log.get("sent_at") if confirmation_log else None
    
    # Check if game reminder was sent
    reminder_sent = await db.whatsapp_logs.find_one({
        "game_id": game_id,
        "message_type": "game_reminder"
    })
    
    # Get WhatsApp message logs for this game
    whatsapp_logs = await db.whatsapp_logs.find(
        {"game_id": game_id},
        {"_id": 0}
    ).sort("sent_at", -1).to_list(100)
    
    # Get game control logs
    control_logs = await db.game_control_logs.find(
        {"game_id": game_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(50)
    
    # Get game session if exists
    session = await db.game_sessions.find_one({"game_id": game_id}, {"_id": 0})
    
    # Calculate revenue
    confirmed_bookings = [b for b in bookings if b.get("status") == "confirmed"]
    revenue = sum(b.get("total_amount", 0) for b in confirmed_bookings)
    
    # Check if tickets have been sold (for edit lock)
    has_sold_tickets = len(confirmed_tickets) > 0
    
    # Check if within 24 hours of game time for reminder
    can_send_reminder = False
    try:
        game_datetime_str = f"{game['date']}T{game['time']}"
        game_datetime = datetime.fromisoformat(game_datetime_str)
        now = datetime.now()
        hours_until_game = (game_datetime - now).total_seconds() / 3600
        can_send_reminder = 0 < hours_until_game <= 24 and reminder_sent is None
    except:
        pass
    
    return {
        "game": game,
        "session": session,
        "ticket_summary": {
            "total": total_tickets,
            "booked": len(booked_tickets),
            "confirmed": len(confirmed_tickets),
            "available": total_tickets - len(booked_tickets),
            "revenue": revenue
        },
        "bookings": bookings,
        "has_sold_tickets": has_sold_tickets,
        "whatsapp_status": {
            "reminder_sent": reminder_sent is not None,
            "reminder_sent_at": reminder_sent.get("sent_at") if reminder_sent else None,
            "can_send_reminder": can_send_reminder
        },
        "whatsapp_logs": whatsapp_logs,
        "control_logs": control_logs
    }

@api_router.post("/admin/games/{game_id}/whatsapp/booking-confirmation")
async def send_booking_confirmation(game_id: str, data: SendBookingConfirmationRequest, request: Request, _: bool = Depends(verify_admin)):
    """Send booking confirmation to a specific booking (once per booking, after payment approved)"""
    from notifications import send_whatsapp_message
    
    # Get booking
    booking = await db.bookings.find_one({"booking_id": data.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["game_id"] != game_id:
        raise HTTPException(status_code=400, detail="Booking does not belong to this game")
    
    # Check if booking is confirmed (payment approved)
    if booking.get("status") != "confirmed":
        raise HTTPException(status_code=400, detail="Can only send confirmation for approved/confirmed bookings")
    
    # Check if already sent
    existing = await db.whatsapp_logs.find_one({
        "booking_id": data.booking_id,
        "message_type": "booking_confirmation"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Booking confirmation already sent")
    
    # Get user info
    user = await db.users.find_one({"user_id": booking["user_id"]}, {"_id": 0})
    if not user or not user.get("phone"):
        raise HTTPException(status_code=400, detail="User has no phone number")
    
    # Check WhatsApp opt-in
    if not booking.get("whatsapp_opt_in", True):
        raise HTTPException(status_code=400, detail="User has opted out of WhatsApp notifications")
    
    # Get game info
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    
    # Get ticket numbers
    tickets = await db.tickets.find(
        {"ticket_id": {"$in": booking["ticket_ids"]}},
        {"_id": 0, "ticket_number": 1}
    ).to_list(10)
    ticket_numbers = [t["ticket_number"] for t in tickets]
    
    # Send WhatsApp message
    template_name = "booking_confirmation_v1"
    message = f"""✅ *Booking Confirmed - Six Seven Tambola*

Hi {user.get('name', 'Player')}! 🎉

Your booking for *{game['name']}* has been confirmed!

📋 *Booking Details:*
• Game: {game['name']}
• Date: {game['date']}
• Time: {game['time']}
• Tickets: {', '.join(ticket_numbers)}
• Amount Paid: ₹{booking['total_amount']}

🎮 Join the game at the scheduled time. Good luck! 🍀"""
    
    result = send_whatsapp_message(user["phone"], message)
    failure_reason = None if result else "Twilio API error or invalid phone number"
    
    # Log the message (immutable)
    log_id = f"wl_{uuid.uuid4().hex[:8]}"
    await db.whatsapp_logs.insert_one({
        "log_id": log_id,
        "game_id": game_id,
        "message_type": "booking_confirmation",
        "template_name": template_name,
        "recipient_user_id": user.get("user_id"),
        "recipient_phone": user["phone"],
        "recipient_name": user.get("name", "Player"),
        "booking_id": data.booking_id,
        "sent_at": datetime.now(timezone.utc),
        "sent_by_admin": True,
        "status": "sent" if result else "failed",
        "delivery_status": "pending" if result else "failed",
        "failure_reason": failure_reason
    })
    
    # Also log to control logs
    await db.game_control_logs.insert_one({
        "log_id": f"gcl_{uuid.uuid4().hex[:8]}",
        "game_id": game_id,
        "action": "BOOKING_CONFIRMATION_SENT",
        "details": {
            "booking_id": data.booking_id,
            "recipient": user.get("name"),
            "phone": user["phone"][-4:]  # Last 4 digits only for privacy
        },
        "admin_user": "admin",
        "timestamp": datetime.now(timezone.utc)
    })
    
    if result:
        return {"success": True, "message": "Booking confirmation sent"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send WhatsApp message")

@api_router.post("/admin/games/{game_id}/whatsapp/game-reminder")
async def send_game_reminder(game_id: str, request: Request, _: bool = Depends(verify_admin)):
    """Send game reminder to all confirmed bookings (once per game, within 24 hours)"""
    from notifications import send_whatsapp_message
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check if reminder already sent
    existing = await db.whatsapp_logs.find_one({
        "game_id": game_id,
        "message_type": "game_reminder"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Game reminder already sent for this game")
    
    # Check if within 24 hours of game time
    try:
        game_datetime_str = f"{game['date']}T{game['time']}"
        game_datetime = datetime.fromisoformat(game_datetime_str)
        now = datetime.now()
        hours_until_game = (game_datetime - now).total_seconds() / 3600
        
        if hours_until_game > 24:
            raise HTTPException(status_code=400, detail=f"Game reminder can only be sent within 24 hours of game time. Currently {int(hours_until_game)} hours away.")
        if hours_until_game < 0:
            raise HTTPException(status_code=400, detail="Game has already started/ended")
    except ValueError:
        pass  # If parsing fails, allow sending
    
    # Get all confirmed bookings with WhatsApp opt-in
    bookings = await db.bookings.find({
        "game_id": game_id,
        "status": "confirmed"
    }, {"_id": 0}).to_list(100)
    
    # Filter for opt-in users only
    opt_in_bookings = [b for b in bookings if b.get("whatsapp_opt_in", True)]
    
    if not opt_in_bookings:
        raise HTTPException(status_code=400, detail="No confirmed bookings with WhatsApp opt-in to send reminders to")
    
    sent_count = 0
    failed_count = 0
    skipped_count = 0
    template_name = "game_reminder_v1"
    
    for booking in opt_in_bookings:
        user = await db.users.find_one({"user_id": booking["user_id"]}, {"_id": 0})
        if not user or not user.get("phone"):
            skipped_count += 1
            continue
        
        message = f"""⏰ *Game Reminder - Six Seven Tambola*

Hi {user.get('name', 'Player')}! 🎲

Your game *{game['name']}* is starting soon!

📅 *Game Details:*
• Date: {game['date']}
• Time: {game['time']}
• Your Tickets: {len(booking.get('ticket_ids', []))}

🎮 Don't miss it! Join on time for the best experience.

Good luck! 🍀"""
        
        result = send_whatsapp_message(user["phone"], message)
        if result:
            sent_count += 1
        else:
            failed_count += 1
    
    # Log the reminder (immutable)
    log_id = f"wl_{uuid.uuid4().hex[:8]}"
    await db.whatsapp_logs.insert_one({
        "log_id": log_id,
        "game_id": game_id,
        "message_type": "game_reminder",
        "template_name": template_name,
        "recipient_user_id": None,
        "recipient_phone": "multiple",
        "recipient_name": f"{sent_count} players",
        "booking_id": None,
        "sent_at": datetime.now(timezone.utc),
        "sent_by_admin": True,
        "status": "sent" if sent_count > 0 else "failed",
        "delivery_status": "pending" if sent_count > 0 else "failed",
        "failure_reason": f"{failed_count} failed, {skipped_count} skipped" if failed_count > 0 or skipped_count > 0 else None
    })
    
    # Log to control logs
    await db.game_control_logs.insert_one({
        "log_id": f"gcl_{uuid.uuid4().hex[:8]}",
        "game_id": game_id,
        "action": "GAME_REMINDER_SENT",
        "details": {
            "sent_count": sent_count,
            "failed_count": failed_count,
            "total_bookings": len(bookings)
        },
        "admin_user": "admin",
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {
        "success": True,
        "message": f"Game reminder sent to {sent_count} players",
        "sent_count": sent_count,
        "failed_count": failed_count
    }

@api_router.post("/admin/games/{game_id}/whatsapp/join-link")
async def send_join_link(game_id: str, data: SendJoinLinkRequest, request: Request, _: bool = Depends(verify_admin)):
    """Send game join link to a specific user (can resend)"""
    from notifications import send_whatsapp_message
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    user = await db.users.find_one({"user_id": data.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get("phone"):
        raise HTTPException(status_code=400, detail="User has no phone number")
    
    # Get frontend URL for join link
    frontend_url = os.environ.get("FRONTEND_URL", "https://sixseventambola.com")
    join_link = f"{frontend_url}/live/{game_id}"
    
    template_name = "join_link_v1"
    message = f"""🎮 *Join Game - Six Seven Tambola*

Hi {user.get('name', 'Player')}!

Your game *{game['name']}* is ready!

👉 *Click to Join:*
{join_link}

📅 {game['date']} at {game['time']}

See you there! 🎉"""
    
    result = send_whatsapp_message(user["phone"], message)
    failure_reason = None if result else "Twilio API error or invalid phone number"
    
    # Log the message (immutable)
    log_id = f"wl_{uuid.uuid4().hex[:8]}"
    await db.whatsapp_logs.insert_one({
        "log_id": log_id,
        "game_id": game_id,
        "message_type": "join_link",
        "template_name": template_name,
        "recipient_user_id": data.user_id,
        "recipient_phone": user["phone"],
        "recipient_name": user.get("name", "Player"),
        "booking_id": None,
        "sent_at": datetime.now(timezone.utc),
        "sent_by_admin": True,
        "status": "sent" if result else "failed",
        "delivery_status": "pending" if result else "failed",
        "failure_reason": failure_reason
    })
    
    # Log to control logs
    await db.game_control_logs.insert_one({
        "log_id": f"gcl_{uuid.uuid4().hex[:8]}",
        "game_id": game_id,
        "action": "JOIN_LINK_SENT",
        "details": {
            "recipient": user.get("name"),
            "phone": user["phone"][-4:]
        },
        "admin_user": "admin",
        "timestamp": datetime.now(timezone.utc)
    })
    
    if result:
        return {"success": True, "message": "Join link sent"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send WhatsApp message")

@api_router.post("/admin/games/{game_id}/whatsapp/winner-announcement")
async def send_winner_announcement(game_id: str, data: SendWinnerAnnouncementRequest, request: Request, _: bool = Depends(verify_admin)):
    """Send winner announcement WhatsApp message to a specific winner (one per prize, no bulk)"""
    from notifications import send_whatsapp_message
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check game is live or completed
    if game.get("status") not in ["live", "completed"]:
        raise HTTPException(status_code=400, detail="Can only send winner announcements for live or completed games")
    
    # Get game session with winners
    session = await db.game_sessions.find_one({"game_id": game_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    winners = session.get("winners", {})
    if data.prize_type not in winners:
        raise HTTPException(status_code=400, detail=f"No winner declared for {data.prize_type}")
    
    winner_info = winners[data.prize_type]
    if winner_info.get("user_id") != data.winner_user_id:
        raise HTTPException(status_code=400, detail="Winner user_id mismatch")
    
    # Check if announcement already sent for this winner/prize
    existing = await db.whatsapp_logs.find_one({
        "game_id": game_id,
        "message_type": "winner_announcement",
        "recipient_user_id": data.winner_user_id,
        "booking_id": data.prize_type  # Using booking_id field to store prize_type for uniqueness
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Winner announcement already sent for {data.prize_type}")
    
    # Get winner user info
    user = await db.users.find_one({"user_id": data.winner_user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Winner user not found")
    
    if not user.get("phone"):
        raise HTTPException(status_code=400, detail="Winner has no phone number")
    
    # Get prize amount
    prize_amount = game.get("prizes", {}).get(data.prize_type, 0)
    
    # Send WhatsApp winner announcement
    template_name = "winner_announcement_v1"
    message = f"""🎉🏆 *CONGRATULATIONS!* 🏆🎉

Hi {user.get('name', 'Player')}!

You have WON in *{game['name']}*!

🏅 *Prize:* {data.prize_type}
💰 *Amount:* ₹{prize_amount}
🎫 *Ticket:* {data.ticket_id or winner_info.get('ticket_id', 'N/A')}

To claim your prize, please contact us on WhatsApp with your:
• Full Name
• UPI ID / Bank Details

Thank you for playing Six Seven Tambola! 🎲"""
    
    result = send_whatsapp_message(user["phone"], message)
    failure_reason = None if result else "Twilio API error or invalid phone number"
    
    # Log the message (immutable)
    log_id = f"wl_{uuid.uuid4().hex[:8]}"
    await db.whatsapp_logs.insert_one({
        "log_id": log_id,
        "game_id": game_id,
        "message_type": "winner_announcement",
        "template_name": template_name,
        "recipient_user_id": data.winner_user_id,
        "recipient_phone": user["phone"],
        "recipient_name": user.get("name", "Player"),
        "booking_id": data.prize_type,  # Store prize_type for tracking
        "sent_at": datetime.now(timezone.utc),
        "sent_by_admin": True,
        "status": "sent" if result else "failed",
        "delivery_status": "pending" if result else "failed",
        "failure_reason": failure_reason
    })
    
    # Update winner info with announcement_sent flag
    winners[data.prize_type]["announcement_sent"] = True
    winners[data.prize_type]["announcement_sent_at"] = datetime.now(timezone.utc).isoformat()
    await db.game_sessions.update_one(
        {"game_id": game_id},
        {"$set": {"winners": winners}}
    )
    
    # Log to control logs
    await db.game_control_logs.insert_one({
        "log_id": f"gcl_{uuid.uuid4().hex[:8]}",
        "game_id": game_id,
        "action": "WINNER_ANNOUNCEMENT_SENT",
        "details": {
            "prize_type": data.prize_type,
            "winner": user.get("name"),
            "amount": prize_amount,
            "phone": user["phone"][-4:]
        },
        "admin_user": "admin",
        "timestamp": datetime.now(timezone.utc)
    })
    
    if result:
        return {"success": True, "message": f"Winner announcement sent for {data.prize_type}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send WhatsApp message")

@api_router.get("/admin/games/{game_id}/winners")
async def get_game_winners(game_id: str, request: Request, _: bool = Depends(verify_admin)):
    """Get detailed winner information for a game including WhatsApp announcement status"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    session = await db.game_sessions.find_one({"game_id": game_id}, {"_id": 0})
    winners = session.get("winners", {}) if session else {}
    
    # Enrich winner data with user details and announcement status
    enriched_winners = {}
    for prize_type, winner_info in winners.items():
        user_id = winner_info.get("user_id")
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1}) if user_id else None
        
        # Check if announcement was sent
        announcement_log = await db.whatsapp_logs.find_one({
            "game_id": game_id,
            "message_type": "winner_announcement",
            "booking_id": prize_type  # We stored prize_type in booking_id field
        }, {"_id": 0})
        
        # Get ticket info
        ticket = await db.tickets.find_one(
            {"ticket_id": winner_info.get("ticket_id")},
            {"_id": 0, "ticket_number": 1, "holder_name": 1}
        ) if winner_info.get("ticket_id") else None
        
        enriched_winners[prize_type] = {
            "user_id": user_id,
            "user_name": winner_info.get("user_name") or winner_info.get("holder_name") or (user.get("name") if user else "Unknown"),
            "user_phone": user.get("phone") if user else None,
            "ticket_id": winner_info.get("ticket_id"),
            "ticket_number": ticket.get("ticket_number") if ticket else None,
            "holder_name": winner_info.get("holder_name") or (ticket.get("holder_name") if ticket else None),
            "prize_amount": game.get("prizes", {}).get(prize_type, 0),
            "announcement_sent": announcement_log is not None or winner_info.get("announcement_sent", False),
            "announcement_sent_at": announcement_log.get("sent_at") if announcement_log else winner_info.get("announcement_sent_at"),
            "announcement_status": announcement_log.get("status") if announcement_log else None
        }
    
    return {
        "game_id": game_id,
        "game_name": game.get("name"),
        "game_status": game.get("status"),
        "prizes": game.get("prizes", {}),
        "winners": enriched_winners,
        "total_winners": len(enriched_winners)
    }

@api_router.put("/admin/bookings/{booking_id}/confirm-payment")
async def confirm_booking_payment(booking_id: str, request: Request, _: bool = Depends(verify_admin)):
    """Confirm payment for a booking and auto-send WhatsApp confirmation if opted in"""
    from notifications import send_whatsapp_message
    
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Update booking status
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "confirmed", "payment_confirmed_at": datetime.now(timezone.utc)}}
    )
    
    # Update ticket statuses
    await db.tickets.update_many(
        {"ticket_id": {"$in": booking["ticket_ids"]}},
        {"$set": {"booking_status": "confirmed"}}
    )
    
    # Log action
    await db.game_control_logs.insert_one({
        "log_id": f"gcl_{uuid.uuid4().hex[:8]}",
        "game_id": booking["game_id"],
        "action": "PAYMENT_CONFIRMED",
        "details": {
            "booking_id": booking_id,
            "amount": booking.get("total_amount", 0)
        },
        "admin_user": "admin",
        "timestamp": datetime.now(timezone.utc)
    })
    
    # Auto-send WhatsApp confirmation if opted in
    whatsapp_sent = False
    if booking.get("whatsapp_opt_in", True):
        user = await db.users.find_one({"user_id": booking["user_id"]}, {"_id": 0})
        if user and user.get("phone"):
            game = await db.games.find_one({"game_id": booking["game_id"]}, {"_id": 0})
            
            # Check if confirmation not already sent
            existing = await db.whatsapp_logs.find_one({
                "booking_id": booking_id,
                "message_type": "booking_confirmation"
            })
            
            if not existing and game:
                # Get ticket numbers
                tickets = await db.tickets.find(
                    {"ticket_id": {"$in": booking["ticket_ids"]}},
                    {"_id": 0, "ticket_number": 1}
                ).to_list(10)
                ticket_numbers = [t["ticket_number"] for t in tickets]
                
                template_name = "booking_confirmation_v1"
                message = f"""✅ *Booking Confirmed - Six Seven Tambola*

Hi {user.get('name', 'Player')}! 🎉

Your booking for *{game['name']}* has been confirmed!

📋 *Booking Details:*
• Game: {game['name']}
• Date: {game['date']}
• Time: {game['time']}
• Tickets: {', '.join(ticket_numbers)}
• Amount Paid: ₹{booking['total_amount']}

🎮 Join the game at the scheduled time. Good luck! 🍀"""
                
                result = send_whatsapp_message(user["phone"], message)
                whatsapp_sent = result
                
                # Log the message (immutable)
                log_id = f"wl_{uuid.uuid4().hex[:8]}"
                await db.whatsapp_logs.insert_one({
                    "log_id": log_id,
                    "game_id": booking["game_id"],
                    "message_type": "booking_confirmation",
                    "template_name": template_name,
                    "recipient_user_id": user.get("user_id"),
                    "recipient_phone": user["phone"],
                    "recipient_name": user.get("name", "Player"),
                    "booking_id": booking_id,
                    "sent_at": datetime.now(timezone.utc),
                    "sent_by_admin": True,
                    "status": "sent" if result else "failed",
                    "delivery_status": "pending" if result else "failed",
                    "failure_reason": None if result else "Twilio API error"
                })
    
    return {
        "success": True, 
        "message": "Payment confirmed",
        "whatsapp_sent": whatsapp_sent
    }

@api_router.get("/admin/whatsapp-logs")
async def get_all_whatsapp_logs(
    request: Request, 
    _: bool = Depends(verify_admin),
    game_id: Optional[str] = None,
    limit: int = 100
):
    """Get all WhatsApp message logs (immutable, read-only). Logs include: user, game_id, template_name, status, timestamp, failure_reason"""
    query = {}
    if game_id:
        query["game_id"] = game_id
    
    logs = await db.whatsapp_logs.find(
        query,
        {"_id": 0}
    ).sort("sent_at", -1).to_list(limit)
    
    # Enrich with game names
    for log in logs:
        game = await db.games.find_one({"game_id": log.get("game_id")}, {"_id": 0, "name": 1})
        log["game_name"] = game.get("name") if game else "Unknown"
    
    return {
        "logs": logs,
        "total": len(logs)
    }

@api_router.put("/admin/bookings/{booking_id}/whatsapp-opt-in")
async def update_whatsapp_opt_in(booking_id: str, opt_in: bool, request: Request, _: bool = Depends(verify_admin)):
    """Update WhatsApp opt-in status for a booking"""
    result = await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"whatsapp_opt_in": opt_in}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return {"success": True, "message": f"WhatsApp opt-in {'enabled' if opt_in else 'disabled'}"}

# ============ HEALTH CHECK ENDPOINT ============
@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes"""
    return {"status": "healthy"}

app.include_router(api_router)

# Build CORS origins from environment variables
cors_origins = [
    "http://localhost:3000",
    "https://localhost:3000",
    "https://auth.emergentagent.com",
    # Custom domain
    "https://sixseventambola.com",
    "https://www.sixseventambola.com",
    "http://sixseventambola.com",
    "http://www.sixseventambola.com",
]

# Add frontend URL from environment if available
frontend_url = os.environ.get('REACT_APP_FRONTEND_URL')
if frontend_url and frontend_url not in cors_origins:
    cors_origins.append(frontend_url)

# Add backend URL (for same-origin requests) if available
backend_url = os.environ.get('REACT_APP_BACKEND_URL')
if backend_url:
    # Extract origin from backend URL
    from urllib.parse import urlparse
    parsed = urlparse(backend_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    if origin not in cors_origins:
        cors_origins.append(origin)

# Add any custom origins from CORS_ORIGINS env var
custom_origins = os.environ.get('CORS_ORIGINS', '')
if custom_origins and custom_origins != '*':
    for origin in custom_origins.split(','):
        origin = origin.strip()
        if origin and origin not in cors_origins:
            cors_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============ AUTO-GAME MANAGEMENT ============

async def check_and_start_games():
    """Check for admin games that should start and start them automatically"""
    now = datetime.now(timezone.utc)
    
    # Get all upcoming admin games
    upcoming_games = await db.games.find({
        "status": "upcoming"
    }, {"_id": 0}).to_list(100)
    
    for game in upcoming_games:
        try:
            game_date = game.get("date")  # Format: YYYY-MM-DD
            game_time = game.get("time")  # Format: HH:MM
            
            if not game_date or not game_time:
                continue
            
            # Parse the scheduled datetime (assume IST/local timezone UTC+5:30)
            scheduled_str = f"{game_date} {game_time}"
            try:
                # Parse as naive datetime
                scheduled_naive = datetime.strptime(scheduled_str, "%Y-%m-%d %H:%M")
                # Assume IST (UTC+5:30) - convert to UTC for comparison
                from datetime import timedelta
                ist_offset = timedelta(hours=5, minutes=30)
                scheduled_utc = scheduled_naive - ist_offset
                scheduled_utc = scheduled_utc.replace(tzinfo=timezone.utc)
                
                # Check if scheduled time has passed
                if now >= scheduled_utc:
                    # Start the game
                    await db.games.update_one(
                        {"game_id": game["game_id"]},
                        {"$set": {"status": "live", "started_at": now.isoformat()}}
                    )
                    
                    # Create game session
                    session_id = f"session_{uuid.uuid4().hex[:8]}"
                    await db.game_sessions.insert_one({
                        "session_id": session_id,
                        "game_id": game["game_id"],
                        "called_numbers": [],
                        "current_number": None,
                        "winners": {},
                        "status": "active",
                        "auto_call_enabled": True,
                        "last_call_time": now.isoformat(),
                        "created_at": now.isoformat()
                    })
                    logger.info(f"Auto-started admin game: {game['name']} ({game['game_id']})")
            except Exception as parse_error:
                logger.error(f"Date parse error for admin game {game['game_id']}: {parse_error}")
                
        except Exception as e:
            logger.error(f"Failed to auto-start admin game {game['game_id']}: {e}")

async def auto_call_numbers():
    """Automatically call numbers for live games with auto_call_enabled"""
    now = datetime.now(timezone.utc)
    
    # Find active game sessions - check both with auto_call_enabled and without (legacy)
    sessions = await db.game_sessions.find({
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    # Also enable auto-call for sessions that don't have the flag
    for session in sessions:
        if "auto_call_enabled" not in session:
            await db.game_sessions.update_one(
                {"session_id": session["session_id"]},
                {"$set": {"auto_call_enabled": True, "last_call_time": now.isoformat()}}
            )
            session["auto_call_enabled"] = True
            session["last_call_time"] = now.isoformat()
    
    for session in sessions:
        try:
            # Check if enough time has passed since last call (8 seconds)
            last_call = session.get("last_call_time")
            if last_call:
                last_call_dt = datetime.fromisoformat(last_call.replace('Z', '+00:00'))
                if (now - last_call_dt).total_seconds() < 8:
                    continue
            
            called = session.get("called_numbers", [])
            if len(called) >= 90:
                # All numbers called, check if game should end
                continue
            
            # Get remaining numbers
            all_numbers = list(range(1, 91))
            remaining = [n for n in all_numbers if n not in called]
            
            if remaining:
                # Call next number
                next_number = random.choice(remaining)
                called.append(next_number)
                
                await db.game_sessions.update_one(
                    {"session_id": session["session_id"]},
                    {"$set": {
                        "called_numbers": called,
                        "current_number": next_number,
                        "last_call_time": now.isoformat()
                    }}
                )
                
                # Check for winners after each call
                await check_winners_for_session(session["game_id"], called)
                
        except Exception as e:
            logger.error(f"Auto-call error for session {session.get('session_id')}: {e}")

async def check_winners_for_session(game_id: str, called_numbers: List[int]):
    """Check for winners and auto-end game if all prizes won"""
    from winner_detection import check_all_winners
    
    try:
        game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
        if not game:
            return
        
        session = await db.game_sessions.find_one({"game_id": game_id, "status": "active"}, {"_id": 0})
        if not session:
            return
        
        # Get all booked tickets for this game
        booked_tickets = await db.tickets.find({
            "game_id": game_id,
            "is_booked": True
        }, {"_id": 0}).to_list(1000)
        
        # Check winners for each prize type
        prizes = game.get("prizes", {})
        current_winners = session.get("winners", {})
        
        # Build set of ticket_ids that already won a Full House
        # These tickets cannot win another Full House
        fh_winner_tickets = set()
        for prize_key, winner_data in current_winners.items():
            if "full" in prize_key.lower() and "house" in prize_key.lower() and "sheet" not in prize_key.lower():
                if winner_data.get("shared"):
                    for w in winner_data.get("winners", []):
                        if w.get("ticket_id"):
                            fh_winner_tickets.add(w["ticket_id"])
                else:
                    if winner_data.get("ticket_id"):
                        fh_winner_tickets.add(winner_data["ticket_id"])
        
        for prize_type in prizes.keys():
            if prize_type in current_winners:
                continue  # Already won
            
            prize_lower = prize_type.lower()
            is_full_house = "full" in prize_lower and "house" in prize_lower and "sheet" not in prize_lower
            
            # For Full House prizes, collect all candidates on this call
            if is_full_house:
                fh_candidates = []
                for ticket in booked_tickets:
                    ticket_id = ticket.get("ticket_id")
                    # Skip if this ticket already won a Full House
                    if ticket_id in fh_winner_tickets:
                        continue
                    
                    winner_info = check_all_winners(ticket, called_numbers, prize_type)
                    if winner_info:
                        holder_name = ticket.get("holder_name") or ticket.get("booked_by_name")
                        if not holder_name and ticket.get("user_id"):
                            user = await db.users.find_one({"user_id": ticket.get("user_id")}, {"_id": 0})
                            holder_name = user.get("name") if user else None
                        
                        fh_candidates.append({
                            "user_id": ticket.get("user_id"),
                            "ticket_id": ticket_id,
                            "ticket_number": ticket.get("ticket_number"),
                            "holder_name": holder_name or "Player"
                        })
                
                # Award prize to all candidates (they share it)
                if fh_candidates:
                    if len(fh_candidates) == 1:
                        # Single winner
                        current_winners[prize_type] = {
                            **fh_candidates[0],
                            "won_at": datetime.now(timezone.utc).isoformat()
                        }
                    else:
                        # Multiple winners share
                        current_winners[prize_type] = {
                            "shared": True,
                            "winners": fh_candidates,
                            "holder_name": ", ".join([c["holder_name"] for c in fh_candidates]),
                            "won_at": datetime.now(timezone.utc).isoformat()
                        }
                    
                    await db.game_sessions.update_one(
                        {"session_id": session["session_id"]},
                        {"$set": {"winners": current_winners}}
                    )
                    
                    # Add these tickets to the fh_winner_tickets set for next iteration
                    for c in fh_candidates:
                        fh_winner_tickets.add(c["ticket_id"])
                    
                    logger.info(f"🎉 {len(fh_candidates)} winner(s) found for {prize_type} in game {game_id}")
            else:
                # Non-Full House prize - first ticket wins
                for ticket in booked_tickets:
                    winner_info = check_all_winners(ticket, called_numbers, prize_type)
                    if winner_info:
                        holder_name = ticket.get("holder_name") or ticket.get("booked_by_name")
                        if not holder_name and ticket.get("user_id"):
                            user = await db.users.find_one({"user_id": ticket.get("user_id")}, {"_id": 0})
                            holder_name = user.get("name") if user else None
                        
                        current_winners[prize_type] = {
                            "user_id": ticket.get("user_id"),
                            "ticket_id": ticket.get("ticket_id"),
                            "ticket_number": ticket.get("ticket_number"),
                            "holder_name": holder_name or "Player",
                            "won_at": datetime.now(timezone.utc).isoformat()
                        }
                        await db.game_sessions.update_one(
                            {"session_id": session["session_id"]},
                            {"$set": {"winners": current_winners}}
                        )
                        logger.info(f"🎉 Winner found for {prize_type} in game {game_id}: {holder_name}")
                        break
        
        # Check if all prizes are won - end game automatically
        if len(current_winners) >= len(prizes) and len(prizes) > 0:
            await db.games.update_one(
                {"game_id": game_id},
                {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
            )
            await db.game_sessions.update_one(
                {"session_id": session["session_id"]},
                {"$set": {"status": "completed", "auto_call_enabled": False}}
            )
            logger.info(f"Game {game_id} auto-ended - all prizes won!")
            
    except Exception as e:
        logger.error(f"Winner check error for game {game_id}: {e}")

async def auto_game_manager():
    """Background task that manages auto-start, auto-call, and auto-end"""
    global auto_game_task_running
    auto_game_task_running = True
    
    while auto_game_task_running:
        try:
            await check_and_start_games()
            await auto_call_numbers()
            
            # Also check user-created games
            await check_and_start_user_games()
            await auto_call_user_game_numbers()
        except Exception as e:
            logger.error(f"Auto-game manager error: {e}")
        
        await asyncio.sleep(5)  # Check every 5 seconds

async def check_and_start_user_games():
    """Check for user-created games that should start"""
    now = datetime.now(timezone.utc)
    
    # Get all upcoming user games
    upcoming_games = await db.user_games.find({
        "status": "upcoming"
    }, {"_id": 0}).to_list(100)
    
    for game in upcoming_games:
        try:
            game_date = game.get("date")  # Format: YYYY-MM-DD
            game_time = game.get("time")  # Format: HH:MM
            
            if not game_date or not game_time:
                continue
            
            # Parse the scheduled datetime (assume IST/local timezone UTC+5:30)
            # Games are created in user's local time (typically IST for Indian users)
            scheduled_str = f"{game_date} {game_time}"
            try:
                # Parse as naive datetime
                scheduled_naive = datetime.strptime(scheduled_str, "%Y-%m-%d %H:%M")
                # Assume IST (UTC+5:30) - convert to UTC for comparison
                from datetime import timedelta
                ist_offset = timedelta(hours=5, minutes=30)
                scheduled_utc = scheduled_naive - ist_offset
                scheduled_utc = scheduled_utc.replace(tzinfo=timezone.utc)
                
                # Check if scheduled time has passed
                if now >= scheduled_utc:
                    await db.user_games.update_one(
                        {"user_game_id": game["user_game_id"]},
                        {"$set": {
                            "status": "live",
                            "started_at": now.isoformat(),
                            "called_numbers": game.get("called_numbers", []),
                            "current_number": game.get("current_number"),
                            "winners": game.get("winners", {}),
                            "auto_call_enabled": True,
                            "last_call_time": now.isoformat()
                        }}
                    )
                    logger.info(f"Auto-started user game: {game['name']} ({game['user_game_id']})")
            except Exception as parse_error:
                logger.error(f"Date parse error for game {game['user_game_id']}: {parse_error}")
                
        except Exception as e:
            logger.error(f"Failed to auto-start user game {game.get('user_game_id')}: {e}")

async def auto_call_user_game_numbers():
    """Automatically call numbers for live user games"""
    now = datetime.now(timezone.utc)
    
    # Find all live user games (including those without auto_call_enabled flag)
    live_games = await db.user_games.find({
        "status": "live"
    }, {"_id": 0}).to_list(100)
    
    # Enable auto-call for games that don't have the flag
    for game in live_games:
        if "auto_call_enabled" not in game or game.get("auto_call_enabled") is None:
            await db.user_games.update_one(
                {"user_game_id": game["user_game_id"]},
                {"$set": {"auto_call_enabled": True, "last_call_time": now.isoformat()}}
            )
            game["auto_call_enabled"] = True
            game["last_call_time"] = now.isoformat()
    
    for game in live_games:
        if not game.get("auto_call_enabled", True):
            continue
            
        try:
            # Check if all dividends (prizes) are already claimed
            dividends = game.get("dividends", {})
            winners = game.get("winners", {})
            
            # End game if all dividends claimed
            if dividends and len(winners) >= len(dividends):
                await db.user_games.update_one(
                    {"user_game_id": game["user_game_id"]},
                    {"$set": {
                        "status": "completed",
                        "auto_call_enabled": False,
                        "ended_at": now.isoformat()
                    }}
                )
                logger.info(f"User game {game['user_game_id']} completed - all dividends claimed!")
                continue
            
            last_call = game.get("last_call_time")
            if last_call:
                try:
                    last_call_dt = datetime.fromisoformat(last_call.replace('Z', '+00:00'))
                    # Call every 10 seconds for classic Tambola pacing
                    if (now - last_call_dt).total_seconds() < 10:
                        continue
                except:
                    pass
            
            called = game.get("called_numbers", [])
            
            # Stop calling if all 90 numbers called
            if len(called) >= 90:
                if game.get("status") != "completed":
                    await db.user_games.update_one(
                        {"user_game_id": game["user_game_id"]},
                        {"$set": {
                            "status": "completed",
                            "auto_call_enabled": False,
                            "ended_at": now.isoformat()
                        }}
                    )
                    logger.info(f"User game {game['user_game_id']} completed - all 90 numbers called")
                continue
            
            all_numbers = list(range(1, 91))
            remaining = [n for n in all_numbers if n not in called]
            
            if remaining:
                next_number = random.choice(remaining)
                called.append(next_number)
                
                await db.user_games.update_one(
                    {"user_game_id": game["user_game_id"]},
                    {"$set": {
                        "called_numbers": called,
                        "current_number": next_number,
                        "last_call_time": now.isoformat()
                    }}
                )
                
                logger.info(f"Auto-called number {next_number} for user game {game['user_game_id']} ({len(called)}/90)")
                
                # Check for winners
                await check_user_game_winners(game["user_game_id"], called)
                
        except Exception as e:
            logger.error(f"Auto-call error for user game {game.get('user_game_id')}: {e}")

async def check_user_game_winners(user_game_id: str, called_numbers: List[int]):
    """Check for winners in user-created games with proper Full House tracking"""
    from winner_detection import check_all_winners, check_full_house, check_four_corners
    
    try:
        game = await db.user_games.find_one({"user_game_id": user_game_id}, {"_id": 0})
        if not game:
            return
        
        dividends = game.get("dividends", {})
        current_winners = game.get("winners", {})
        
        # Get players from embedded tickets in the game
        tickets = game.get("tickets", [])
        assigned_tickets = [t for t in tickets if t.get("assigned_to")]
        
        # If no embedded tickets, try participants collection
        participants = []
        if not assigned_tickets:
            participants = await db.user_game_participants.find({
                "user_game_id": user_game_id
            }, {"_id": 0}).to_list(100)
        
        # Track Full House winners for sequential assignment
        full_house_candidates = []
        
        # Check Full Sheet Corner first (requires grouped tickets)
        
        # Use assigned_tickets or participants
        ticket_source = assigned_tickets if assigned_tickets else [
            {"numbers": p.get("ticket", {}).get("numbers", []), "assigned_to": p.get("name"), "participant_id": p.get("participant_id")}
            for p in participants if p.get("ticket")
        ]
        
        for prize_type in dividends.keys():
            if prize_type in current_winners:
                continue
            
            # Skip Full House prizes for now - collect candidates first
            prize_lower = prize_type.lower()
            if "full house" in prize_lower:
                continue
            
            # Skip Full Sheet prizes - handle separately
            if "full sheet" in prize_lower:
                continue
            
            for ticket in ticket_source:
                ticket_numbers = ticket.get("numbers", [])
                if not ticket_numbers or len(ticket_numbers) < 3:
                    continue
                
                winner_info = check_all_winners({"numbers": ticket_numbers}, called_numbers, prize_type)
                if winner_info:
                    current_winners[prize_type] = {
                        "ticket_id": ticket.get("ticket_id"),
                        "holder_name": ticket.get("assigned_to"),
                        "name": ticket.get("assigned_to"),
                        "ticket_number": ticket.get("ticket_number"),
                        "won_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.user_games.update_one(
                        {"user_game_id": user_game_id},
                        {"$set": {"winners": current_winners}}
                    )
                    logger.info(f"Winner found for {prize_type} in user game {user_game_id}: {ticket.get('assigned_to')}")
                    break
        
        # Now check Full House - collect all tickets that have completed Full House
        for ticket in ticket_source:
            ticket_numbers = ticket.get("numbers", [])
            if not ticket_numbers or len(ticket_numbers) < 3:
                continue
            
            if check_full_house(ticket_numbers, called_numbers):
                ticket_id = ticket.get("ticket_id")
                # Check if this ticket already won any Full House
                already_won = any(
                    w.get("ticket_id") == ticket_id 
                    for w in current_winners.values() 
                    if "Full House" in w.get("pattern", str(w.get("prize_type", "")))
                )
                if not already_won:
                    full_house_candidates.append({
                        "ticket_id": ticket_id,
                        "holder_name": ticket.get("assigned_to"),
                        "ticket_number": ticket.get("ticket_number")
                    })
        
        # Assign Full House prizes in order (1st, 2nd, 3rd)
        house_prizes = ["1st Full House", "2nd Full House", "3rd Full House"]
        existing_house_count = sum(1 for p in current_winners.keys() if "Full House" in p)
        
        for idx, candidate in enumerate(full_house_candidates):
            prize_idx = existing_house_count + idx
            if prize_idx >= len(house_prizes):
                break
            
            prize = house_prizes[prize_idx]
            if prize in dividends and prize not in current_winners:
                current_winners[prize] = {
                    "ticket_id": candidate["ticket_id"],
                    "holder_name": candidate["holder_name"],
                    "name": candidate["holder_name"],
                    "ticket_number": candidate["ticket_number"],
                    "pattern": prize,
                    "won_at": datetime.now(timezone.utc).isoformat()
                }
                await db.user_games.update_one(
                    {"user_game_id": user_game_id},
                    {"$set": {"winners": current_winners}}
                )
                logger.info(f"Winner found for {prize} in user game {user_game_id}: {candidate['holder_name']}")
        
        # Auto-end game if all prizes won
        if dividends and len(current_winners) >= len(dividends):
            await db.user_games.update_one(
                {"user_game_id": user_game_id},
                {"$set": {
                    "status": "completed",
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "auto_call_enabled": False
                }}
            )
            logger.info(f"User game {user_game_id} auto-ended - all prizes won!")
            
    except Exception as e:
        logger.error(f"User game winner check error: {e}")

@app.on_event("startup")
async def startup_event():
    """Start background tasks and create indexes on app startup"""
    # Create MongoDB indexes for performance
    try:
        # User indexes
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("email")
        await db.users.create_index("phone")
        
        # Session indexes
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at")
        
        # Game indexes
        await db.games.create_index("game_id", unique=True)
        await db.games.create_index("status")
        await db.games.create_index([("date", 1), ("time", 1)])
        
        # Ticket indexes - critical for live game performance
        await db.tickets.create_index("ticket_id", unique=True)
        await db.tickets.create_index("game_id")
        await db.tickets.create_index([("game_id", 1), ("is_booked", 1)])
        await db.tickets.create_index([("game_id", 1), ("booking_status", 1)])
        await db.tickets.create_index("user_id")
        await db.tickets.create_index("full_sheet_id")
        
        # Game session indexes - critical for real-time updates
        await db.game_sessions.create_index("game_id", unique=True)
        
        # Booking indexes
        await db.bookings.create_index("booking_id", unique=True)
        await db.bookings.create_index("user_id")
        await db.bookings.create_index("game_id")
        await db.bookings.create_index("status")
        
        # User game indexes
        await db.user_games.create_index("user_game_id", unique=True)
        await db.user_games.create_index("share_code", unique=True)
        await db.user_games.create_index("host_user_id")
        await db.user_games.create_index("status")
        
        # Admin session indexes
        await db.admin_sessions.create_index("session_token", unique=True)
        await db.admin_sessions.create_index("expires_at")
        
        # OTP indexes with TTL (auto-expire after 10 minutes)
        await db.otp_codes.create_index("phone")
        await db.otp_codes.create_index("expires_at", expireAfterSeconds=0)
        
        logger.info("MongoDB indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")
    
    # Start background tasks
    asyncio.create_task(auto_game_manager())
    logger.info("Auto-game manager started")

@app.on_event("shutdown")
async def shutdown_db_client():
    global auto_game_task_running
    auto_game_task_running = False
    client.close()
