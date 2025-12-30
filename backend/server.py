from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
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
from openai import OpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

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
    status: str  # pending, confirmed, cancelled
    whatsapp_confirmed: bool = False
    has_full_sheet_bonus: bool = False
    full_sheet_id: Optional[str] = None

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

# WhatsApp OTP Models
class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None  # Required for new users

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

# ============ AUTH ROUTES ============

@api_router.post("/auth/session")
async def exchange_session(request: SessionExchangeRequest, response: Response):
    """Exchange session_id for session_token"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            resp.raise_for_status()
            data = resp.json()
        
        # Check if user exists
        user_doc = await db.users.find_one({"email": data["email"]}, {"_id": 0})
        
        if not user_doc:
            # Create new user
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
            # Update existing user info
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
        
        return {"user": User(**user_doc).model_dump()}
    
    except Exception as e:
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
        "user": User(**user_doc).model_dump()
    }

# ============ GAME ROUTES ============

@api_router.get("/games", response_model=List[Game])
async def get_games(status: Optional[str] = None):
    query = {} if not status else {"status": status}
    games = await db.games.find(query, {"_id": 0}).to_list(100)
    return games

@api_router.get("/games/{game_id}", response_model=Game)
async def get_game(game_id: str):
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@api_router.post("/games", response_model=Game)
async def create_game(game_data: CreateGameRequest):
    game_id = f"game_{uuid.uuid4().hex[:8]}"
    
    prize_pool = sum(game_data.prizes.values())
    
    total_tickets = game_data.dict().get('total_tickets', 600)
    
    game = {
        "game_id": game_id,
        "name": game_data.name,
        "date": game_data.date,
        "time": game_data.time,
        "price": game_data.price,
        "prize_pool": prize_pool,
        "prizes": game_data.prizes,
        "status": "upcoming",
        "ticket_count": total_tickets,
        "available_tickets": total_tickets,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.games.insert_one(game)
    
    # Auto-generate tickets for the game using full sheet rule (1-6, 7-12, 13-18, ...)
    tickets = []
    ticket_counter = 1
    num_sheets = (total_tickets + 5) // 6  # Round up to full sheets
    
    for sheet_num in range(1, num_sheets + 1):
        if ticket_counter > total_tickets:
            break
        full_sheet = generate_full_sheet()
        sheet_id = f"FS{sheet_num:03d}"
        
        for ticket_num_in_sheet, ticket_numbers in enumerate(full_sheet, 1):
            if ticket_counter > total_tickets:
                break
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

def generate_full_sheet():
    """
    Generate an authentic Tambola Full Sheet with 6 tickets.
    Each Full Sheet contains ALL numbers 1-90 exactly once across its 6 tickets.
    """
    # Column ranges
    column_ranges = [
        list(range(1, 10)),      # Col 0: 1-9 (9 numbers)
        list(range(10, 20)),     # Col 1: 10-19 (10 numbers)
        list(range(20, 30)),     # Col 2: 20-29 (10 numbers)
        list(range(30, 40)),     # Col 3: 30-39 (10 numbers)
        list(range(40, 50)),     # Col 4: 40-49 (10 numbers)
        list(range(50, 60)),     # Col 5: 50-59 (10 numbers)
        list(range(60, 70)),     # Col 6: 60-69 (10 numbers)
        list(range(70, 80)),     # Col 7: 70-79 (10 numbers)
        list(range(80, 91))      # Col 8: 80-90 (11 numbers)
    ]
    
    # Shuffle each column's numbers
    for col_nums in column_ranges:
        random.shuffle(col_nums)
    
    # Initialize 6 tickets (3 rows x 9 columns each)
    tickets = [[[0 for _ in range(9)] for _ in range(3)] for _ in range(6)]
    
    # Distribute numbers across 6 tickets
    for col_idx, col_nums in enumerate(column_ranges):
        num_count = len(col_nums)
        
        # For columns 0-7 (9-10 numbers): Distribute to ensure each ticket gets 1-2 numbers
        # For column 8 (11 numbers): Some tickets get 2, some get 1
        
        # Assign numbers to tickets
        numbers_per_ticket = [0] * 6
        remaining = num_count
        
        # Each ticket should get at least 1 number in most columns (except a few)
        # Target: Each column has 1-3 numbers per ticket, never 0 or 4
        min_per_ticket = 1 if num_count >= 6 else 0
        
        for ticket_idx in range(6):
            if remaining > 0:
                # Assign 1 or 2 numbers
                if remaining > 6 - ticket_idx:
                    count = min(2, remaining)
                else:
                    count = 1
                numbers_per_ticket[ticket_idx] = count
                remaining -= count
        
        # Distribute the actual numbers
        num_idx = 0
        for ticket_idx, count in enumerate(numbers_per_ticket):
            if count > 0:
                # Randomly select rows for this column
                available_rows = [0, 1, 2]
                random.shuffle(available_rows)
                for i in range(count):
                    if num_idx < len(col_nums):
                        row = available_rows[i]
                        tickets[ticket_idx][row][col_idx] = col_nums[num_idx]
                        num_idx += 1
    
    # Sort numbers in each column (top to bottom)
    for ticket in tickets:
        for col_idx in range(9):
            col_numbers = [ticket[row][col_idx] for row in range(3) if ticket[row][col_idx] > 0]
            col_numbers.sort()
            num_pos = 0
            for row in range(3):
                if ticket[row][col_idx] > 0:
                    ticket[row][col_idx] = col_numbers[num_pos]
                    num_pos += 1
    
    # Ensure each row has exactly 5 numbers and 4 blanks
    for ticket in tickets:
        for row_idx in range(3):
            row = ticket[row_idx]
            non_zero_count = sum(1 for num in row if num > 0)
            
            # If row has more than 5 numbers, blank out extras
            if non_zero_count > 5:
                non_zero_indices = [i for i, num in enumerate(row) if num > 0]
                random.shuffle(non_zero_indices)
                for i in range(non_zero_count - 5):
                    row[non_zero_indices[i]] = 0
            
            # If row has less than 5 numbers, fill from other rows
            elif non_zero_count < 5:
                zero_indices = [i for i, num in enumerate(row) if num == 0]
                for other_row_idx in range(3):
                    if other_row_idx == row_idx:
                        continue
                    other_row = ticket[other_row_idx]
                    other_non_zero = sum(1 for num in other_row if num > 0)
                    if other_non_zero > 5:
                        for col_idx in range(9):
                            if non_zero_count >= 5:
                                break
                            if other_row[col_idx] > 0 and row[col_idx] == 0:
                                row[col_idx] = other_row[col_idx]
                                other_row[col_idx] = 0
                                non_zero_count += 1
    
    # Convert 0 to None for API response
    for ticket in tickets:
        for row in ticket:
            for i in range(len(row)):
                if row[i] == 0:
                    row[i] = None
    
    return tickets

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
    
    # Check for Full Sheet Bonus (all 6 tickets of same sheet)
    full_sheets = {}
    for ticket in tickets:
        sheet_id = ticket.get("full_sheet_id", "")
        if sheet_id not in full_sheets:
            full_sheets[sheet_id] = []
        full_sheets[sheet_id].append(ticket["ticket_position_in_sheet"])
    
    # Check if any full sheet has all 6 tickets
    full_sheet_bonus = False
    bonus_sheet_id = None
    for sheet_id, positions in full_sheets.items():
        if len(positions) == 6 and set(positions) == {1, 2, 3, 4, 5, 6}:
            full_sheet_bonus = True
            bonus_sheet_id = sheet_id
            break
    
    # Create booking
    booking_id = f"booking_{uuid.uuid4().hex[:8]}"
    total_amount = game["price"] * len(booking_data.ticket_ids)
    
    # Add Full Sheet Bonus to amount if applicable
    full_sheet_bonus_amount = 0
    if full_sheet_bonus:
        full_sheet_bonus_amount = game["prizes"].get("Full Sheet Bonus", 1000)
    
    booking = {
        "booking_id": booking_id,
        "user_id": user.user_id,
        "game_id": booking_data.game_id,
        "ticket_ids": booking_data.ticket_ids,
        "total_amount": total_amount,
        "booking_date": datetime.now(timezone.utc),
        "status": "pending",
        "whatsapp_confirmed": False,
        "has_full_sheet_bonus": full_sheet_bonus,
        "full_sheet_id": bonus_sheet_id
    }
    
    await db.bookings.insert_one(booking)
    
    # Mark tickets as booked
    await db.tickets.update_many(
        {"ticket_id": {"$in": booking_data.ticket_ids}},
        {
            "$set": {
                "is_booked": True,
                "user_id": user.user_id,
                "booking_status": "pending"
            }
        }
    )
    
    # Update available tickets count
    await db.games.update_one(
        {"game_id": booking_data.game_id},
        {"$inc": {"available_tickets": -len(booking_data.ticket_ids)}}
    )
    
    if full_sheet_bonus:
        toast_msg = f"Booking created! 🎉 Full Sheet Bonus eligible for {bonus_sheet_id}!"
    
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
async def get_all_bookings(status: Optional[str] = None):
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
async def confirm_booking(booking_id: str):
    result = await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "confirmed", "whatsapp_confirmed": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Update ticket status
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    await db.tickets.update_many(
        {"ticket_id": {"$in": booking["ticket_ids"]}},
        {"$set": {"booking_status": "confirmed"}}
    )
    
    return {"message": "Booking confirmed"}

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
    new_winners = await auto_detect_winners(db, game_id, called_numbers + [next_number], existing_winners)
    
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
            
            # Send email
            send_winner_email(
                winner_info.get("user_email", ""),
                winner_info["user_name"],
                prize_type,
                prize_amount,
                game["name"]
            )
            
            # Send SMS (if phone number available)
            user = await db.users.find_one({"user_id": winner_info["user_id"]}, {"_id": 0})
            if user and user.get("phone"):
                send_winner_sms(
                    user["phone"],
                    winner_info["user_name"],
                    prize_type,
                    prize_amount
                )
            
            logger.info(f"🎉 Winner notified: {winner_info['user_name']} - {prize_type} - ₹{prize_amount}")
    
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
    await db.games.update_one(
        {"game_id": game_id},
        {"$set": {"status": "completed"}}
    )
    return {"message": "Game ended"}

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
    user_game_id = f"ug_{uuid.uuid4().hex[:8]}"
    share_code = generate_share_code()
    
    # Ensure share code is unique
    while await db.user_games.find_one({"share_code": share_code}):
        share_code = generate_share_code()
    
    # Generate tickets
    tickets = generate_user_game_tickets(game_data.max_tickets)
    
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
        "created_at": datetime.now(timezone.utc),
        "players": [],
        "tickets": tickets,
        "called_numbers": [],
        "current_number": None,
        "winners": {}
    }
    
    await db.user_games.insert_one(user_game)
    
    # Remove tickets from response for lighter payload
    user_game.pop("tickets", None)
    user_game.pop("_id", None)
    
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
    """Join a user game (public - just needs name)"""
    game = await db.user_games.find_one({"user_game_id": user_game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Cannot join game that has started")
    
    # Find available tickets
    tickets = game.get("tickets", [])
    available_tickets = [t for t in tickets if not t.get("assigned_to")]
    
    if len(available_tickets) < join_data.ticket_count:
        raise HTTPException(
            status_code=400,
            detail=f"Only {len(available_tickets)} tickets available"
        )
    
    # Assign tickets to player
    assigned_ticket_ids = []
    for i in range(join_data.ticket_count):
        ticket_id = available_tickets[i]["ticket_id"]
        assigned_ticket_ids.append(ticket_id)
        # Update ticket in the array
        for t in tickets:
            if t["ticket_id"] == ticket_id:
                t["assigned_to"] = join_data.player_name
                break
    
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
        player_tickets = [tickets[tid] for tid in player["tickets"] if tid in tickets]
        players.append({
            "name": player["name"],
            "ticket_count": len(player["tickets"]),
            "tickets": player_tickets,
            "joined_at": player.get("joined_at")
        })
    
    return {"players": players, "total": len(players)}

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
    """Get current game session state"""
    game = await db.user_games.find_one(
        {"user_game_id": user_game_id},
        {"_id": 0, "called_numbers": 1, "current_number": 1, "status": 1, "winners": 1, "name": 1}
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

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
