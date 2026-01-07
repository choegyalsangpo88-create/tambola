# Games Routes - Game management endpoints
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from services.database import get_db
from routes.auth import get_current_user, User
from ticket_generator import generate_full_sheet

router = APIRouter(prefix="/games", tags=["Games"])
db = get_db()
logger = logging.getLogger(__name__)


# ============ MODELS ============

class CreateGameRequest(BaseModel):
    name: str
    date: str
    time: str
    price: float
    total_tickets: int = 600
    prizes: Dict[str, float]

class Game(BaseModel):
    model_config = ConfigDict(extra="ignore")
    game_id: str
    name: str
    date: str
    time: str
    price: float
    prize_pool: float
    prizes: Dict[str, float]
    status: str
    ticket_count: int = 600
    available_tickets: int = 600
    created_at: datetime


# ============ GAME ROUTES ============

@router.get("")
async def list_games(status: Optional[str] = None):
    """Get all games, optionally filtered by status"""
    query = {} if not status else {"status": status}
    games = await db.games.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return games


@router.get("/completed")
async def list_completed_games():
    """Get all completed games with winners"""
    games = await db.games.find({"status": "completed"}, {"_id": 0}).sort("completed_at", -1).to_list(50)
    
    # Enrich with session data (winners)
    for game in games:
        session = await db.game_sessions.find_one({"game_id": game["game_id"]}, {"_id": 0})
        if session:
            game["winners"] = session.get("winners", {})
            game["called_numbers"] = session.get("called_numbers", [])
    
    return games


@router.get("/{game_id}")
async def get_game(game_id: str):
    """Get a specific game by ID"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.post("")
async def create_game(game_data: CreateGameRequest):
    """Create a new game with auto-generated tickets"""
    game_id = f"game_{uuid.uuid4().hex[:8]}"
    prize_pool = sum(game_data.prizes.values())
    
    game = {
        "game_id": game_id,
        "name": game_data.name,
        "date": game_data.date,
        "time": game_data.time,
        "price": game_data.price,
        "prize_pool": prize_pool,
        "prizes": game_data.prizes,
        "status": "upcoming",
        "ticket_count": game_data.total_tickets,
        "available_tickets": game_data.total_tickets,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.games.insert_one(game)
    
    # Auto-generate tickets in full sheets (6 tickets per sheet, all 90 numbers unique)
    num_sheets = game_data.total_tickets // 6
    tickets = []
    
    for sheet_num in range(num_sheets):
        sheet_id = f"FS{sheet_num + 1:03d}"
        # Generate full sheet with ALL 90 numbers unique across 6 tickets
        full_sheet = generate_full_sheet()
        
        for position, ticket_numbers in enumerate(full_sheet, 1):
            ticket = {
                "ticket_id": f"t_{uuid.uuid4().hex[:8]}",
                "game_id": game_id,
                "ticket_number": f"T{len(tickets) + 1:03d}",
                "full_sheet_id": sheet_id,
                "ticket_position_in_sheet": position,
                "numbers": ticket_numbers,
                "is_booked": False,
                "user_id": None,
                "booking_status": "available"
            }
            tickets.append(ticket)
    
    if tickets:
        await db.tickets.insert_many(tickets)
        logger.info(f"Created {len(tickets)} tickets for game {game_id} with unique numbers per full sheet")
    
    game.pop("_id", None)
    return game


@router.get("/{game_id}/tickets")
async def get_game_tickets(game_id: str, page: int = 1, limit: int = 60):
    """Get tickets for a game with pagination"""
    skip = (page - 1) * limit
    
    tickets = await db.tickets.find(
        {"game_id": game_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    total = await db.tickets.count_documents({"game_id": game_id})
    
    return {
        "tickets": tickets,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.post("/{game_id}/book")
async def book_tickets(
    game_id: str,
    ticket_ids: List[str],
    user: User = Depends(get_current_user)
):
    """Book tickets for a user"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Game is not accepting bookings")
    
    # Check tickets are available
    tickets = await db.tickets.find(
        {"ticket_id": {"$in": ticket_ids}, "is_booked": False},
        {"_id": 0}
    ).to_list(len(ticket_ids))
    
    if len(tickets) != len(ticket_ids):
        raise HTTPException(status_code=400, detail="Some tickets are not available")
    
    # Check if booking a full sheet
    is_full_sheet = False
    if len(ticket_ids) == 6:
        sheet_ids = set(t.get("full_sheet_id") for t in tickets)
        if len(sheet_ids) == 1 and sheet_ids.pop() is not None:
            positions = set(t.get("ticket_position_in_sheet") for t in tickets)
            if positions == {1, 2, 3, 4, 5, 6}:
                is_full_sheet = True
    
    # Mark tickets as booked
    update_data = {
        "is_booked": True,
        "user_id": user.user_id,
        "booking_status": "confirmed",
        "holder_name": user.name
    }
    
    if is_full_sheet:
        update_data["booking_type"] = "FULL_SHEET"
        update_data["full_sheet_booked"] = True
    
    await db.tickets.update_many(
        {"ticket_id": {"$in": ticket_ids}},
        {"$set": update_data}
    )
    
    # Update game available tickets
    await db.games.update_one(
        {"game_id": game_id},
        {"$inc": {"available_tickets": -len(ticket_ids)}}
    )
    
    # Create booking record
    booking_id = f"booking_{uuid.uuid4().hex[:8]}"
    booking = {
        "booking_id": booking_id,
        "user_id": user.user_id,
        "game_id": game_id,
        "ticket_ids": ticket_ids,
        "total_amount": game["price"] * len(ticket_ids),
        "booking_date": datetime.now(timezone.utc),
        "status": "confirmed",
        "has_full_sheet_bonus": is_full_sheet,
        "full_sheet_id": tickets[0].get("full_sheet_id") if is_full_sheet else None
    }
    
    await db.bookings.insert_one(booking)
    
    return {
        "booking_id": booking_id,
        "message": f"Successfully booked {len(ticket_ids)} tickets",
        "is_full_sheet": is_full_sheet
    }


# ============ LIVE GAME ROUTES ============

@router.post("/{game_id}/start")
async def start_game(game_id: str):
    """Start a game"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
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


@router.post("/{game_id}/call-number")
async def call_number(game_id: str):
    """Call the next number in the game"""
    import random
    from winner_detection import auto_detect_winners
    from notifications import send_winner_email, send_winner_sms
    
    session = await db.game_sessions.find_one({"game_id": game_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    called_numbers = session["called_numbers"]
    
    # Generate next number (1-90)
    available_numbers = [n for n in range(1, 91) if n not in called_numbers]
    if not available_numbers:
        return {"message": "All numbers called"}
    
    next_number = random.choice(available_numbers)
    
    # Update session
    await db.game_sessions.update_one(
        {"game_id": game_id},
        {
            "$push": {"called_numbers": next_number},
            "$set": {"current_number": next_number}
        }
    )
    
    # Auto-detect winners
    existing_winners = session.get("winners", {})
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    game_dividends = game.get("prizes", {}) if game else {}
    
    new_winners = await auto_detect_winners(db, game_id, called_numbers + [next_number], existing_winners, game_dividends)
    
    # Update winners and send notifications
    if new_winners:
        all_winners = {**existing_winners, **new_winners}
        
        await db.game_sessions.update_one(
            {"game_id": game_id},
            {"$set": {"winners": all_winners}}
        )
        
        # Send notifications
        for prize_type, winner_info in new_winners.items():
            prize_amount = game["prizes"].get(prize_type, 0)
            winner_name = winner_info.get("holder_name") or winner_info.get("user_name") or "Player"
            
            # Handle shared winners
            if winner_info.get("shared"):
                for w in winner_info.get("winners", []):
                    w_name = w.get("holder_name") or "Player"
                    logger.info(f"🎉 SHARED Winner: {w_name} - {prize_type} (shared)")
            else:
                logger.info(f"🎉 Winner: {winner_name} - {prize_type} - ₹{prize_amount}")
    
    return {
        "number": next_number,
        "called_numbers": called_numbers + [next_number],
        "new_winners": list(new_winners.keys())
    }


@router.get("/{game_id}/session")
async def get_game_session(game_id: str):
    """Get the current game session"""
    session = await db.game_sessions.find_one({"game_id": game_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    return session


@router.post("/{game_id}/end")
async def end_game(game_id: str):
    """End a game"""
    await db.games.update_one(
        {"game_id": game_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Game ended"}
