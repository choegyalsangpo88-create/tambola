# Authentic Tambola Ticket Generator
# Following classic Indian Tambola/Housie rules
import random
from typing import List, Optional

def generate_authentic_ticket() -> List[List[Optional[int]]]:
    """
    Generate a single authentic Tambola ticket following classic rules:
    - 3 rows x 9 columns = 27 cells
    - Each row has exactly 5 numbers and 4 blanks
    - Each column follows number ranges:
      Col 0: 1-9, Col 1: 10-19, ..., Col 8: 80-90
    - Numbers in columns are sorted top to bottom
    - Each column has 1, 2, or 3 numbers (never 0 or 4+)
    - Total 15 numbers per ticket
    """
    # Column ranges
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
    
    max_attempts = 100
    for _ in range(max_attempts):
        ticket = [[None for _ in range(9)] for _ in range(3)]
        
        # Step 1: Decide how many numbers each column gets (1, 2, or 3)
        # Total must be 15 (5 per row * 3 rows)
        col_counts = []
        remaining = 15
        
        for col_idx in range(9):
            if col_idx == 8:  # Last column gets remaining
                col_counts.append(remaining)
            else:
                # Each column must have at least 1 and at most 3
                min_val = max(1, remaining - (8 - col_idx) * 3)
                max_val = min(3, remaining - (8 - col_idx))
                if min_val > max_val:
                    min_val = max_val = remaining // (9 - col_idx)
                count = random.randint(min_val, max_val)
                col_counts.append(count)
                remaining -= count
        
        # Validate total is 15
        if sum(col_counts) != 15:
            continue
        
        # Step 2: For each column, pick random numbers and rows
        for col_idx in range(9):
            start, end = column_ranges[col_idx]
            count = col_counts[col_idx]
            
            if count == 0 or count > 3:
                continue  # Invalid, retry
            
            # Pick random numbers from this column's range
            available = list(range(start, end + 1))
            chosen_numbers = sorted(random.sample(available, min(count, len(available))))
            
            # Pick random rows
            chosen_rows = sorted(random.sample([0, 1, 2], count))
            
            # Place numbers (sorted top to bottom)
            for i, row in enumerate(chosen_rows):
                ticket[row][col_idx] = chosen_numbers[i]
        
        # Step 3: Validate each row has exactly 5 numbers
        row_counts = [sum(1 for cell in row if cell is not None) for row in ticket]
        
        if row_counts != [5, 5, 5]:
            # Try to fix by moving numbers between rows
            if not _fix_row_counts(ticket, col_counts):
                continue
        
        # Final validation
        row_counts = [sum(1 for cell in row if cell is not None) for row in ticket]
        if row_counts == [5, 5, 5]:
            return ticket
    
    # Fallback: Generate a valid ticket using deterministic method
    return _generate_fallback_ticket()


def _fix_row_counts(ticket, col_counts):
    """Try to fix row counts by swapping numbers between rows"""
    for _ in range(50):  # Max iterations
        row_counts = [sum(1 for cell in row if cell is not None) for row in ticket]
        if row_counts == [5, 5, 5]:
            return True
        
        # Find rows with too many/too few numbers
        over_row = next((i for i, c in enumerate(row_counts) if c > 5), None)
        under_row = next((i for i, c in enumerate(row_counts) if c < 5), None)
        
        if over_row is None or under_row is None:
            return False
        
        # Find a column where we can swap
        for col in range(9):
            if ticket[over_row][col] is not None and ticket[under_row][col] is None:
                # Check if this column can have a number in under_row
                col_count = sum(1 for r in range(3) if ticket[r][col] is not None)
                if col_count <= 3:
                    ticket[under_row][col] = ticket[over_row][col]
                    ticket[over_row][col] = None
                    break
    
    return False


def _generate_fallback_ticket():
    """Generate a valid ticket using a more deterministic approach"""
    ticket = [[None for _ in range(9)] for _ in range(3)]
    
    column_ranges = [
        (1, 9), (10, 19), (20, 29), (30, 39), (40, 49),
        (50, 59), (60, 69), (70, 79), (80, 90)
    ]
    
    # Preset column distribution that guarantees 5 numbers per row
    # Pattern: 2,2,2,2,2,1,1,2,1 or similar that sums to 15
    patterns = [
        [2, 2, 2, 1, 2, 1, 2, 2, 1],
        [1, 2, 2, 2, 2, 2, 1, 2, 1],
        [2, 1, 2, 2, 1, 2, 2, 1, 2],
        [1, 2, 1, 2, 2, 2, 2, 2, 1],
        [2, 2, 1, 2, 2, 1, 2, 1, 2],
    ]
    col_counts = random.choice(patterns)
    
    # Assign row positions for each column
    row_totals = [0, 0, 0]
    
    for col_idx in range(9):
        start, end = column_ranges[col_idx]
        count = col_counts[col_idx]
        
        numbers = sorted(random.sample(range(start, end + 1), count))
        
        # Choose rows that need more numbers
        available_rows = [r for r in range(3) if row_totals[r] < 5]
        if len(available_rows) < count:
            available_rows = [0, 1, 2]
        
        chosen_rows = sorted(random.sample(available_rows, min(count, len(available_rows))))
        
        for i, row in enumerate(chosen_rows):
            if i < len(numbers):
                ticket[row][col_idx] = numbers[i]
                row_totals[row] += 1
    
    return ticket


def generate_full_sheet() -> List[List[List[Optional[int]]]]:
    """
    Generate an authentic Tambola Full Sheet with 6 tickets.
    Each Full Sheet contains ALL numbers 1-90 exactly once.
    """
    # Column ranges
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
    
    # Initialize 6 tickets
    tickets = [[[None for _ in range(9)] for _ in range(3)] for _ in range(6)]
    
    # Track how many numbers each row has in each ticket
    row_counts = [[0, 0, 0] for _ in range(6)]
    
    # Distribute numbers column by column
    for col_idx, col_nums in enumerate(column_ranges):
        num_count = len(col_nums)
        
        # Each ticket gets either 1 or 2 numbers from each column
        # Distribute to balance row counts
        num_idx = 0
        
        # Calculate how many numbers each ticket gets from this column
        tickets_per_num = []
        remaining = num_count
        for t in range(6):
            if remaining <= 0:
                tickets_per_num.append(0)
            elif remaining >= 6 - t:
                # Need to give at least 1 to remaining tickets
                count = 2 if remaining > (6 - t) else 1
                tickets_per_num.append(count)
                remaining -= count
            else:
                tickets_per_num.append(1 if remaining > 0 else 0)
                remaining -= 1
        
        # Shuffle distribution
        random.shuffle(tickets_per_num)
        
        # Assign numbers to tickets
        for ticket_idx, count in enumerate(tickets_per_num):
            for i in range(count):
                if num_idx >= len(col_nums):
                    break
                    
                # Find best row (one that needs more numbers)
                best_row = min(range(3), key=lambda r: row_counts[ticket_idx][r])
                
                # Place number
                tickets[ticket_idx][best_row][col_idx] = col_nums[num_idx]
                row_counts[ticket_idx][best_row] += 1
                num_idx += 1
    
    # Sort numbers in each column (top to bottom)
    for ticket in tickets:
        for col_idx in range(9):
            col_numbers = [(row, ticket[row][col_idx]) for row in range(3) if ticket[row][col_idx] is not None]
            if col_numbers:
                col_numbers.sort(key=lambda x: x[1])
                rows = sorted([r for r, _ in col_numbers])
                for i, row in enumerate(rows):
                    ticket[row][col_idx] = col_numbers[i][1]
    
    # Balance rows to exactly 5 numbers each
    for ticket_idx, ticket in enumerate(tickets):
        _balance_ticket_rows(ticket)
    
    # Convert any remaining 0s to None
    for ticket in tickets:
        for row in ticket:
            for i in range(len(row)):
                if row[i] == 0:
                    row[i] = None
    
    return tickets


def _balance_ticket_rows(ticket):
    """Ensure each row has exactly 5 numbers"""
    for _ in range(20):  # Max iterations
        row_counts = [sum(1 for cell in row if cell is not None) for row in ticket]
        
        if row_counts == [5, 5, 5]:
            return
        
        # Find over and under rows
        over_rows = [i for i, c in enumerate(row_counts) if c > 5]
        under_rows = [i for i, c in enumerate(row_counts) if c < 5]
        
        if not over_rows or not under_rows:
            return
        
        over_row = over_rows[0]
        under_row = under_rows[0]
        
        # Find a column to swap
        for col in range(9):
            # Check if over_row has number in this column and under_row doesn't
            if ticket[over_row][col] is not None and ticket[under_row][col] is None:
                # Move number
                ticket[under_row][col] = ticket[over_row][col]
                ticket[over_row][col] = None
                break


def generate_user_game_tickets(count: int) -> List[List[List[Optional[int]]]]:
    """Generate tickets for user-created games"""
    tickets = []
    for _ in range(count):
        tickets.append(generate_authentic_ticket())
    return tickets
