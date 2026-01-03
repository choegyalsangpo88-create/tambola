# Auto Winner Detection for Tambola Patterns
# Classic Indian Tambola/Housie Rules
import logging

logger = logging.getLogger(__name__)


def check_quick_five(ticket_numbers, called_numbers):
    """
    Check if any 5 numbers are marked (Quick Five / First Five)
    First player to mark ANY 5 numbers wins
    """
    marked_count = 0
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    for row in ticket_numbers:
        for num in row:
            if num is not None and num in called_set:
                marked_count += 1
                if marked_count >= 5:
                    return True
    return False


def check_four_corners(ticket_numbers, called_numbers):
    """
    Check if all four corner positions are marked.
    In Tambola, corners may or may not have numbers.
    This prize is only valid if ALL 4 corners have numbers AND are marked.
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    # Corner positions: [row][col]
    # Top-left: [0][0], Top-right: [0][8]
    # Bottom-left: [2][0], Bottom-right: [2][8]
    corner_positions = [(0, 0), (0, 8), (2, 0), (2, 8)]
    
    # Get corner values
    corners = []
    for row, col in corner_positions:
        if row < len(ticket_numbers) and col < len(ticket_numbers[row]):
            corners.append(ticket_numbers[row][col])
        else:
            return False  # Invalid ticket structure
    
    # All corners must have numbers (not None/0)
    valid_corners = [num for num in corners if num is not None and num != 0]
    if len(valid_corners) != 4:
        return False  # Not all corners have numbers
    
    # Check if all corners are called
    return all(num in called_set for num in valid_corners)


def check_line_complete(row, called_numbers):
    """
    Check if a single line (row) is complete.
    A complete line means ALL 5 numbers in the row are marked.
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    numbers_in_row = [num for num in row if num is not None and num != 0]
    
    # A valid row should have exactly 5 numbers
    if len(numbers_in_row) != 5:
        # Still check if all present numbers are marked
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
    Check if ALL 15 numbers on the ticket are marked (Full House)
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    total_marked = 0
    total_numbers = 0
    
    for row in ticket_numbers:
        for num in row:
            if num is not None and num != 0:
                total_numbers += 1
                if num in called_set:
                    total_marked += 1
    
    # A valid ticket has 15 numbers
    return total_marked == total_numbers and total_numbers >= 15


def check_early_five(ticket_numbers, called_numbers):
    """Alias for Quick Five"""
    return check_quick_five(ticket_numbers, called_numbers)


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
    
    # Map prize types to check functions (case-insensitive)
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
        
        # Full Sheet Bonus - special handling
        "full sheet bonus": lambda t, c: False,  # Handled separately
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
    
    # Patterns to check (in order of typical game progression)
    patterns_to_check = [
        "Quick Five",
        "Top Line",
        "Middle Line",
        "Bottom Line",
        "Four Corners",
        "1st House",
        "2nd House",
        "3rd House",
    ]
    
    # Track Full House winners for 1st, 2nd, 3rd house
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
        
        # Check each pattern
        for pattern in patterns_to_check:
            # Skip if winner already exists
            if pattern in existing_winners or pattern in new_winners:
                continue
            
            # Special handling for House prizes
            if pattern in ["1st House", "2nd House", "3rd House"]:
                if patterns.get("Full House", False):
                    # Check if this ticket already won a house prize
                    ticket_id = ticket.get("ticket_id")
                    already_won = any(
                        w.get("ticket_id") == ticket_id 
                        for w in full_house_winners
                    )
                    if not already_won:
                        full_house_winners.append({
                            "user_id": user_id,
                            "ticket_id": ticket_id,
                            "ticket_number": ticket.get("ticket_number"),
                            "holder_name": holder_name
                        })
                continue
            
            # Regular pattern check
            if patterns.get(pattern, False):
                new_winners[pattern] = {
                    "user_id": user_id,
                    "ticket_id": ticket.get("ticket_id"),
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name,
                    "pattern": pattern
                }
                logger.info(f"🎉 Auto-detected winner: {holder_name or user_id} - {pattern}")
    
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
