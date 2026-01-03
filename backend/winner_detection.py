# OFFICIAL TAMBOLA WINNER DETECTION
# Complete rules for all winning patterns
import logging

logger = logging.getLogger(__name__)


# ============ SINGLE LINE PATTERNS ============

def check_top_line(ticket_numbers, called_numbers):
    """
    TOP LINE: Mark ALL 5 numbers in the top row (Row 1)
    Location: Row 1 only (index 0)
    """
    if len(ticket_numbers) < 1:
        return False
    
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    top_row = ticket_numbers[0]
    
    # Get all non-blank numbers in top row
    numbers_in_row = [num for num in top_row if num is not None and num != 0]
    
    # Must have exactly 5 numbers
    if len(numbers_in_row) != 5:
        return False
    
    # All must be marked
    return all(num in called_set for num in numbers_in_row)


def check_middle_line(ticket_numbers, called_numbers):
    """
    MIDDLE LINE: Mark ALL 5 numbers in the middle row (Row 2)
    Location: Row 2 only (index 1)
    """
    if len(ticket_numbers) < 2:
        return False
    
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    middle_row = ticket_numbers[1]
    
    numbers_in_row = [num for num in middle_row if num is not None and num != 0]
    
    if len(numbers_in_row) != 5:
        return False
    
    return all(num in called_set for num in numbers_in_row)


def check_bottom_line(ticket_numbers, called_numbers):
    """
    BOTTOM LINE: Mark ALL 5 numbers in the bottom row (Row 3)
    Location: Row 3 only (index 2)
    """
    if len(ticket_numbers) < 3:
        return False
    
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    bottom_row = ticket_numbers[2]
    
    numbers_in_row = [num for num in bottom_row if num is not None and num != 0]
    
    if len(numbers_in_row) != 5:
        return False
    
    return all(num in called_set for num in numbers_in_row)


# ============ FULL HOUSE ============

def check_full_house(ticket_numbers, called_numbers):
    """
    FULL HOUSE (COVERALL): Mark ALL 15 numbers on the ticket
    1st Full House = Main Jackpot
    2nd Full House = Second winner
    3rd Full House = Third winner
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    marked_count = 0
    total_numbers = 0
    
    for row in ticket_numbers:
        for num in row:
            if num is not None and num != 0:
                total_numbers += 1
                if num in called_set:
                    marked_count += 1
    
    # Must have exactly 15 numbers and all marked
    return total_numbers == 15 and marked_count == 15


# ============ CORNER PATTERNS ============

def check_four_corners(ticket_numbers, called_numbers):
    """
    FOUR CORNERS: Mark 4 numbers at the FIXED corner positions
    
    Positions:
    - Top-Left:     Row1-Col1 (position [0][0])
    - Top-Right:    Row1-Col9 (position [0][8])
    - Bottom-Left:  Row3-Col1 (position [2][0])
    - Bottom-Right: Row3-Col9 (position [2][8])
    
    Note: These positions must have numbers (not blanks) AND be marked
    """
    if len(ticket_numbers) < 3 or len(ticket_numbers[0]) < 9:
        return False
    
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    # Get corner values at FIXED positions
    corners = [
        ticket_numbers[0][0],  # Top-Left: Row1-Col1
        ticket_numbers[0][8],  # Top-Right: Row1-Col9
        ticket_numbers[2][0],  # Bottom-Left: Row3-Col1
        ticket_numbers[2][8],  # Bottom-Right: Row3-Col9
    ]
    
    # All corners must have numbers (not None/0)
    for corner in corners:
        if corner is None or corner == 0:
            return False  # This corner position is blank
    
    # All corners must be marked (called)
    return all(corner in called_set for corner in corners)


def check_star(ticket_numbers, called_numbers):
    """
    STAR PATTERN: Mark 5 numbers - 4 corners + center cell
    
    Positions:
    - Top-Left:     Row1-Col1 (position [0][0])
    - Top-Right:    Row1-Col9 (position [0][8])
    - Center:       Row2-Col5 (position [1][4])
    - Bottom-Left:  Row3-Col1 (position [2][0])
    - Bottom-Right: Row3-Col9 (position [2][8])
    """
    if len(ticket_numbers) < 3 or len(ticket_numbers[0]) < 9:
        return False
    
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    # Get star positions
    star_positions = [
        ticket_numbers[0][0],  # Top-Left
        ticket_numbers[0][8],  # Top-Right
        ticket_numbers[1][4],  # Center (Row2-Col5)
        ticket_numbers[2][0],  # Bottom-Left
        ticket_numbers[2][8],  # Bottom-Right
    ]
    
    # All positions must have numbers
    for pos in star_positions:
        if pos is None or pos == 0:
            return False
    
    # All must be marked
    return all(pos in called_set for pos in star_positions)


# ============ SPECIAL PATTERNS ============

def check_early_five(ticket_numbers, called_numbers):
    """
    EARLY FIVE (Quick Five): First to mark ANY 5 numbers anywhere
    Location: Anywhere on ticket (can be across rows)
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    marked_count = 0
    for row in ticket_numbers:
        for num in row:
            if num is not None and num != 0 and num in called_set:
                marked_count += 1
                if marked_count >= 5:
                    return True
    
    return False


# Alias for Quick Five
def check_quick_five(ticket_numbers, called_numbers):
    """Alias for Early Five"""
    return check_early_five(ticket_numbers, called_numbers)


def check_full_sheet_bonus(tickets, called_numbers, min_marks_per_ticket=2):
    """
    FULL SHEET BONUS: 
    - Must have all 6 tickets of a full sheet
    - Each of the 6 tickets must have AT LEAST 2 numbers marked
    - First to achieve this wins the bonus
    
    Args:
        tickets: List of 6 tickets from the same full sheet
        called_numbers: Set of called numbers
        min_marks_per_ticket: Minimum marks required per ticket (default 2)
    
    Returns:
        True if bonus condition is met
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    if len(tickets) != 6:
        return False  # Must have exactly 6 tickets
    
    # Check each ticket has at least min_marks_per_ticket marked
    for ticket in tickets:
        marked_count = 0
        for row in ticket:
            for num in row:
                if num is not None and num != 0 and num in called_set:
                    marked_count += 1
        
        if marked_count < min_marks_per_ticket:
            return False  # This ticket doesn't have enough marks
    
    return True


# ============ UTILITY FUNCTIONS ============

def get_marked_count(ticket_numbers, called_numbers):
    """Get the count of marked numbers on a ticket"""
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    count = 0
    for row in ticket_numbers:
        for num in row:
            if num is not None and num != 0 and num in called_set:
                count += 1
    return count


def detect_all_patterns(ticket_numbers, called_numbers):
    """
    Detect all winning patterns for a ticket.
    Returns a dict of pattern_name: is_winner
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    return {
        # Special patterns
        "Early Five": check_early_five(ticket_numbers, called_set),
        "Quick Five": check_quick_five(ticket_numbers, called_set),
        
        # Line patterns
        "Top Line": check_top_line(ticket_numbers, called_set),
        "First Line": check_top_line(ticket_numbers, called_set),
        "Middle Line": check_middle_line(ticket_numbers, called_set),
        "Second Line": check_middle_line(ticket_numbers, called_set),
        "Bottom Line": check_bottom_line(ticket_numbers, called_set),
        "Third Line": check_bottom_line(ticket_numbers, called_set),
        
        # Corner patterns
        "Four Corners": check_four_corners(ticket_numbers, called_set),
        "Star": check_star(ticket_numbers, called_set),
        
        # Full house
        "Full House": check_full_house(ticket_numbers, called_set),
        "1st House": check_full_house(ticket_numbers, called_set),
        "2nd House": check_full_house(ticket_numbers, called_set),
        "3rd House": check_full_house(ticket_numbers, called_set),
    }


def check_all_winners(ticket, called_numbers, prize_type):
    """
    Check if a ticket wins the given prize type.
    
    Args:
        ticket: dict with 'numbers' key containing 3x9 grid
        called_numbers: list of called numbers
        prize_type: string like 'First Line', 'Full House', etc.
    
    Returns:
        dict with winner info if ticket wins, None otherwise
    """
    ticket_numbers = ticket.get("numbers", [])
    if not ticket_numbers or len(ticket_numbers) < 3:
        return None
    
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    # Normalize prize type
    prize_lower = prize_type.lower().replace("_", " ").replace("-", " ")
    
    prize_mapping = {
        # Early/Quick Five
        "early five": check_early_five,
        "quick five": check_quick_five,
        "first five": check_quick_five,
        
        # Line prizes
        "top line": check_top_line,
        "first line": check_top_line,
        "1st line": check_top_line,
        
        "middle line": check_middle_line,
        "second line": check_middle_line,
        "2nd line": check_middle_line,
        
        "bottom line": check_bottom_line,
        "third line": check_bottom_line,
        "3rd line": check_bottom_line,
        
        # Corner patterns
        "four corners": check_four_corners,
        "corners": check_four_corners,
        "star": check_star,
        
        # House prizes
        "full house": check_full_house,
        "1st house": check_full_house,
        "first house": check_full_house,
        "2nd house": check_full_house,
        "second house": check_full_house,
        "3rd house": check_full_house,
        "third house": check_full_house,
        "housie": check_full_house,
    }
    
    check_func = prize_mapping.get(prize_lower)
    if check_func:
        if check_func(ticket_numbers, called_set):
            return {"winner": True, "prize_type": prize_type}
    
    return None


async def auto_detect_winners(db, game_id, called_numbers, existing_winners):
    """
    Automatically detect winners for all patterns.
    Returns dict of newly detected winners.
    
    Prize detection order:
    1. Early Five - first to mark any 5 numbers
    2. Top Line - complete first row
    3. Middle Line - complete second row
    4. Bottom Line - complete third row
    5. Four Corners - mark all 4 corner positions
    6. Star - mark 4 corners + center
    7. 1st House - first to complete all 15 numbers (Main Jackpot)
    8. 2nd House - second to complete all 15 numbers
    9. 3rd House - third to complete all 15 numbers
    """
    if not called_numbers or len(called_numbers) < 5:
        return {}
    
    called_set = set(called_numbers)
    new_winners = {}
    
    # Get all confirmed booked tickets
    tickets = await db.tickets.find(
        {"game_id": game_id, "is_booked": True, "booking_status": "confirmed"},
        {"_id": 0}
    ).to_list(1000)
    
    if not tickets:
        return {}
    
    # Regular patterns to check (excluding house prizes)
    patterns_to_check = [
        "Early Five",
        "Top Line",
        "Middle Line",
        "Bottom Line",
        "Four Corners",
        "Star",
    ]
    
    # Track Full House winners for 1st, 2nd, 3rd house
    full_house_winners = []
    
    for ticket in tickets:
        user_id = ticket.get("user_id")
        holder_name = ticket.get("holder_name") or ticket.get("booked_by_name")
        if not user_id and not holder_name:
            continue
        
        ticket_numbers = ticket.get("numbers", [])
        if not ticket_numbers or len(ticket_numbers) < 3:
            continue
        
        patterns = detect_all_patterns(ticket_numbers, called_numbers)
        
        # Check regular patterns
        for pattern in patterns_to_check:
            if pattern in existing_winners or pattern in new_winners:
                continue
            
            if patterns.get(pattern, False):
                new_winners[pattern] = {
                    "user_id": user_id,
                    "ticket_id": ticket.get("ticket_id"),
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name,
                    "pattern": pattern
                }
                logger.info(f"🎉 Winner: {holder_name or user_id} - {pattern}")
        
        # Check Full House
        if patterns.get("Full House", False):
            ticket_id = ticket.get("ticket_id")
            already_won = any(w.get("ticket_id") == ticket_id for w in full_house_winners)
            if not already_won:
                full_house_winners.append({
                    "user_id": user_id,
                    "ticket_id": ticket_id,
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name
                })
    
    # Assign 1st, 2nd, 3rd House prizes
    house_prizes = ["1st House", "2nd House", "3rd House"]
    for idx, winner_data in enumerate(full_house_winners[:3]):
        prize = house_prizes[idx]
        if prize not in existing_winners and prize not in new_winners:
            new_winners[prize] = {
                "user_id": winner_data["user_id"],
                "ticket_id": winner_data["ticket_id"],
                "ticket_number": winner_data["ticket_number"],
                "holder_name": winner_data["holder_name"],
                "pattern": prize
            }
            logger.info(f"🎉 Winner: {winner_data['holder_name'] or winner_data['user_id']} - {prize}")
    
    return new_winners


async def check_all_dividends_claimed(game_dividends: dict, current_winners: dict) -> bool:
    """
    Check if all dividends (prizes) have been claimed.
    Game should end when all dividends are won.
    
    Args:
        game_dividends: Dict of prize_type -> prize_amount
        current_winners: Dict of prize_type -> winner_info
    
    Returns:
        True if all dividends have winners
    """
    if not game_dividends:
        return False
    
    for prize_type in game_dividends.keys():
        # Skip Full Sheet Bonus (handled separately)
        if "Full Sheet" in prize_type or "Bonus" in prize_type:
            continue
        
        if prize_type not in current_winners:
            return False
    
    return True
