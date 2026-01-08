# OFFICIAL TAMBOLA WINNER DETECTION
# Complete rules for all winning patterns - UPDATED VERSION
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


def check_full_sheet_bonus(tickets, called_numbers, min_marks_per_ticket=2, min_total_marks=12):
    """
    FULL SHEET BONUS - NEW RULE:
    
    A player wins the Full Sheet Bonus when ALL of the following are true:
    1️⃣ The player booked exactly one full sheet consisting of 6 tickets
    2️⃣ All numbers across the 6 tickets are unique (1–90, no overlap)
    3️⃣ Each of the 6 tickets has at least 2 marked numbers
    4️⃣ The total marked numbers across the full sheet is ≥ 12
    
    ✔ There is NO call limit
    ✔ Timing does NOT matter
    ✔ Only completion matters
    
    Args:
        tickets: List of 6 tickets from the same full sheet
        called_numbers: Set of called numbers
        min_marks_per_ticket: Minimum marks required per ticket (default 2)
        min_total_marks: Minimum total marks across all tickets (default 12)
    
    Returns:
        True if bonus condition is met
    """
    called_set = set(called_numbers) if not isinstance(called_numbers, set) else called_numbers
    
    # Rule 1: Must have exactly 6 tickets
    if len(tickets) != 6:
        return False
    
    # Rule 2: All numbers across 6 tickets must be unique (1-90, no overlap)
    all_numbers = set()
    for ticket in tickets:
        if isinstance(ticket, dict):
            ticket_numbers = ticket.get("numbers", [])
        else:
            ticket_numbers = ticket
        
        for row in ticket_numbers:
            for num in row:
                if num is not None and num != 0:
                    if num in all_numbers:
                        # Duplicate found - not a valid full sheet
                        return False
                    all_numbers.add(num)
    
    # Full sheet should have exactly 90 unique numbers (6 tickets × 15 numbers)
    if len(all_numbers) != 90:
        return False
    
    # Rule 3 & 4: Check each ticket has >= 2 marks and total >= 12
    total_marks = 0
    for ticket in tickets:
        if isinstance(ticket, dict):
            ticket_numbers = ticket.get("numbers", [])
        else:
            ticket_numbers = ticket
        
        ticket_marks = 0
        for row in ticket_numbers:
            for num in row:
                if num is not None and num != 0 and num in called_set:
                    ticket_marks += 1
        
        # Rule 3: Each ticket must have at least min_marks_per_ticket
        if ticket_marks < min_marks_per_ticket:
            return False
        
        total_marks += ticket_marks
    
    # Rule 4: Total marks must be >= min_total_marks
    if total_marks < min_total_marks:
        return False
    
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


async def auto_detect_winners(db, game_id, called_numbers, existing_winners, game_dividends=None):
    """
    Automatically detect winners for all patterns.
    
    SEQUENTIAL FULL HOUSE RULE:
    - Multiple users can win same dividend if the last call is same
    - If 3 users complete 1st Full House at call 70, they SHARE 1st Full House
    - They do NOT get all three full houses
    - After that on next call, 2nd Full House can be claimed
    
    Returns dict of newly detected winners.
    """
    logger.info(f"=== Winner Detection Started for {game_id} ===")
    logger.info(f"Called numbers: {len(called_numbers)}, Existing winners: {list(existing_winners.keys())}")
    
    if not called_numbers or len(called_numbers) < 5:
        logger.info("Not enough numbers called (< 5)")
        return {}
    
    called_set = set(called_numbers)
    current_call_count = len(called_numbers)
    new_winners = {}
    
    # Get all booked tickets
    tickets = await db.tickets.find(
        {"game_id": game_id, "is_booked": True},
        {"_id": 0}
    ).to_list(1000)
    
    logger.info(f"Found {len(tickets)} booked tickets")
    
    if not tickets:
        logger.info("No booked tickets found")
        return {}
    
    # Filter to only booked tickets
    booked_tickets = [
        t for t in tickets 
        if (t.get("is_booked") or 
            t.get("booking_status") in ["confirmed", "approved", "booked"] or
            t.get("user_id") or 
            t.get("holder_name") or
            t.get("assigned_to"))
    ]
    
    logger.info(f"Filtered to {len(booked_tickets)} valid booked tickets")
    
    if not booked_tickets:
        logger.info("No valid booked tickets after filtering")
        return {}
    
    # Determine which prizes to check
    prizes_to_check = list(game_dividends.keys()) if game_dividends else [
        "Quick Five", "Early Five", "Four Corners", "Full Sheet Bonus",
        "Top Line", "Middle Line", "Bottom Line",
        "1st Full House", "2nd Full House", "3rd Full House"
    ]
    
    logger.info(f"Prizes to check: {prizes_to_check}")
    
    # Normalize prize names for comparison (handle different formats)
    def normalize_prize_name(name):
        """Normalize prize name for comparison"""
        if not name:
            return ""
        return name.lower().replace("_", " ").replace("-", " ").strip()
    
    # Map normalized names to actual prize names
    prize_name_map = {}
    for prize in prizes_to_check:
        normalized = normalize_prize_name(prize)
        prize_name_map[normalized] = prize
        # Also map common variations
        if "first" in normalized or "top" in normalized:
            prize_name_map["top line"] = prize
            prize_name_map["first line"] = prize
            prize_name_map["first_line"] = prize
        if "second" in normalized or "middle" in normalized:
            prize_name_map["middle line"] = prize
            prize_name_map["second line"] = prize
            prize_name_map["second_line"] = prize
        if "third" in normalized or "bottom" in normalized:
            prize_name_map["bottom line"] = prize
            prize_name_map["third line"] = prize
            prize_name_map["third_line"] = prize
        if "full house" in normalized or "full_house" in normalized:
            prize_name_map["full house"] = prize
            prize_name_map["full_house"] = prize
    
    logger.info(f"Checking prizes: {prizes_to_check}")
    
    # Build a cache of user names
    user_ids = set(t.get("user_id") for t in tickets if t.get("user_id"))
    user_names = {}
    if user_ids:
        users = await db.users.find(
            {"user_id": {"$in": list(user_ids)}},
            {"_id": 0, "user_id": 1, "name": 1}
        ).to_list(1000)
        user_names = {u["user_id"]: u.get("name", "Player") for u in users}
    
    # Group tickets by full sheet and user for Full Sheet Bonus
    user_sheets = {}  # user_id -> {full_sheet_id -> {holder_name, tickets}}
    
    # Track Full House winners by call count for proper sequential assignment
    full_house_candidates = []  # List of {user_id, ticket_id, holder_name, ticket_number}
    
    for ticket in booked_tickets:
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
        # Check if this ticket is part of a full sheet (regardless of booking_type)
        group_key = user_id or holder_name
        if full_sheet_id and group_key:
            if group_key not in user_sheets:
                user_sheets[group_key] = {}
            if full_sheet_id not in user_sheets[group_key]:
                user_sheets[group_key][full_sheet_id] = {"holder_name": holder_name, "tickets": []}
            user_sheets[group_key][full_sheet_id]["tickets"].append({
                "numbers": ticket_numbers,
                "ticket_id": ticket_id,
                "ticket_number": ticket.get("ticket_number"),
                "ticket_position_in_sheet": ticket.get("ticket_position_in_sheet")
            })
        
        # Check single-ticket patterns
        patterns = detect_all_patterns(ticket_numbers, called_set)
        winning_patterns = [p for p, won in patterns.items() if won]
        
        if winning_patterns:
            logger.info(f"Ticket {ticket.get('ticket_number')} has winning patterns: {winning_patterns}")
        
        # Helper function to check if any variation of prize exists
        def prize_exists(variations):
            """Check if any prize name variation exists in prizes_to_check"""
            for v in variations:
                if v in prizes_to_check:
                    return v
                # Also check normalized versions
                for p in prizes_to_check:
                    if normalize_prize_name(p) == normalize_prize_name(v):
                        return p
            return None
        
        # Helper function to check if prize already won
        def prize_already_won(variations):
            """Check if any variation of prize already won"""
            for v in variations:
                if v in existing_winners or v in new_winners:
                    return True
                for won in list(existing_winners.keys()) + list(new_winners.keys()):
                    if normalize_prize_name(won) == normalize_prize_name(v):
                        return True
            return False
        
        # Check Quick Five / Early Five
        quick_five_variations = ["Quick Five", "Early Five", "quick_five", "early_five", "Quick 5", "Early 5"]
        actual_prize = prize_exists(quick_five_variations)
        if actual_prize and not prize_already_won(quick_five_variations):
            if patterns.get("Quick Five", False) or patterns.get("Early Five", False):
                new_winners[actual_prize] = {
                    "user_id": user_id,
                    "ticket_id": ticket_id,
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name,
                    "pattern": actual_prize
                }
                logger.info(f"🎉 Winner: {holder_name or user_id} - {actual_prize}")
        
        # Check Four Corners
        corners_variations = ["Four Corners", "four_corners", "4 Corners"]
        actual_prize = prize_exists(corners_variations)
        if actual_prize and not prize_already_won(corners_variations):
            if patterns.get("Four Corners", False):
                new_winners[actual_prize] = {
                    "user_id": user_id,
                    "ticket_id": ticket_id,
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name,
                    "pattern": actual_prize
                }
                logger.info(f"🎉 Winner: {holder_name or user_id} - {actual_prize}")
        
        # Check Top Line / First Line
        top_line_variations = ["Top Line", "First Line", "first_line", "top_line"]
        actual_prize = prize_exists(top_line_variations)
        if actual_prize and not prize_already_won(top_line_variations):
            if patterns.get("Top Line", False):
                new_winners[actual_prize] = {
                    "user_id": user_id,
                    "ticket_id": ticket_id,
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name,
                    "pattern": actual_prize
                }
                logger.info(f"🎉 Winner: {holder_name or user_id} - {actual_prize}")
        
        # Check Middle Line / Second Line
        middle_line_variations = ["Middle Line", "Second Line", "second_line", "middle_line"]
        actual_prize = prize_exists(middle_line_variations)
        if actual_prize and not prize_already_won(middle_line_variations):
            if patterns.get("Middle Line", False):
                new_winners[actual_prize] = {
                    "user_id": user_id,
                    "ticket_id": ticket_id,
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name,
                    "pattern": actual_prize
                }
                logger.info(f"🎉 Winner: {holder_name or user_id} - {actual_prize}")
        
        # Check Bottom Line / Third Line
        bottom_line_variations = ["Bottom Line", "Third Line", "third_line", "bottom_line"]
        actual_prize = prize_exists(bottom_line_variations)
        if actual_prize and not prize_already_won(bottom_line_variations):
            if patterns.get("Bottom Line", False):
                new_winners[actual_prize] = {
                    "user_id": user_id,
                    "ticket_id": ticket_id,
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name,
                    "pattern": actual_prize
                }
                logger.info(f"🎉 Winner: {holder_name or user_id} - {actual_prize}")
        
        # Check Full House - collect all candidates for sequential assignment
        # IMPORTANT: A ticket that already won ANY Full House cannot win another
        if patterns.get("Full House", False):
            # Get all ticket_ids that have already won any Full House
            already_won_fh_tickets = set()
            for prize_key, winner_data in existing_winners.items():
                if "full" in prize_key.lower() and "house" in prize_key.lower() and "sheet" not in prize_key.lower():
                    if winner_data.get("shared"):
                        # Multiple winners shared this prize
                        for w in winner_data.get("winners", []):
                            if w.get("ticket_id"):
                                already_won_fh_tickets.add(w["ticket_id"])
                    else:
                        if winner_data.get("ticket_id"):
                            already_won_fh_tickets.add(winner_data["ticket_id"])
            
            # Also check new_winners from this call
            for prize_key, winner_data in new_winners.items():
                if "full" in prize_key.lower() and "house" in prize_key.lower() and "sheet" not in prize_key.lower():
                    if winner_data.get("shared"):
                        for w in winner_data.get("winners", []):
                            if w.get("ticket_id"):
                                already_won_fh_tickets.add(w["ticket_id"])
                    else:
                        if winner_data.get("ticket_id"):
                            already_won_fh_tickets.add(winner_data["ticket_id"])
            
            # Only add this ticket as candidate if it hasn't won a Full House yet
            if ticket_id not in already_won_fh_tickets:
                full_house_candidates.append({
                    "user_id": user_id,
                    "ticket_id": ticket_id,
                    "ticket_number": ticket.get("ticket_number"),
                    "holder_name": holder_name
                })
    
    # Check Full Sheet Bonus with NEW RULES
    full_sheet_variations = ["Full Sheet Bonus", "Fullsheet Bonus", "Full Sheet", "full_sheet_bonus", "fullsheet", "full sheet"]
    
    # Find actual prize name for full sheet bonus
    full_sheet_prize = None
    for variation in full_sheet_variations:
        if variation in prizes_to_check:
            full_sheet_prize = variation
            break
        for p in prizes_to_check:
            if normalize_prize_name(p) == normalize_prize_name(variation):
                full_sheet_prize = p
                break
        if full_sheet_prize:
            break
    
    if full_sheet_prize and full_sheet_prize not in existing_winners and full_sheet_prize not in new_winners:
        for group_key, sheets in user_sheets.items():
            for sheet_id, sheet_data in sheets.items():
                if not sheet_id:
                    continue
                
                # Must have exactly 6 tickets from the same sheet
                if len(sheet_data["tickets"]) != 6:
                    logger.debug(f"Full Sheet Check - User {group_key}, Sheet {sheet_id}: Only {len(sheet_data['tickets'])} tickets (need 6)")
                    continue
                
                # Verify all 6 positions (1-6) are present
                positions = set()
                for t in sheet_data["tickets"]:
                    pos = t.get("ticket_position_in_sheet")
                    if pos:
                        positions.add(pos)
                
                if positions != {1, 2, 3, 4, 5, 6}:
                    logger.debug(f"Full Sheet Check - User {group_key}, Sheet {sheet_id}: Positions {positions} (need 1-6)")
                    continue
                
                # Use new Full Sheet Bonus check
                ticket_list = [t.get("numbers", []) for t in sheet_data["tickets"]]
                if check_full_sheet_bonus(ticket_list, called_set, min_marks_per_ticket=2, min_total_marks=12):
                    new_winners[full_sheet_prize] = {
                        "user_id": group_key if group_key and group_key.startswith("user_") else None,
                        "full_sheet_id": sheet_id,
                        "holder_name": sheet_data["holder_name"],
                        "pattern": "Full Sheet Bonus"
                    }
                    logger.info(f"🎉 Winner: {sheet_data['holder_name'] or group_key} - Full Sheet Bonus")
                    break
            if full_sheet_prize in new_winners:
                break
    
    # SEQUENTIAL FULL HOUSE with MULTIPLE WINNERS SHARING same prize
    # If multiple users complete Full House on the SAME CALL, they share that prize
    house_prize_variations = [
        ["1st Full House", "First Full House", "full_house", "Full House"],
        ["2nd Full House", "Second Full House"],
        ["3rd Full House", "Third Full House"]
    ]
    
    # Find actual prize names from game_dividends
    def find_full_house_prize(idx):
        """Find the actual prize name for a full house index"""
        if idx >= len(house_prize_variations):
            return None
        for variation in house_prize_variations[idx]:
            if variation in prizes_to_check:
                return variation
            for p in prizes_to_check:
                if normalize_prize_name(p) == normalize_prize_name(variation):
                    return p
        return None
    
    # Count existing Full House winners
    existing_house_count = 0
    for p in existing_winners.keys():
        if "full" in p.lower() and "house" in p.lower() and "sheet" not in p.lower():
            existing_house_count += 1
    
    if full_house_candidates and existing_house_count < 3:
        # All candidates completed on this call - they share the NEXT available prize
        next_prize_idx = existing_house_count
        prize_name = find_full_house_prize(next_prize_idx)
        
        # If no sequential full house prizes exist, try generic "Full House"
        if not prize_name:
            for p in prizes_to_check:
                if "full" in p.lower() and "house" in p.lower() and "sheet" not in p.lower():
                    if p not in existing_winners and p not in new_winners:
                        prize_name = p
                        break
        
        if prize_name and prize_name not in existing_winners and prize_name not in new_winners:
            if len(full_house_candidates) == 1:
                # Single winner
                candidate = full_house_candidates[0]
                new_winners[prize_name] = {
                    "user_id": candidate["user_id"],
                    "ticket_id": candidate["ticket_id"],
                    "ticket_number": candidate["ticket_number"],
                    "holder_name": candidate["holder_name"],
                    "pattern": prize_name
                }
                logger.info(f"🎉 Winner: {candidate['holder_name'] or candidate['user_id']} - {prize_name}")
            else:
                # Multiple winners - they SHARE the same prize
                # Store as list of winners
                shared_winners = []
                for candidate in full_house_candidates:
                    shared_winners.append({
                        "user_id": candidate["user_id"],
                        "ticket_id": candidate["ticket_id"],
                        "ticket_number": candidate["ticket_number"],
                        "holder_name": candidate["holder_name"]
                    })
                
                new_winners[prize_name] = {
                    "shared": True,
                    "winners": shared_winners,
                    "holder_name": ", ".join([w["holder_name"] for w in shared_winners]),
                    "pattern": prize_name
                }
                logger.info(f"🎉 SHARED Winner: {len(shared_winners)} players share {prize_name}!")
    
    return new_winners


def check_all_winners(ticket: dict, called_numbers: list, prize_type: str) -> dict:
    """
    Check if a single ticket wins a specific prize type.
    Used by auto-call for simpler winner detection.
    
    Args:
        ticket: The ticket document with 'numbers' field
        called_numbers: List of called numbers
        prize_type: The prize type to check (e.g., "Top Line", "Quick Five")
    
    Returns:
        Winner info dict if won, None otherwise
    """
    ticket_numbers = ticket.get("numbers", [])
    if not ticket_numbers or len(ticket_numbers) < 3:
        return None
    
    called_set = set(called_numbers)
    
    # Normalize prize type for comparison
    prize_lower = prize_type.lower().replace("_", " ").replace("-", " ")
    
    # Check Quick Five / Early Five
    if "quick" in prize_lower or "early" in prize_lower or "five" in prize_lower:
        if check_early_five(ticket_numbers, called_set):
            return {"won": True, "pattern": prize_type}
    
    # Check Top Line / First Line
    if "top" in prize_lower or "first" in prize_lower:
        if "house" not in prize_lower:  # Exclude "First Full House"
            if check_top_line(ticket_numbers, called_set):
                return {"won": True, "pattern": prize_type}
    
    # Check Middle Line / Second Line
    if "middle" in prize_lower or "second" in prize_lower:
        if "house" not in prize_lower:  # Exclude "Second Full House"
            if check_middle_line(ticket_numbers, called_set):
                return {"won": True, "pattern": prize_type}
    
    # Check Bottom Line / Third Line
    if "bottom" in prize_lower or "third" in prize_lower:
        if "house" not in prize_lower:  # Exclude "Third Full House"
            if check_bottom_line(ticket_numbers, called_set):
                return {"won": True, "pattern": prize_type}
    
    # Check Four Corners
    if "corner" in prize_lower or "4" in prize_lower:
        if check_four_corners(ticket_numbers, called_set):
            return {"won": True, "pattern": prize_type}
    
    # Check Full House (any variation)
    if "full" in prize_lower and "house" in prize_lower:
        if "sheet" not in prize_lower:  # Exclude "Full Sheet"
            if check_full_house(ticket_numbers, called_set):
                return {"won": True, "pattern": prize_type}
    
    return None


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
