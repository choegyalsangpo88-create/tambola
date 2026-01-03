# OFFICIAL TAMBOLA WINNER DETECTION
# Complete rules for all winning patterns - FIXED VERSION
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
    - Ticket has 3 rows × 9 columns = 27 spaces
    - Only 15 contain numbers (5 per row)
    - Full House = All 15 numbers marked
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
    FOUR CORNERS: Mark the 4 corner NUMBERS of the ticket
    
    In Tambola, each row has 5 numbers and 4 blanks across 9 columns.
    The CORNERS are:
    - Top-Left Corner: FIRST number in Row 1 (leftmost number)
    - Top-Right Corner: LAST number in Row 1 (rightmost number)
    - Bottom-Left Corner: FIRST number in Row 3 (leftmost number)
    - Bottom-Right Corner: LAST number in Row 3 (rightmost number)
    
    NOT at fixed column positions! Find the actual numbers.
    """
    if len(ticket_numbers) < 3:
        return False
    
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    # Find corner numbers (not positions)
    top_row = ticket_numbers[0]
    bottom_row = ticket_numbers[2]
    
    # Get actual numbers in each row (excluding blanks)
    top_numbers = [(idx, num) for idx, num in enumerate(top_row) if num is not None and num != 0]
    bottom_numbers = [(idx, num) for idx, num in enumerate(bottom_row) if num is not None and num != 0]
    
    if len(top_numbers) < 2 or len(bottom_numbers) < 2:
        return False
    
    # Sort by column position to get leftmost and rightmost
    top_numbers.sort(key=lambda x: x[0])
    bottom_numbers.sort(key=lambda x: x[0])
    
    # Get the 4 corner numbers
    corners = [
        top_numbers[0][1],      # Top-Left: First number in top row
        top_numbers[-1][1],     # Top-Right: Last number in top row
        bottom_numbers[0][1],   # Bottom-Left: First number in bottom row
        bottom_numbers[-1][1],  # Bottom-Right: Last number in bottom row
    ]
    
    # All corners must be marked (called)
    return all(corner in called_set for corner in corners)


def check_star(ticket_numbers, called_numbers):
    """
    STAR PATTERN: Mark 5 numbers - 4 corners + center number in middle row
    """
    if len(ticket_numbers) < 3:
        return False
    
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    # Get corners first
    top_row = ticket_numbers[0]
    middle_row = ticket_numbers[1]
    bottom_row = ticket_numbers[2]
    
    top_numbers = [(idx, num) for idx, num in enumerate(top_row) if num is not None and num != 0]
    middle_numbers = [(idx, num) for idx, num in enumerate(middle_row) if num is not None and num != 0]
    bottom_numbers = [(idx, num) for idx, num in enumerate(bottom_row) if num is not None and num != 0]
    
    if len(top_numbers) < 2 or len(middle_numbers) < 1 or len(bottom_numbers) < 2:
        return False
    
    top_numbers.sort(key=lambda x: x[0])
    middle_numbers.sort(key=lambda x: x[0])
    bottom_numbers.sort(key=lambda x: x[0])
    
    # Get center number from middle row (middle position)
    center_idx = len(middle_numbers) // 2
    center_num = middle_numbers[center_idx][1]
    
    # Star positions: 4 corners + center
    star_positions = [
        top_numbers[0][1],      # Top-Left
        top_numbers[-1][1],     # Top-Right
        center_num,             # Center
        bottom_numbers[0][1],   # Bottom-Left
        bottom_numbers[-1][1],  # Bottom-Right
    ]
    
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
        ticket_numbers = ticket.get("numbers", ticket) if isinstance(ticket, dict) else ticket
        marked_count = 0
        for row in ticket_numbers:
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
        
        # House prizes - all use same check function
        "full house": check_full_house,
        "1st full house": check_full_house,
        "first full house": check_full_house,
        "2nd full house": check_full_house,
        "second full house": check_full_house,
        "3rd full house": check_full_house,
        "third full house": check_full_house,
        "1st house": check_full_house,
        "2nd house": check_full_house,
        "3rd house": check_full_house,
        "housie": check_full_house,
    }
    
    check_func = prize_mapping.get(prize_lower)
    if check_func:
        if check_func(ticket_numbers, called_set):
            return {"winner": True, "prize_type": prize_type}
    
    return None


async def auto_detect_winners(db, game_id, called_numbers, existing_winners, game_dividends=None):
    """
    Automatically detect winners for all patterns.
    Returns dict of newly detected winners.
    
    Prize detection order:
    1. Quick Five / Early Five - first to mark any 5 numbers
    2. Four Corners - mark all 4 corner numbers of a single ticket
    3. Top Line - complete first row
    4. Middle Line - complete second row
    5. Bottom Line - complete third row
    6. Full Sheet Bonus - 2+ marks on each of 6 tickets in a sheet
    7. 1st Full House - first to complete all 15 numbers (Main Jackpot)
    8. 2nd Full House - second to complete all 15 numbers
    9. 3rd Full House - third to complete all 15 numbers
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
    
    # Determine which prizes to check based on game_dividends
    prizes_to_check = []
    if game_dividends:
        for prize_name in game_dividends.keys():
            prizes_to_check.append(prize_name)
    else:
        # Default prizes
        prizes_to_check = [
            "Quick Five", "Early Five",
            "Four Corners",
            "Top Line", "Middle Line", "Bottom Line",
            "1st Full House", "2nd Full House", "3rd Full House"
        ]
    
    # Track Full House winners in order
    full_house_tickets = []  # List of (ticket_id, ticket_data)
    
    # Track Full Sheet Bonus by sheet
    sheets = {}  # full_sheet_id -> list of tickets
    
    for ticket in tickets:
        user_id = ticket.get("user_id")
        holder_name = ticket.get("holder_name") or ticket.get("booked_by_name")
        if not user_id and not holder_name:
            continue
        
        ticket_numbers = ticket.get("numbers", [])
        if not ticket_numbers or len(ticket_numbers) < 3:
            continue
        
        ticket_id = ticket.get("ticket_id")
        full_sheet_id = ticket.get("full_sheet_id")
        
        # Group tickets by full sheet for Full Sheet Bonus
        if full_sheet_id:
            if full_sheet_id not in sheets:
                sheets[full_sheet_id] = {"user_id": user_id, "holder_name": holder_name, "tickets": []}
            sheets[full_sheet_id]["tickets"].append(ticket)
        
        # Check single-ticket patterns
        patterns = detect_all_patterns(ticket_numbers, called_set)
        
        # Check Quick Five / Early Five
        for prize_name in ["Quick Five", "Early Five"]:
            if prize_name in prizes_to_check and prize_name not in existing_winners and prize_name not in new_winners:
                if patterns.get(prize_name, False) or patterns.get("Early Five", False):
                    new_winners[prize_name] = {
                        "user_id": user_id,
                        "ticket_id": ticket_id,
                        "ticket_number": ticket.get("ticket_number"),
                        "holder_name": holder_name,
                        "pattern": prize_name
                    }
                    logger.info(f"🎉 Winner: {holder_name or user_id} - {prize_name}")
        
        # Check Four Corners (single ticket)
        if "Four Corners" in prizes_to_check and "Four Corners" not in existing_winners and "Four Corners" not in new_winners:
            if patterns.get("Four Corners", False):
                new_winners["Four Corners"] = {
                    "user_id": user_id,
                    "ticket_id": ticket_id,
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name,
                    "pattern": "Four Corners"
                }
                logger.info(f"🎉 Winner: {holder_name or user_id} - Four Corners")
        
        # Check Line patterns
        for line_name in ["Top Line", "Middle Line", "Bottom Line"]:
            if line_name in prizes_to_check and line_name not in existing_winners and line_name not in new_winners:
                if patterns.get(line_name, False):
                    new_winners[line_name] = {
                        "user_id": user_id,
                        "ticket_id": ticket_id,
                        "ticket_number": ticket.get("ticket_number"),
                        "holder_name": holder_name,
                        "pattern": line_name
                    }
                    logger.info(f"🎉 Winner: {holder_name or user_id} - {line_name}")
        
        # Check Full House - collect all tickets that have completed Full House
        if patterns.get("Full House", False):
            # Check if this ticket already won a house prize
            already_won = (
                ticket_id in [w.get("ticket_id") for w in existing_winners.values() if "Full House" in w.get("pattern", "")] or
                ticket_id in [w.get("ticket_id") for w in new_winners.values() if "Full House" in w.get("pattern", "")]
            )
            if not already_won:
                full_house_tickets.append({
                    "user_id": user_id,
                    "ticket_id": ticket_id,
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name
                })
    
    # Check Full Sheet Bonus (requires 6 tickets with 2+ marks each)
    if "Full Sheet Bonus" in prizes_to_check and "Full Sheet Bonus" not in existing_winners and "Full Sheet Bonus" not in new_winners:
        for sheet_id, sheet_data in sheets.items():
            if len(sheet_data["tickets"]) == 6:
                # Check if all 6 tickets have at least 2 marks
                all_have_marks = True
                for t in sheet_data["tickets"]:
                    marks = get_marked_count(t.get("numbers", []), called_set)
                    if marks < 2:
                        all_have_marks = False
                        break
                
                if all_have_marks:
                    new_winners["Full Sheet Bonus"] = {
                        "user_id": sheet_data["user_id"],
                        "full_sheet_id": sheet_id,
                        "holder_name": sheet_data["holder_name"],
                        "pattern": "Full Sheet Bonus"
                    }
                    logger.info(f"🎉 Winner: {sheet_data['holder_name'] or sheet_data['user_id']} - Full Sheet Bonus")
                    break
    
    # Assign 1st, 2nd, 3rd Full House prizes in order
    house_prizes = ["1st Full House", "2nd Full House", "3rd Full House"]
    existing_house_count = sum(1 for p in existing_winners.keys() if "Full House" in p)
    
    for idx, winner_data in enumerate(full_house_tickets):
        prize_idx = existing_house_count + idx
        if prize_idx >= len(house_prizes):
            break
        
        prize = house_prizes[prize_idx]
        if prize in prizes_to_check and prize not in existing_winners and prize not in new_winners:
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
        if prize_type not in current_winners:
            return False
    
    return True
