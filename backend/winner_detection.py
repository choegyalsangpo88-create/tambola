# Auto Winner Detection for Tambola Patterns
# Classic Indian Tambola/Housie Rules - STRICT Implementation
import logging

logger = logging.getLogger(__name__)


def check_quick_five(ticket_numbers, called_numbers):
    """
    Quick Five / First Five: First player to mark ANY 5 numbers wins
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    marked_count = 0
    for row in ticket_numbers:
        for num in row:
            if num is not None and num in called_set:
                marked_count += 1
                if marked_count >= 5:
                    return True
    return False


def check_four_corners(ticket_numbers, called_numbers):
    """
    Four Corners: All 4 corner NUMBERS of a single ticket must be marked.
    The corners are the FIRST and LAST numbers in the first and last rows.
    
    Note: In Tambola, corners may have blanks. This prize requires:
    - Find the actual corner numbers (first/last non-null in top/bottom rows)
    - All 4 must be marked
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    if len(ticket_numbers) < 3:
        return False
    
    # Get top row corners (first and last number, not necessarily positions 0 and 8)
    top_row = ticket_numbers[0]
    bottom_row = ticket_numbers[2]
    
    # Find first number in top row (top-left corner)
    top_left = None
    for num in top_row:
        if num is not None:
            top_left = num
            break
    
    # Find last number in top row (top-right corner)
    top_right = None
    for num in reversed(top_row):
        if num is not None:
            top_right = num
            break
    
    # Find first number in bottom row (bottom-left corner)
    bottom_left = None
    for num in bottom_row:
        if num is not None:
            bottom_left = num
            break
    
    # Find last number in bottom row (bottom-right corner)
    bottom_right = None
    for num in reversed(bottom_row):
        if num is not None:
            bottom_right = num
            break
    
    # All 4 corners must exist and be marked
    corners = [top_left, top_right, bottom_left, bottom_right]
    
    if None in corners:
        return False  # Not all corners have numbers
    
    return all(corner in called_set for corner in corners)


def check_line_complete(row, called_numbers):
    """
    Check if a single line (row) is complete.
    A complete line means ALL 5 numbers in the row are marked.
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    numbers_in_row = [num for num in row if num is not None]
    
    # A valid row should have exactly 5 numbers
    if len(numbers_in_row) == 0:
        return False
    
    return all(num in called_set for num in numbers_in_row)


def check_top_line(ticket_numbers, called_numbers):
    """Check if top line (first row) is complete"""
    if len(ticket_numbers) < 1:
        return False
    return check_line_complete(ticket_numbers[0], called_numbers)


def check_middle_line(ticket_numbers, called_numbers):
    """Check if middle line (second row) is complete"""
    if len(ticket_numbers) < 2:
        return False
    return check_line_complete(ticket_numbers[1], called_numbers)


def check_bottom_line(ticket_numbers, called_numbers):
    """Check if bottom line (third row) is complete"""
    if len(ticket_numbers) < 3:
        return False
    return check_line_complete(ticket_numbers[2], called_numbers)


def check_full_house(ticket_numbers, called_numbers):
    """
    Full House: ALL 15 numbers on the ticket are marked
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    total_marked = 0
    total_numbers = 0
    
    for row in ticket_numbers:
        for num in row:
            if num is not None:
                total_numbers += 1
                if num in called_set:
                    total_marked += 1
    
    # All numbers must be marked
    return total_marked == total_numbers and total_numbers == 15


def check_full_sheet_bonus(tickets, called_numbers, min_marks_per_ticket=2):
    """
    Full Sheet Bonus: Player has booked all 6 tickets of a full sheet
    AND at least 2 numbers are marked on EACH of the 6 tickets.
    
    Args:
        tickets: List of 6 tickets (each ticket is 3x9 grid)
        called_numbers: Set of called numbers
        min_marks_per_ticket: Minimum marks required per ticket (default 2)
    
    Returns:
        True if bonus condition met
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    if len(tickets) != 6:
        return False
    
    # Check each ticket has at least min_marks_per_ticket numbers marked
    for ticket in tickets:
        marked_count = 0
        for row in ticket:
            for num in row:
                if num is not None and num in called_set:
                    marked_count += 1
        
        if marked_count < min_marks_per_ticket:
            return False
    
    return True


def get_marked_count(ticket_numbers, called_numbers):
    """Get the count of marked numbers on a ticket"""
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    count = 0
    for row in ticket_numbers:
        for num in row:
            if num is not None and num in called_set:
                count += 1
    return count


def detect_all_patterns(ticket_numbers, called_numbers):
    """
    Detect all winning patterns for a ticket.
    Returns a dict of pattern_name: is_winner
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    return {
        "Quick Five": check_quick_five(ticket_numbers, called_set),
        "First Five": check_quick_five(ticket_numbers, called_set),
        "Four Corners": check_four_corners(ticket_numbers, called_set),
        "Top Line": check_top_line(ticket_numbers, called_set),
        "First Line": check_top_line(ticket_numbers, called_set),
        "Middle Line": check_middle_line(ticket_numbers, called_set),
        "Second Line": check_middle_line(ticket_numbers, called_set),
        "Bottom Line": check_bottom_line(ticket_numbers, called_set),
        "Third Line": check_bottom_line(ticket_numbers, called_set),
        "Full House": check_full_house(ticket_numbers, called_set),
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
        # Quick Five / Early Five
        "quick five": check_quick_five,
        "first five": check_quick_five,
        "early five": check_quick_five,
        
        # Four Corners
        "four corners": check_four_corners,
        "corners": check_four_corners,
        
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
        
        # House prizes (all use full_house check)
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
    
    Prize order:
    1. Quick Five - first to mark any 5 numbers
    2. Top Line - complete first row
    3. Middle Line - complete second row  
    4. Bottom Line - complete third row
    5. Four Corners - mark all 4 corner numbers
    6. 1st House - first to complete all 15 numbers
    7. 2nd House - second to complete all 15 numbers
    8. 3rd House - third to complete all 15 numbers
    """
    if not called_numbers or len(called_numbers) < 5:
        return {}
    
    called_set = set(called_numbers)
    new_winners = {}
    
    # Get all confirmed booked tickets for this game
    tickets = await db.tickets.find(
        {"game_id": game_id, "is_booked": True, "booking_status": "confirmed"},
        {"_id": 0}
    ).to_list(1000)
    
    if not tickets:
        return {}
    
    # Patterns to check (in order - excluding house prizes which are handled specially)
    patterns_to_check = [
        "Quick Five",
        "Top Line",
        "Middle Line", 
        "Bottom Line",
        "Four Corners",
    ]
    
    # Track Full House winners
    full_house_winners = []
    
    for ticket in tickets:
        user_id = ticket.get("user_id")
        holder_name = ticket.get("holder_name") or ticket.get("booked_by_name")
        if not user_id and not holder_name:
            continue
        
        ticket_numbers = ticket.get("numbers", [])
        if not ticket_numbers:
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
                logger.info(f"🎉 Auto-detected winner: {holder_name or user_id} - {pattern}")
        
        # Check Full House
        if patterns.get("Full House", False):
            ticket_id = ticket.get("ticket_id")
            # Check if this ticket already won a house prize
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
            logger.info(f"🎉 Auto-detected winner: {winner_data['holder_name'] or winner_data['user_id']} - {prize}")
    
    return new_winners


async def check_all_dividends_claimed(game_dividends: dict, current_winners: dict) -> bool:
    """
    Check if all dividends (prizes) have been claimed.
    Game should end when all dividends are won, not when 90 numbers are called.
    
    Args:
        game_dividends: Dict of prize_type -> prize_amount
        current_winners: Dict of prize_type -> winner_info
    
    Returns:
        True if all dividends have winners
    """
    if not game_dividends:
        return False
    
    for prize_type in game_dividends.keys():
        # Skip Full Sheet Bonus as it's handled differently
        if "Full Sheet" in prize_type or "Bonus" in prize_type:
            continue
        
        if prize_type not in current_winners:
            return False
    
    return True
