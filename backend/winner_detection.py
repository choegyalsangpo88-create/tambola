# Auto Winner Detection for Tambola Patterns
import logging

logger = logging.getLogger(__name__)

def check_quick_five(ticket_numbers, called_numbers):
    """Check if any 5 numbers are marked (Quick Five / First Five)"""
    marked_count = 0
    for row in ticket_numbers:
        for num in row:
            if num and num in called_numbers:
                marked_count += 1
                if marked_count >= 5:
                    return True
    return False


def check_four_corners(ticket_numbers, called_numbers):
    """Check if all four corner numbers are marked"""
    corners = [
        ticket_numbers[0][0],   # Top-left
        ticket_numbers[0][8],   # Top-right
        ticket_numbers[2][0],   # Bottom-left
        ticket_numbers[2][8]    # Bottom-right
    ]
    
    # Filter out None values and check if all corners are in called numbers
    valid_corners = [num for num in corners if num is not None]
    if len(valid_corners) < 4:
        return False  # Not all corners have numbers
    
    return all(num in called_numbers for num in valid_corners)


def check_line_complete(row, called_numbers):
    """Check if a single line (row) is complete"""
    marked_count = 0
    total_numbers = 0
    
    for num in row:
        if num is not None:
            total_numbers += 1
            if num in called_numbers:
                marked_count += 1
    
    return marked_count == total_numbers and total_numbers == 5


def check_top_line(ticket_numbers, called_numbers):
    """Check if top line is complete"""
    return check_line_complete(ticket_numbers[0], called_numbers)


def check_middle_line(ticket_numbers, called_numbers):
    """Check if middle line is complete"""
    return check_line_complete(ticket_numbers[1], called_numbers)


def check_bottom_line(ticket_numbers, called_numbers):
    """Check if bottom line is complete"""
    return check_line_complete(ticket_numbers[2], called_numbers)


def check_full_house(ticket_numbers, called_numbers):
    """Check if all 15 numbers on the ticket are marked (Full House)"""
    total_marked = 0
    total_numbers = 0
    
    for row in ticket_numbers:
        for num in row:
            if num is not None:
                total_numbers += 1
                if num in called_numbers:
                    total_marked += 1
    
    return total_marked == total_numbers and total_numbers == 15


def detect_all_patterns(ticket_numbers, called_numbers):
    """
    Detect all winning patterns for a ticket.
    Returns a dict of pattern_name: is_winner
    """
    called_set = set(called_numbers)
    
    return {
        "Quick Five": check_quick_five(ticket_numbers, called_set),
        "Four Corners": check_four_corners(ticket_numbers, called_set),
        "Top Line": check_top_line(ticket_numbers, called_set),
        "Middle Line": check_middle_line(ticket_numbers, called_set),
        "Bottom Line": check_bottom_line(ticket_numbers, called_set),
        "Full House": check_full_house(ticket_numbers, called_set)
    }


def check_all_winners(ticket, called_numbers, prize_type):
    """
    Check if a ticket wins the given prize type.
    Returns winner info dict if ticket wins, None otherwise.
    
    Args:
        ticket: dict with 'numbers' key containing 3x9 grid
        called_numbers: list of called numbers
        prize_type: string like 'First Line', 'Full House', etc.
    
    Returns:
        dict with winner info if ticket wins, None otherwise
    """
    ticket_numbers = ticket.get("numbers", [])
    if not ticket_numbers:
        return None
    
    called_set = set(called_numbers)
    
    # Map prize types to check functions
    prize_mapping = {
        # Line prizes
        "first_line": check_top_line,
        "First Line": check_top_line,
        "Top Line": check_top_line,
        "top_line": check_top_line,
        
        "second_line": check_middle_line,
        "Second Line": check_middle_line,
        "Middle Line": check_middle_line,
        "middle_line": check_middle_line,
        
        "third_line": check_bottom_line,
        "Third Line": check_bottom_line,
        "Bottom Line": check_bottom_line,
        "bottom_line": check_bottom_line,
        
        # House prizes
        "full_house": check_full_house,
        "Full House": check_full_house,
        "1st House": check_full_house,
        "2nd House": check_full_house,
        "3rd House": check_full_house,
        
        # Other patterns
        "Quick Five": check_quick_five,
        "quick_five": check_quick_five,
        "Four Corners": check_four_corners,
        "four_corners": check_four_corners,
    }
    
    check_func = prize_mapping.get(prize_type)
    if check_func:
        if check_func(ticket_numbers, called_set):
            return {"winner": True, "prize_type": prize_type}
    
    return None


async def auto_detect_winners(db, game_id, called_numbers, existing_winners):
    """
    Automatically detect winners for all patterns.
    Returns dict of newly detected winners.
    """
    if not called_numbers or len(called_numbers) < 5:
        return {}  # Need at least 5 numbers for Quick Five
    
    called_set = set(called_numbers)
    new_winners = {}
    
    # Get all confirmed booked tickets for this game
    tickets = await db.tickets.find(
        {"game_id": game_id, "is_booked": True, "booking_status": "confirmed"},
        {"_id": 0}
    ).to_list(1000)
    
    if not tickets:
        return {}
    
    # Patterns to check (in priority order)
    patterns_to_check = [
        "Quick Five",
        "Four Corners", 
        "Top Line",
        "Middle Line",
        "Bottom Line",
        "1st House",  # First to get Full House
        "2nd House",  # Second to get Full House
        "Full House"
    ]
    
    # Track Full House winners separately
    full_house_winners = []
    
    for ticket in tickets:
        user_id = ticket.get("user_id")
        if not user_id:
            continue
        
        ticket_numbers = ticket["numbers"]
        patterns = detect_all_patterns(ticket_numbers, called_numbers)
        
        # Check each pattern
        for pattern in patterns_to_check:
            # Skip if winner already exists
            if pattern in existing_winners:
                continue
            
            # Special handling for House prizes
            if pattern in ["1st House", "2nd House"]:
                if patterns["Full House"]:
                    full_house_winners.append({
                        "user_id": user_id,
                        "ticket_id": ticket["ticket_id"],
                        "pattern": pattern
                    })
                continue
            
            # Regular pattern check
            if patterns.get(pattern, False):
                # Get user details
                user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
                if user:
                    new_winners[pattern] = {
                        "user_id": user_id,
                        "user_name": user.get("name", "Player"),
                        "ticket_id": ticket["ticket_id"],
                        "user_email": user.get("email")
                    }
                    logger.info(f"🎉 Auto-detected winner: {user['name']} - {pattern}")
                    break  # First winner for this pattern
    
    # Handle 1st House and 2nd House
    if full_house_winners:
        # Sort by some criteria (you could add timestamp tracking)
        for idx, winner_data in enumerate(full_house_winners[:2]):
            pattern = "1st House" if idx == 0 else "2nd House"
            if pattern not in existing_winners:
                user = await db.users.find_one({"user_id": winner_data["user_id"]}, {"_id": 0})
                if user:
                    new_winners[pattern] = {
                        "user_id": winner_data["user_id"],
                        "user_name": user.get("name", "Player"),
                        "ticket_id": winner_data["ticket_id"],
                        "user_email": user.get("email")
                    }
                    logger.info(f"🎉 Auto-detected winner: {user['name']} - {pattern}")
        
        # Remaining full house winners get "Full House"
        if "Full House" not in existing_winners and len(full_house_winners) > 2:
            for winner_data in full_house_winners[2:]:
                user = await db.users.find_one({"user_id": winner_data["user_id"]}, {"_id": 0})
                if user:
                    new_winners["Full House"] = {
                        "user_id": winner_data["user_id"],
                        "user_name": user.get("name", "Player"),
                        "ticket_id": winner_data["ticket_id"],
                        "user_email": user.get("email")
                    }
                    logger.info(f"🎉 Auto-detected winner: {user['name']} - Full House")
                    break
    
    return new_winners
