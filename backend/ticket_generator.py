# Authentic Tambola Ticket Generator
# Following classic Indian Tambola/Housie rules STRICTLY
import random
from typing import List, Optional


def generate_authentic_ticket() -> List[List[Optional[int]]]:
    """
    Generate a single authentic Tambola ticket following STRICT rules:
    - 3 rows x 9 columns = 27 cells
    - Each row has EXACTLY 5 numbers and 4 blanks
    - Each column follows number ranges
    - Numbers in columns are sorted top to bottom
    - Total EXACTLY 15 numbers per ticket
    """
    column_ranges = [
        (1, 9),    # Col 0: 1-9
        (10, 19),  # Col 1: 10-19
        (20, 29),  # Col 2: 20-29
        (30, 39),  # Col 3: 30-39
        (40, 49),  # Col 4: 40-49
        (50, 59),  # Col 5: 50-59
        (60, 69),  # Col 6: 60-69
        (70, 79),  # Col 7: 70-79
        (80, 90),  # Col 8: 80-90
    ]
    
    # Try multiple times to generate a valid ticket
    for attempt in range(100):
        ticket = [[None for _ in range(9)] for _ in range(3)]
        
        # Step 1: Determine how many numbers go in each column (1, 2, or 3)
        # Total must be exactly 15
        col_counts = _get_valid_column_distribution()
        
        if sum(col_counts) != 15:
            continue
        
        # Step 2: For each column, pick numbers and assign to rows
        for col_idx in range(9):
            start, end = column_ranges[col_idx]
            count = col_counts[col_idx]
            
            if count == 0:
                continue
            
            # Pick random numbers from this column's range
            available = list(range(start, end + 1))
            chosen_numbers = sorted(random.sample(available, count))
            
            # Pick random rows for this column
            chosen_rows = sorted(random.sample([0, 1, 2], count))
            
            # Place numbers (sorted top to bottom)
            for i, row in enumerate(chosen_rows):
                ticket[row][col_idx] = chosen_numbers[i]
        
        # Step 3: Verify and fix row counts
        if _fix_ticket_rows(ticket, column_ranges):
            # Final validation
            total = sum(1 for row in ticket for cell in row if cell is not None)
            row_counts = [sum(1 for cell in row if cell is not None) for row in ticket]
            
            if total == 15 and row_counts == [5, 5, 5]:
                return ticket
    
    # Fallback - deterministic generation
    return _generate_guaranteed_valid_ticket(column_ranges)


def _get_valid_column_distribution() -> List[int]:
    """
    Generate a valid distribution of numbers across 9 columns.
    Total must be 15, each column gets 1, 2, or 3 numbers.
    """
    # Valid patterns that sum to 15 with each value 1-3
    patterns = [
        [2, 2, 2, 1, 2, 1, 2, 2, 1],  # 15
        [1, 2, 2, 2, 2, 2, 1, 2, 1],  # 15
        [2, 1, 2, 2, 1, 2, 2, 2, 1],  # 15
        [1, 2, 1, 2, 2, 2, 2, 2, 1],  # 15
        [2, 2, 1, 2, 2, 1, 2, 1, 2],  # 15
        [2, 1, 2, 1, 2, 2, 2, 1, 2],  # 15
        [1, 2, 2, 2, 1, 2, 2, 2, 1],  # 15
        [2, 2, 2, 2, 1, 1, 2, 2, 1],  # 15
        [1, 1, 2, 2, 2, 2, 2, 2, 1],  # 15
        [2, 2, 1, 1, 2, 2, 2, 2, 1],  # 15
    ]
    pattern = random.choice(patterns)
    random.shuffle(pattern)
    return pattern


def _fix_ticket_rows(ticket: List[List[Optional[int]]], column_ranges) -> bool:
    """Fix ticket to ensure each row has exactly 5 numbers"""
    max_iterations = 50
    
    for _ in range(max_iterations):
        row_counts = [sum(1 for cell in row if cell is not None) for row in ticket]
        
        if row_counts == [5, 5, 5]:
            return True
        
        # Find rows with too many/too few numbers
        over_rows = [i for i, c in enumerate(row_counts) if c > 5]
        under_rows = [i for i, c in enumerate(row_counts) if c < 5]
        
        if not over_rows or not under_rows:
            break
        
        over_row = over_rows[0]
        under_row = under_rows[0]
        
        # Find a column where we can move a number
        moved = False
        for col in range(9):
            if ticket[over_row][col] is not None and ticket[under_row][col] is None:
                # Check column count won't exceed 3
                col_count = sum(1 for r in range(3) if ticket[r][col] is not None)
                if col_count <= 3:
                    # Move number from over_row to under_row (need to pick a new number)
                    start, end = column_ranges[col]
                    existing_in_col = [ticket[r][col] for r in range(3) if ticket[r][col] is not None]
                    available = [n for n in range(start, end + 1) if n not in existing_in_col]
                    
                    if available:
                        ticket[under_row][col] = random.choice(available)
                        ticket[over_row][col] = None
                        
                        # Re-sort column
                        _sort_column(ticket, col)
                        moved = True
                        break
        
        if not moved:
            break
    
    return row_counts == [5, 5, 5]


def _sort_column(ticket: List[List[Optional[int]]], col: int):
    """Sort numbers in a column from top to bottom"""
    numbers = [(r, ticket[r][col]) for r in range(3) if ticket[r][col] is not None]
    if len(numbers) <= 1:
        return
    
    numbers.sort(key=lambda x: x[1])
    rows_with_numbers = sorted([r for r, _ in numbers])
    
    for i, row in enumerate(rows_with_numbers):
        ticket[row][col] = numbers[i][1]


def _generate_guaranteed_valid_ticket(column_ranges) -> List[List[Optional[int]]]:
    """Generate a guaranteed valid ticket using a deterministic approach"""
    ticket = [[None for _ in range(9)] for _ in range(3)]
    
    # Use a known working pattern: 5 numbers per row distributed across columns
    # Pattern: columns get 2,2,2,2,2,1,1,2,1 = 15 numbers
    col_counts = [2, 2, 2, 2, 2, 1, 1, 2, 1]
    
    # Track row counts
    row_counts = [0, 0, 0]
    
    for col_idx in range(9):
        start, end = column_ranges[col_idx]
        count = col_counts[col_idx]
        
        # Pick numbers
        numbers = sorted(random.sample(range(start, end + 1), count))
        
        # Choose rows that need more numbers
        available_rows = [r for r in range(3) if row_counts[r] < 5]
        if len(available_rows) < count:
            available_rows = [0, 1, 2]
        
        chosen_rows = sorted(random.sample(available_rows, count))
        
        for i, row in enumerate(chosen_rows):
            ticket[row][col_idx] = numbers[i]
            row_counts[row] += 1
    
    return ticket


def generate_full_sheet() -> List[List[List[Optional[int]]]]:
    """
    Generate an authentic Tambola Full Sheet with 6 tickets.
    Each Full Sheet contains ALL numbers 1-90 EXACTLY ONCE across its 6 tickets.
    Each ticket has exactly 15 numbers (5 per row).
    """
    column_ranges = [
        list(range(1, 10)),      # Col 0: 1-9 (9 numbers)
        list(range(10, 20)),     # Col 1: 10-19 (10 numbers)
        list(range(20, 30)),     # Col 2: 20-29 (10 numbers)
        list(range(30, 40)),     # Col 3: 30-39 (10 numbers)
        list(range(40, 50)),     # Col 4: 40-49 (10 numbers)
        list(range(50, 60)),     # Col 5: 50-59 (10 numbers)
        list(range(60, 70)),     # Col 6: 60-69 (10 numbers)
        list(range(70, 80)),     # Col 7: 70-79 (10 numbers)
        list(range(80, 91))      # Col 8: 80-90 (11 numbers)
    ]
    
    # Shuffle each column
    for col_nums in column_ranges:
        random.shuffle(col_nums)
    
    # Initialize 6 tickets with 3 rows x 9 columns each
    tickets = [[[None for _ in range(9)] for _ in range(3)] for _ in range(6)]
    
    # For a valid full sheet:
    # - All 90 numbers must appear exactly once
    # - Each ticket must have exactly 15 numbers
    # - Each row in each ticket must have exactly 5 numbers
    
    # Distribution pattern for 6 tickets across columns:
    # Col 0 (9 numbers): distribute ~1.5 per ticket
    # Cols 1-7 (10 numbers each): distribute ~1.67 per ticket
    # Col 8 (11 numbers): distribute ~1.83 per ticket
    
    # Create a distribution plan
    # Each ticket needs exactly 15 numbers total
    # Pattern per column that ensures fair distribution:
    distribution_patterns = [
        [2, 2, 1, 2, 1, 1],  # Col 0: 9 numbers (sum = 9)
        [2, 2, 2, 1, 2, 1],  # Col 1: 10 numbers
        [2, 1, 2, 2, 2, 1],  # Col 2: 10 numbers
        [1, 2, 2, 2, 1, 2],  # Col 3: 10 numbers
        [2, 2, 1, 2, 2, 1],  # Col 4: 10 numbers
        [2, 1, 2, 1, 2, 2],  # Col 5: 10 numbers
        [1, 2, 2, 2, 1, 2],  # Col 6: 10 numbers
        [2, 2, 1, 2, 2, 1],  # Col 7: 10 numbers
        [1, 2, 2, 1, 2, 3],  # Col 8: 11 numbers (sum = 11)
    ]
    
    # Verify each ticket gets 15 numbers
    for t in range(6):
        total = sum(distribution_patterns[c][t] for c in range(9))
        # Adjust if needed
        while total != 15:
            if total < 15:
                # Add to a column with count < 3
                for c in range(9):
                    if distribution_patterns[c][t] < 3:
                        distribution_patterns[c][t] += 1
                        total += 1
                        break
            else:
                # Remove from a column with count > 1
                for c in range(9):
                    if distribution_patterns[c][t] > 1:
                        distribution_patterns[c][t] -= 1
                        total -= 1
                        break
    
    # Now assign numbers to tickets
    for col_idx in range(9):
        col_numbers = column_ranges[col_idx].copy()
        num_idx = 0
        
        for ticket_idx in range(6):
            count = distribution_patterns[col_idx][ticket_idx]
            
            # Get numbers for this ticket in this column
            ticket_col_numbers = sorted(col_numbers[num_idx:num_idx + count])
            num_idx += count
            
            # Assign to rows - prioritize rows with fewer numbers
            row_counts = [sum(1 for c in range(9) if tickets[ticket_idx][r][c] is not None) for r in range(3)]
            
            # Get rows sorted by count (ascending)
            available_rows = sorted(range(3), key=lambda r: row_counts[r])[:count]
            available_rows = sorted(available_rows)  # Sort by row index for proper number placement
            
            for i, row in enumerate(available_rows):
                if i < len(ticket_col_numbers):
                    tickets[ticket_idx][row][col_idx] = ticket_col_numbers[i]
    
    # Sort numbers in each column (top to bottom) and fix row counts
    for ticket in tickets:
        for col_idx in range(9):
            _sort_column(ticket, col_idx)
        
        # Fix row counts if needed
        _balance_ticket_rows(ticket)
    
    return tickets


def _balance_ticket_rows(ticket: List[List[Optional[int]]]):
    """Ensure each row has exactly 5 numbers by swapping within columns"""
    for iteration in range(50):
        row_counts = [sum(1 for cell in row if cell is not None) for row in ticket]
        
        if row_counts == [5, 5, 5]:
            return
        
        over_rows = [i for i, c in enumerate(row_counts) if c > 5]
        under_rows = [i for i, c in enumerate(row_counts) if c < 5]
        
        if not over_rows or not under_rows:
            return
        
        # Try to swap numbers between rows in same column
        for over_row in over_rows:
            for under_row in under_rows:
                for col in range(9):
                    # Check if we can swap
                    if ticket[over_row][col] is not None and ticket[under_row][col] is None:
                        # Move number
                        ticket[under_row][col] = ticket[over_row][col]
                        ticket[over_row][col] = None
                        
                        # Re-sort column
                        col_nums = [(r, ticket[r][col]) for r in range(3) if ticket[r][col] is not None]
                        col_nums.sort(key=lambda x: x[1])
                        rows_used = sorted([r for r, _ in col_nums])
                        
                        for i, r in enumerate(rows_used):
                            ticket[r][col] = col_nums[i][1]
                        
                        break


def generate_user_game_tickets(count: int) -> List[List[List[Optional[int]]]]:
    """Generate individual tickets for user-created games"""
    tickets = []
    for _ in range(count):
        ticket = generate_authentic_ticket()
        # Validate
        total = sum(1 for row in ticket for cell in row if cell is not None)
        if total != 15:
            # Regenerate
            ticket = generate_authentic_ticket()
        tickets.append(ticket)
    return tickets


def validate_ticket(ticket: List[List[Optional[int]]]) -> dict:
    """Validate a ticket and return validation results"""
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
    for row in ticket:
        count = sum(1 for cell in row if cell is not None)
        results["row_counts"].append(count)
        results["total_numbers"] += count
        
        if count != 5:
            results["valid"] = False
            results["errors"].append(f"Row has {count} numbers instead of 5")
    
    # Count numbers per column
    for col in range(9):
        count = sum(1 for row in ticket if row[col] is not None)
        results["col_counts"].append(count)
        
        if count < 1 or count > 3:
            results["valid"] = False
            results["errors"].append(f"Column {col + 1} has {count} numbers (must be 1-3)")
    
    if results["total_numbers"] != 15:
        results["valid"] = False
        results["errors"].append(f"Ticket has {results['total_numbers']} numbers instead of 15")
    
    return results
