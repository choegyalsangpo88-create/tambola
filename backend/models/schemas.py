# Backend Models - Pydantic models for all entities
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime


# ============ USER MODELS ============

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


# ============ GAME MODELS ============

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
    full_sheet_id: str
    ticket_position_in_sheet: int
    numbers: List[List[Optional[int]]]
    is_booked: bool = False
    user_id: Optional[str] = None
    booking_status: str = "available"


class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    booking_id: str
    user_id: str
    game_id: str
    ticket_ids: List[str]
    total_amount: float
    booking_date: datetime
    status: str
    whatsapp_confirmed: bool = False
    full_sheet_booked: bool = False  # True if all 6 tickets of a sheet are booked
    full_sheet_id: Optional[str] = None


class GameSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    game_id: str
    called_numbers: List[int]
    current_number: Optional[int] = None
    start_time: datetime
    winners: Dict[str, Any] = Field(default_factory=dict)


# ============ USER GAME MODELS ============

class UserGame(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_game_id: str
    host_id: str
    host_name: str
    name: str
    date: str
    time: str
    max_players: int
    share_code: str
    status: str
    dividends: Dict[str, float]
    tickets: List[Dict[str, Any]] = []
    winners: Dict[str, Any] = {}
    called_numbers: List[int] = []
    current_number: Optional[int] = None
    created_at: datetime


# ============ REQUEST/RESPONSE MODELS ============

class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None


class GameCreate(BaseModel):
    name: str
    date: str
    time: str
    price: float
    total_tickets: int = 600
    prizes: Dict[str, float] = Field(default_factory=lambda: {
        "Quick Five": 500,
        "Top Line": 1000,
        "Middle Line": 1000,
        "Bottom Line": 1000,
        "Four Corners": 1500,
        "Full Sheet Bonus": 2000,
        "1st Full House": 5000,
        "2nd Full House": 3000,
        "3rd Full House": 2000
    })


class BookingRequest(BaseModel):
    game_id: str
    ticket_ids: List[str]
    holder_name: Optional[str] = None


class UserGameCreate(BaseModel):
    name: str
    date: str
    time: str
    max_players: int = 20
    dividends: Dict[str, float] = Field(default_factory=lambda: {
        "Quick Five": 100,
        "Top Line": 200,
        "1st Full House": 500
    })


class JoinUserGame(BaseModel):
    name: str
    ticket_index: Optional[int] = None


class ClaimPrize(BaseModel):
    prize_type: str
    ticket_id: str
