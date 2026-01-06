# OFFICIAL TAMBOLA WINNER DETECTION
# Complete rules for all winning patterns - CORRECTED VERSION
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
    FOUR CORNERS: Mark the FIRST and LAST numbers in the TOP row and BOTTOM row.
    
    NOT the physical corner positions! Find the actual numbers:
    - Top-Left Corner: FIRST number (leftmost) in Row 1
    - Top-Right Corner: LAST number (rightmost) in Row 1
    - Bottom-Left Corner: FIRST number (leftmost) in Row 3
    - Bottom-Right Corner: LAST number (rightmost) in Row 3
    
    Example:
    Top row:    [0, 8, 0, 0, 0, 0, 0, 80, 0] -> First=8, Last=80
    Bottom row: [12, 0, 40, 53, 0, 0, 70, 0, 0] -> First=12, Last=70
    Four Corners = 8, 80, 12, 70
    
    ALL tickets can potentially win Four Corners (no blank corner restriction).
    """
    if len(ticket_numbers) < 3:
        return False
    
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    top_row = ticket_numbers[0]
    bottom_row = ticket_numbers[2]
    
    # Get numbers with their positions in top row
    top_numbers = [(idx, num) for idx, num in enumerate(top_row) if num is not None and num != 0]
    bottom_numbers = [(idx, num) for idx, num in enumerate(bottom_row) if num is not None and num != 0]
    
    if len(top_numbers) < 2 or len(bottom_numbers) < 2:
        return False
    
    # Sort by position to get first (leftmost) and last (rightmost)
    top_numbers.sort(key=lambda x: x[0])
    bottom_numbers.sort(key=lambda x: x[0])
    
    # Four Corners are:
    # - First number in top row (leftmost)
    # - Last number in top row (rightmost)
    # - First number in bottom row (leftmost)
    # - Last number in bottom row (rightmost)
    corners = [
        top_numbers[0][1],      # Top-Left: First number in top row
        top_numbers[-1][1],     # Top-Right: Last number in top row
        bottom_numbers[0][1],   # Bottom-Left: First number in bottom row
        bottom_numbers[-1][1],  # Bottom-Right: Last number in bottom row
    ]
    
    # All four corner numbers must be marked
    return all(corner in called_set for corner in corners)


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
    FULL SHEET BONUS VALIDATION:
    
    A Full Sheet consists of exactly 6 tickets booked together
    and identified by the same sheet_id.

    ELIGIBILITY:
    - Validate ONLY if booking_type = FULL_SHEET
    - Exactly 6 tickets must be present
    - If not, result is INVALID

    VALIDATION RULE (STRICT):
    - Each ticket must be checked independently
    - Each of the 6 tickets must have at least 2 marked numbers
    - Total marked numbers across the sheet must NOT be used
    - If even one ticket has fewer than 2 marked numbers,
      the Full Sheet Bonus is INVALID
    
    Args:
        tickets: List of 6 tickets from the same full sheet
        called_numbers: Set of called numbers
        min_marks_per_ticket: Minimum marks required per ticket (default 2)
    
    Returns:
        True if bonus condition is met (at least 2 marks on each of 6 tickets)
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    if len(tickets) != 6:
        return False  # Must have exactly 6 tickets
    
    # Check each ticket has at least min_marks_per_ticket marked
    for ticket in tickets:
        # Handle both dict format and raw list format
        if isinstance(ticket, dict):
            ticket_numbers = ticket.get("numbers", [])
        else:
            ticket_numbers = ticket
        
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
    """
    if not called_numbers or len(called_numbers) < 5:
        return {}
    
    called_set = set(called_numbers)
    new_winners = {}
    
    # Get all booked tickets (both pending and confirmed)
    tickets = await db.tickets.find(
        {"game_id": game_id, "is_booked": True},
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
        prizes_to_check = [
            "Quick Five", "Early Five",
            "Four Corners",
            "Full Sheet Bonus",
            "Top Line", "Middle Line", "Bottom Line",
            "1st Full House", "2nd Full House", "3rd Full House"
        ]
    
    # Always ensure Full Sheet Bonus is checked if present in game prizes
    if "Full Sheet Bonus" not in prizes_to_check:
        prizes_to_check.append("Full Sheet Bonus")
    
    # Track Full House winners in order
    full_house_tickets = []
    
    # Build a cache of user names for lookup
    user_ids = set(t.get("user_id") for t in tickets if t.get("user_id"))
    user_names = {}
    if user_ids:
        users = await db.users.find(
            {"user_id": {"$in": list(user_ids)}},
            {"_id": 0, "user_id": 1, "name": 1}
        ).to_list(1000)
        user_names = {u["user_id"]: u.get("name", "Player") for u in users}
    
    # Group tickets by full sheet and user for Full Sheet Bonus
    user_sheets = {}  # user_id -> {full_sheet_id -> [tickets]}
    
    for ticket in tickets:
        user_id = ticket.get("user_id")
        holder_name = ticket.get("holder_name") or ticket.get("booked_by_name") or user_names.get(user_id, "Player")
        if not user_id and not holder_name:
            continue
        
        ticket_numbers = ticket.get("numbers", [])
        if not ticket_numbers or len(ticket_numbers) < 3:
            continue
        
        ticket_id = ticket.get("ticket_id")
        full_sheet_id = ticket.get("full_sheet_id")
        
        # Group by user and full sheet for Full Sheet Bonus
        # Use user_id if available, otherwise use holder_name as the key
        group_key = user_id or holder_name
        if full_sheet_id and group_key:
            if group_key not in user_sheets:
                user_sheets[group_key] = {}
            if full_sheet_id not in user_sheets[group_key]:
                user_sheets[group_key][full_sheet_id] = {"holder_name": holder_name, "tickets": []}
            user_sheets[group_key][full_sheet_id]["tickets"].append({
                "numbers": ticket_numbers,
                "ticket_id": ticket_id,
                "ticket_position_in_sheet": ticket.get("ticket_position_in_sheet")
            })
        
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
        
        # Check Four Corners (single ticket - physical corner positions)
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
        
        # Check Full House
        if patterns.get("Full House", False):
            already_won = (
                ticket_id in [w.get("ticket_id") for w in existing_winners.values() if "Full House" in str(w.get("pattern", ""))] or
                ticket_id in [w.get("ticket_id") for w in new_winners.values() if "Full House" in str(w.get("pattern", ""))]
            )
            if not already_won:
                full_house_tickets.append({
                    "user_id": user_id,
                    "ticket_id": ticket_id,
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name
                })
    
    # Check Full Sheet Bonus (requires user to have booked ALL 6 tickets of a full sheet)
    # Only users who booked a complete full sheet are eligible
    for prize_check in ["Full Sheet Bonus", "Fullsheet Bonus", "Full Sheet"]:
        if prize_check in prizes_to_check and prize_check not in existing_winners and prize_check not in new_winners:
            for user_id, sheets in user_sheets.items():
                for sheet_id, sheet_data in sheets.items():
                    if not sheet_id:
                        continue
                    
                    # Must have exactly 6 tickets from the same sheet
                    if len(sheet_data["tickets"]) != 6:
                        logger.debug(f"Full Sheet Check - User {user_id}, Sheet {sheet_id}: Only {len(sheet_data['tickets'])} tickets (need 6)")
                        continue
                    
                    # Verify all 6 positions (1-6) are present
                    positions = set()
                    for t in sheet_data["tickets"]:
                        pos = t.get("ticket_position_in_sheet")
                        if pos:
                            positions.add(pos)
                    
                    if positions != {1, 2, 3, 4, 5, 6}:
                        logger.debug(f"Full Sheet Check - User {user_id}, Sheet {sheet_id}: Positions {positions} (need 1-6)")
                        continue
                    
                    # Check if all 6 tickets have at least 2 numbers marked (STRICT RULE)
                    all_have_marks = True
                    marks_per_ticket = []
                    for t in sheet_data["tickets"]:
                        marks = get_marked_count(t.get("numbers", []), called_set)
                        marks_per_ticket.append(marks)
                        if marks < 2:  # Each ticket must have at least 2 marked numbers
                            all_have_marks = False
                    
                    logger.info(f"Full Sheet Bonus Check - User: {user_id}, Sheet: {sheet_id}, Positions: {positions}, Marks: {marks_per_ticket}, Eligible: {all_have_marks} (need >=2 per ticket)")
                    
                    if all_have_marks:
                        new_winners[prize_check] = {
                            "user_id": user_id,
                            "full_sheet_id": sheet_id,
                            "holder_name": sheet_data["holder_name"],
                            "pattern": "Full Sheet Bonus"
                        }
                        logger.info(f"🎉 Winner: {sheet_data['holder_name'] or user_id} - Full Sheet Bonus")
                        break
                if prize_check in new_winners:
                    break
            break  # Only check one variant
    
    # Assign Full House prizes in order (1st, 2nd, 3rd)
    house_prizes = ["1st Full House", "2nd Full House", "3rd Full House"]
    existing_house_count = sum(1 for p in existing_winners.keys() if "Full House" in p)
    
    for idx, candidate in enumerate(full_house_tickets):
        prize_idx = existing_house_count + idx
        if prize_idx >= len(house_prizes):
            break
        
        prize = house_prizes[prize_idx]
        if prize in prizes_to_check and prize not in existing_winners and prize not in new_winners:
            new_winners[prize] = {
                "user_id": candidate["user_id"],
                "ticket_id": candidate["ticket_id"],
                "ticket_number": candidate["ticket_number"],
                "holder_name": candidate["holder_name"],
                "pattern": prize
            }
            logger.info(f"🎉 Winner: {candidate['holder_name'] or candidate['user_id']} - {prize}")
    
    return new_winners


async def check_all_dividends_claimed(game_dividends: dict, current_winners: dict) -> bool:
    """
    Check if all dividends (prizes) have been claimed.
    Game should end when all dividends are won.
    """
    if not game_dividends:
        return False
    
    for prize_type in game_dividends.keys():
        if prize_type not in current_winners:
            return False
    
    return True
