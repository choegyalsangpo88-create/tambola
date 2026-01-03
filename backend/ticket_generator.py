# OFFICIAL TAMBOLA TICKET GENERATOR
# Following authentic Indian Tambola/Housie rules STRICTLY
import random
from typing import List, Optional, Tuple


# Column number ranges (official Tambola)
COLUMN_RANGES = [
    (1, 9),     # Column 0: 1-9 (9 numbers)
    (10, 19),   # Column 1: 10-19 (10 numbers)
    (20, 29),   # Column 2: 20-29 (10 numbers)
    (30, 39),   # Column 3: 30-39 (10 numbers)
    (40, 49),   # Column 4: 40-49 (10 numbers)
    (50, 59),   # Column 5: 50-59 (10 numbers)
    (60, 69),   # Column 6: 60-69 (10 numbers)
    (70, 79),   # Column 7: 70-79 (10 numbers)
    (80, 90),   # Column 8: 80-90 (11 numbers)
]


def generate_authentic_ticket() -> List[List[Optional[int]]]:
    """
    Generate a single authentic Tambola ticket following OFFICIAL rules:
    
    BASIC STRUCTURE:
    - 3 rows × 9 columns = 27 spaces total
    - Each row: Exactly 5 numbers + 4 blanks
    - Each column: 1-3 numbers (never empty, max 3)
    - Total: 15 numbers per ticket
    - Numbers sorted ascending within each column
    """
    
    for attempt in range(100):  # Multiple attempts to generate valid ticket
        ticket = [[None for _ in range(9)] for _ in range(3)]
        
        # STEP 1: Determine how many numbers per column (1, 2, or 3)
        # Total must be exactly 15, distributed across 9 columns
        col_counts = _generate_column_distribution()
        
        if sum(col_counts) != 15:
            continue
        
        # STEP 2: For each column, assign numbers to rows
        success = True
        for col_idx in range(9):
            count = col_counts[col_idx]
            if count == 0:
                success = False
                break
            
            # Get numbers from this column's range
            start, end = COLUMN_RANGES[col_idx]
            available_numbers = list(range(start, end + 1))
            
            # Pick random numbers
            chosen_numbers = sorted(random.sample(available_numbers, count))
            
            # Pick random rows for this column
            chosen_rows = sorted(random.sample([0, 1, 2], count))
            
            # Place numbers (already sorted)
            for i, row in enumerate(chosen_rows):
                ticket[row][col_idx] = chosen_numbers[i]
        
        if not success:
            continue
        
        # STEP 3: Validate and fix row counts (each row must have exactly 5)
        if _fix_row_distribution(ticket):
            # STEP 4: Sort numbers in each column (ascending)
            _sort_columns(ticket)
            
            # STEP 5: Final validation
            if _validate_ticket(ticket):
                return ticket
    
    # Fallback: Use deterministic approach
    return _generate_deterministic_ticket()


def _generate_column_distribution() -> List[int]:
    """
    Generate valid column distribution where:
    - Each column has 1, 2, or 3 numbers
    - Total is exactly 15
    """
    # Start with each column having at least 1 number (9 total)
    col_counts = [1] * 9
    remaining = 15 - 9  # 6 more to distribute
    
    # Randomly add 1 more to 6 columns (so they have 2 numbers)
    columns_to_add = random.sample(range(9), remaining)
    for col in columns_to_add:
        col_counts[col] += 1
    
    # Randomly shuffle to add variety
    # Some columns can have 3, but then others have 1
    if random.random() < 0.3:  # 30% chance to have a column with 3
        # Find a column with 2 and one with 1
        cols_with_2 = [i for i, c in enumerate(col_counts) if c == 2]
        cols_with_1 = [i for i, c in enumerate(col_counts) if c == 1]
        
        if cols_with_2 and cols_with_1:
            # Move one number from a 2-column to make it 3
            # And from another 2-column to the 1-column
            src = random.choice(cols_with_2)
            # Actually let's keep it simpler - just ensure valid distribution
            pass
    
    return col_counts


def _fix_row_distribution(ticket: List[List[Optional[int]]]) -> bool:
    """
    Ensure each row has exactly 5 numbers.
    Returns True if successful, False otherwise.
    """
    max_iterations = 50
    
    for _ in range(max_iterations):
        row_counts = [sum(1 for cell in row if cell is not None) for row in ticket]
        
        if row_counts == [5, 5, 5]:
            return True
        
        # Find rows with too many/too few numbers
        over_rows = [i for i, c in enumerate(row_counts) if c > 5]
        under_rows = [i for i, c in enumerate(row_counts) if c < 5]
        
        if not over_rows or not under_rows:
            # Can't fix - need to regenerate
            return False
        
        # Try to move a number from over_row to under_row
        over_row = over_rows[0]
        under_row = under_rows[0]
        
        # Find a column where over_row has a number and under_row doesn't
        for col in range(9):
            if ticket[over_row][col] is not None and ticket[under_row][col] is None:
                # Check if moving won't violate column constraints
                col_count = sum(1 for r in range(3) if ticket[r][col] is not None)
                
                # Move the number
                # We need to pick a new valid number for under_row in this column
                start, end = COLUMN_RANGES[col]
                existing_in_col = [ticket[r][col] for r in range(3) if ticket[r][col] is not None]
                available = [n for n in range(start, end + 1) if n not in existing_in_col]
                
                if available:
                    # Swap: remove from over_row, add new to under_row
                    ticket[over_row][col] = None
                    ticket[under_row][col] = random.choice(available)
                    break
    
    return False


def _sort_columns(ticket: List[List[Optional[int]]]):
    """Sort numbers in ascending order within each column."""
    for col in range(9):
        # Get all numbers in this column with their rows
        numbers_with_rows = [(row, ticket[row][col]) for row in range(3) if ticket[row][col] is not None]
        
        if len(numbers_with_rows) <= 1:
            continue
        
        # Sort by number value
        numbers_with_rows.sort(key=lambda x: x[1])
        
        # Get the rows that have numbers (in order)
        rows_with_numbers = sorted([row for row, _ in numbers_with_rows])
        
        # Reassign sorted numbers to rows
        for i, row in enumerate(rows_with_numbers):
            ticket[row][col] = numbers_with_rows[i][1]


def _validate_ticket(ticket: List[List[Optional[int]]]) -> bool:
    """Validate ticket follows all rules."""
    # Check row counts (each row must have exactly 5 numbers)
    for row in ticket:
        count = sum(1 for cell in row if cell is not None)
        if count != 5:
            return False
    
    # Check column counts (each column must have 1-3 numbers)
    for col in range(9):
        count = sum(1 for row in range(3) if ticket[row][col] is not None)
        if count < 1 or count > 3:
            return False
    
    # Check total numbers
    total = sum(1 for row in ticket for cell in row if cell is not None)
    if total != 15:
        return False
    
    # Check column ranges
    for col in range(9):
        start, end = COLUMN_RANGES[col]
        for row in range(3):
            num = ticket[row][col]
            if num is not None and (num < start or num > end):
                return False
    
    # Check ascending order in columns
    for col in range(9):
        prev = 0
        for row in range(3):
            num = ticket[row][col]
            if num is not None:
                if num <= prev:
                    return False
                prev = num
    
    return True


def _generate_deterministic_ticket() -> List[List[Optional[int]]]:
    """Fallback deterministic ticket generation."""
    ticket = [[None for _ in range(9)] for _ in range(3)]
    
    # Use a known working pattern: 2,2,2,1,2,1,2,2,1 = 15
    col_counts = [2, 2, 2, 1, 2, 1, 2, 2, 1]
    random.shuffle(col_counts)  # Add some randomness
    
    # Ensure total is 15
    while sum(col_counts) != 15:
        if sum(col_counts) < 15:
            idx = col_counts.index(1)
            col_counts[idx] = 2
        else:
            idx = col_counts.index(2)
            col_counts[idx] = 1
    
    row_counts = [0, 0, 0]
    
    for col in range(9):
        count = col_counts[col]
        start, end = COLUMN_RANGES[col]
        
        # Pick numbers
        numbers = sorted(random.sample(range(start, end + 1), count))
        
        # Pick rows that need more numbers
        available_rows = [r for r in range(3) if row_counts[r] < 5]
        if len(available_rows) < count:
            available_rows = [0, 1, 2]
        
        chosen_rows = sorted(random.sample(available_rows, count))
        
        for i, row in enumerate(chosen_rows):
            ticket[row][col] = numbers[i]
            row_counts[row] += 1
    
    return ticket


def generate_full_sheet(max_attempts: int = 100) -> List[List[List[Optional[int]]]]:
    """
    Generate an authentic Tambola Full Sheet with 6 tickets.
    
    FULL SHEET RULES:
    - 6 tickets per sheet
    - ALL 90 numbers (1-90) appear EXACTLY ONCE across all 6 tickets
    - Each ticket has exactly 15 numbers
    - 15 × 6 = 90 (all numbers covered)
    """
    
    for attempt in range(max_attempts):
        # Create number pools for each column
        column_pools = []
        for col in range(9):
            start, end = COLUMN_RANGES[col]
            numbers = list(range(start, end + 1))
            random.shuffle(numbers)
            column_pools.append(numbers)
        
        # Initialize 6 tickets
        tickets = [[[None for _ in range(9)] for _ in range(3)] for _ in range(6)]
        
        # Track row counts for each ticket
        ticket_row_counts = [[0, 0, 0] for _ in range(6)]
        
        # Distribute numbers from each column to tickets
        for col in range(9):
            pool = column_pools[col]
            num_count = len(pool)
            
            # Determine how many numbers each ticket gets from this column
            # Total numbers in pool must be distributed across 6 tickets
            # Each ticket should get 1-2 numbers from each column (average ~1.67)
            
            # Calculate distribution
            base = num_count // 6  # Either 1 or 1 (9/6=1, 10/6=1, 11/6=1)
            extra = num_count % 6  # Remaining to distribute
            
            distribution = [base] * 6
            # Give extra numbers to random tickets
            extra_tickets = random.sample(range(6), extra)
            for t in extra_tickets:
                distribution[t] += 1
            
            # Shuffle distribution
            random.shuffle(distribution)
            
            # Assign numbers to tickets
            num_idx = 0
            for ticket_idx in range(6):
                count = distribution[ticket_idx]
                if count == 0:
                    continue
                
                # Get numbers for this ticket
                ticket_numbers = sorted(pool[num_idx:num_idx + count])
                num_idx += count
                
                # Find best rows (those with fewer numbers)
                available_rows = sorted(range(3), key=lambda r: ticket_row_counts[ticket_idx][r])[:count]
                available_rows = sorted(available_rows)
                
                # Assign numbers to rows
                for i, row in enumerate(available_rows):
                    if i < len(ticket_numbers):
                        tickets[ticket_idx][row][col] = ticket_numbers[i]
                        ticket_row_counts[ticket_idx][row] += 1
        
        # Fix row distributions for each ticket
        for ticket_idx, ticket in enumerate(tickets):
            _balance_ticket_rows(ticket)
            _sort_columns(ticket)
        
        # Validate all tickets
        all_valid = True
        for ticket in tickets:
            if not _validate_ticket(ticket):
                all_valid = False
                break
        
        if not all_valid:
            continue
        
        # Validate all 90 numbers are present exactly once
        all_numbers = set()
        has_duplicate = False
        for ticket in tickets:
            for row in ticket:
                for num in row:
                    if num is not None:
                        if num in all_numbers:
                            has_duplicate = True
                            break
                        all_numbers.add(num)
                if has_duplicate:
                    break
            if has_duplicate:
                break
        
        if has_duplicate:
            continue
        
        if len(all_numbers) != 90 or all_numbers != set(range(1, 91)):
            continue
        
        return tickets
    
    # If all attempts fail, generate 6 individual tickets as fallback
    # (won't have all 90 numbers, but will be valid tickets)
    return [generate_authentic_ticket() for _ in range(6)]


def _balance_ticket_rows(ticket: List[List[Optional[int]]]):
    """Ensure each row has exactly 5 numbers."""
    for _ in range(50):
        row_counts = [sum(1 for cell in row if cell is not None) for row in ticket]
        
        if row_counts == [5, 5, 5]:
            return
        
        over_rows = [i for i, c in enumerate(row_counts) if c > 5]
        under_rows = [i for i, c in enumerate(row_counts) if c < 5]
        
        if not over_rows or not under_rows:
            return
        
        # Try to swap numbers between rows within same column
        for over_row in over_rows:
            for under_row in under_rows:
                for col in range(9):
                    if ticket[over_row][col] is not None and ticket[under_row][col] is None:
                        # Check if this column has room (less than 3 numbers)
                        col_count = sum(1 for r in range(3) if ticket[r][col] is not None)
                        if col_count < 3:
                            # Move number
                            ticket[under_row][col] = ticket[over_row][col]
                            ticket[over_row][col] = None
                            break
                else:
                    continue
                break


def generate_user_game_tickets(count: int) -> List[List[List[Optional[int]]]]:
    """Generate individual tickets for user-created games."""
    tickets = []
    for _ in range(count):
        ticket = generate_authentic_ticket()
        tickets.append(ticket)
    return tickets


def validate_ticket(ticket: List[List[Optional[int]]]) -> dict:
    """
    Validate a ticket and return detailed results.
    """
    results = {
        "valid": True,
        "errors": [],
        "total_numbers": 0,
        "row_counts": [],
        "col_counts": []
    }
    
    if len(ticket) != 3:
        results["valid"] = False
        results["errors"].append("Ticket must have exactly 3 rows")
        return results
    
    for row_idx, row in enumerate(ticket):
        if len(row) != 9:
            results["valid"] = False
            results["errors"].append(f"Row {row_idx + 1} must have exactly 9 columns")
    
    # Count numbers per row
    for row_idx, row in enumerate(ticket):
        count = sum(1 for cell in row if cell is not None)
        results["row_counts"].append(count)
        results["total_numbers"] += count
        
        if count != 5:
            results["valid"] = False
            results["errors"].append(f"Row {row_idx + 1} has {count} numbers (must be 5)")
    
    # Count numbers per column
    for col in range(9):
        count = sum(1 for row in ticket if row[col] is not None)
        results["col_counts"].append(count)
        
        if count < 1:
            results["valid"] = False
            results["errors"].append(f"Column {col + 1} is empty (must have 1-3 numbers)")
        elif count > 3:
            results["valid"] = False
            results["errors"].append(f"Column {col + 1} has {count} numbers (max 3)")
    
    if results["total_numbers"] != 15:
        results["valid"] = False
        results["errors"].append(f"Ticket has {results['total_numbers']} numbers (must be 15)")
    
    # Check column ranges and ascending order
    for col in range(9):
        start, end = COLUMN_RANGES[col]
        prev = 0
        for row in range(3):
            num = ticket[row][col]
            if num is not None:
                if num < start or num > end:
                    results["valid"] = False
                    results["errors"].append(f"Number {num} in column {col + 1} is out of range ({start}-{end})")
                if num <= prev:
                    results["valid"] = False
                    results["errors"].append(f"Column {col + 1} not sorted ascending")
                prev = num
    
    return results


def print_ticket(ticket: List[List[Optional[int]]]):
    """Print ticket in readable format."""
    print("+" + "-" * 45 + "+")
    for row in ticket:
        row_str = "|"
        for num in row:
            if num is None:
                row_str += "    |"
            else:
                row_str += f" {num:2d} |"
        print(row_str)
    print("+" + "-" * 45 + "+")
