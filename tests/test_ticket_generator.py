"""
Test Suite for Tambola Ticket Generator
Tests the ticket generation algorithm fixes:
1. Single ticket validation (15 numbers, 5 per row, 1-3 per column)
2. Full sheet validation (6 tickets, ALL 90 numbers exactly once)
3. Extensive stress testing (500+ full sheets)
"""

import pytest
import sys
import os

# Add backend to path
sys.path.insert(0, '/app/backend')

from ticket_generator import (
    generate_authentic_ticket,
    generate_full_sheet,
    validate_ticket,
    _validate_full_sheet,
    COLUMN_RANGES
)


class TestSingleTicketGeneration:
    """Tests for generate_authentic_ticket() function"""
    
    def test_ticket_has_3_rows(self):
        """Ticket must have exactly 3 rows"""
        ticket = generate_authentic_ticket()
        assert len(ticket) == 3, f"Ticket has {len(ticket)} rows, expected 3"
        print("✓ Ticket has exactly 3 rows")
    
    def test_ticket_has_9_columns(self):
        """Each row must have exactly 9 columns"""
        ticket = generate_authentic_ticket()
        for row_idx, row in enumerate(ticket):
            assert len(row) == 9, f"Row {row_idx+1} has {len(row)} columns, expected 9"
        print("✓ Each row has exactly 9 columns")
    
    def test_ticket_has_exactly_15_numbers(self):
        """Ticket must have exactly 15 numbers total"""
        ticket = generate_authentic_ticket()
        total_numbers = sum(1 for row in ticket for cell in row if cell is not None)
        assert total_numbers == 15, f"Ticket has {total_numbers} numbers, expected 15"
        print("✓ Ticket has exactly 15 numbers")
    
    def test_each_row_has_5_numbers(self):
        """Each row must have exactly 5 numbers"""
        ticket = generate_authentic_ticket()
        for row_idx, row in enumerate(ticket):
            row_count = sum(1 for cell in row if cell is not None)
            assert row_count == 5, f"Row {row_idx+1} has {row_count} numbers, expected 5"
        print("✓ Each row has exactly 5 numbers")
    
    def test_each_column_has_1_to_3_numbers(self):
        """Each column must have 1-3 numbers (never empty, max 3)"""
        ticket = generate_authentic_ticket()
        for col in range(9):
            col_count = sum(1 for row in range(3) if ticket[row][col] is not None)
            assert 1 <= col_count <= 3, f"Column {col+1} has {col_count} numbers, expected 1-3"
        print("✓ Each column has 1-3 numbers")
    
    def test_numbers_in_correct_column_ranges(self):
        """Numbers must be in their correct column ranges"""
        ticket = generate_authentic_ticket()
        for col in range(9):
            start, end = COLUMN_RANGES[col]
            for row in range(3):
                num = ticket[row][col]
                if num is not None:
                    assert start <= num <= end, f"Number {num} in column {col+1} is out of range ({start}-{end})"
        print("✓ All numbers are in correct column ranges")
    
    def test_numbers_sorted_ascending_in_columns(self):
        """Numbers must be sorted ascending within each column"""
        ticket = generate_authentic_ticket()
        for col in range(9):
            prev = 0
            for row in range(3):
                num = ticket[row][col]
                if num is not None:
                    assert num > prev, f"Column {col+1} not sorted: {prev} >= {num}"
                    prev = num
        print("✓ Numbers are sorted ascending in each column")
    
    def test_validate_ticket_function(self):
        """Test the validate_ticket() helper function"""
        ticket = generate_authentic_ticket()
        result = validate_ticket(ticket)
        assert result["valid"] == True, f"Ticket validation failed: {result['errors']}"
        assert result["total_numbers"] == 15
        assert result["row_counts"] == [5, 5, 5]
        print("✓ validate_ticket() function works correctly")
    
    def test_generate_100_valid_tickets(self):
        """Generate 100 tickets and verify all are valid"""
        invalid_count = 0
        errors = []
        
        for i in range(100):
            ticket = generate_authentic_ticket()
            result = validate_ticket(ticket)
            if not result["valid"]:
                invalid_count += 1
                errors.append(f"Ticket {i+1}: {result['errors']}")
        
        assert invalid_count == 0, f"{invalid_count}/100 tickets invalid:\n" + "\n".join(errors[:5])
        print(f"✓ Generated 100 valid tickets (100% success rate)")


class TestFullSheetGeneration:
    """Tests for generate_full_sheet() function - 6 tickets with ALL 90 numbers"""
    
    def test_full_sheet_has_6_tickets(self):
        """Full sheet must have exactly 6 tickets"""
        full_sheet = generate_full_sheet()
        assert len(full_sheet) == 6, f"Full sheet has {len(full_sheet)} tickets, expected 6"
        print("✓ Full sheet has exactly 6 tickets")
    
    def test_full_sheet_contains_all_90_numbers(self):
        """Full sheet must contain ALL numbers 1-90 exactly once"""
        full_sheet = generate_full_sheet()
        all_numbers = set()
        
        for ticket in full_sheet:
            for row in ticket:
                for num in row:
                    if num is not None:
                        all_numbers.add(num)
        
        expected = set(range(1, 91))
        missing = expected - all_numbers
        extra = all_numbers - expected
        
        assert len(all_numbers) == 90, f"Full sheet has {len(all_numbers)} unique numbers, expected 90"
        assert missing == set(), f"Missing numbers: {sorted(missing)}"
        assert extra == set(), f"Extra numbers: {sorted(extra)}"
        print("✓ Full sheet contains ALL 90 numbers (1-90)")
    
    def test_full_sheet_no_duplicate_numbers(self):
        """No number should appear more than once across all 6 tickets"""
        full_sheet = generate_full_sheet()
        all_numbers = []
        
        for ticket in full_sheet:
            for row in ticket:
                for num in row:
                    if num is not None:
                        all_numbers.append(num)
        
        duplicates = [num for num in all_numbers if all_numbers.count(num) > 1]
        assert len(duplicates) == 0, f"Duplicate numbers found: {set(duplicates)}"
        print("✓ No duplicate numbers in full sheet")
    
    def test_each_ticket_in_full_sheet_has_15_numbers(self):
        """Each ticket in full sheet must have exactly 15 numbers"""
        full_sheet = generate_full_sheet()
        
        for ticket_idx, ticket in enumerate(full_sheet):
            total = sum(1 for row in ticket for cell in row if cell is not None)
            assert total == 15, f"Ticket {ticket_idx+1} has {total} numbers, expected 15"
        
        print("✓ Each ticket in full sheet has exactly 15 numbers")
    
    def test_each_ticket_in_full_sheet_has_5_per_row(self):
        """Each ticket in full sheet must have 5 numbers per row"""
        full_sheet = generate_full_sheet()
        
        for ticket_idx, ticket in enumerate(full_sheet):
            for row_idx, row in enumerate(ticket):
                row_count = sum(1 for cell in row if cell is not None)
                assert row_count == 5, f"Ticket {ticket_idx+1}, Row {row_idx+1} has {row_count} numbers, expected 5"
        
        print("✓ Each ticket in full sheet has 5 numbers per row")
    
    def test_validate_full_sheet_function(self):
        """Test the _validate_full_sheet() helper function"""
        full_sheet = generate_full_sheet()
        assert _validate_full_sheet(full_sheet) == True, "Full sheet validation failed"
        print("✓ _validate_full_sheet() function works correctly")
    
    def test_full_sheet_total_is_90_numbers(self):
        """6 tickets × 15 numbers = 90 total numbers"""
        full_sheet = generate_full_sheet()
        total = sum(
            1 for ticket in full_sheet 
            for row in ticket 
            for cell in row 
            if cell is not None
        )
        assert total == 90, f"Full sheet has {total} total numbers, expected 90"
        print("✓ Full sheet has exactly 90 numbers total (6×15)")


class TestExtensiveValidation:
    """Stress tests - generate 500+ full sheets and verify all are valid"""
    
    def test_generate_500_valid_full_sheets(self):
        """Generate 500 full sheets and verify ALL are valid"""
        invalid_count = 0
        errors = []
        total_sheets = 500
        
        for i in range(total_sheets):
            full_sheet = generate_full_sheet()
            
            # Validate full sheet
            if not _validate_full_sheet(full_sheet):
                invalid_count += 1
                
                # Collect detailed error info
                all_nums = set()
                ticket_issues = []
                
                for t_idx, ticket in enumerate(full_sheet):
                    t_total = sum(1 for row in ticket for c in row if c is not None)
                    row_counts = [sum(1 for c in row if c is not None) for row in ticket]
                    
                    if t_total != 15 or row_counts != [5, 5, 5]:
                        ticket_issues.append(f"Ticket {t_idx+1}: total={t_total}, rows={row_counts}")
                    
                    for row in ticket:
                        for c in row:
                            if c is not None:
                                all_nums.add(c)
                
                missing = set(range(1, 91)) - all_nums
                errors.append(f"Sheet {i+1}: {len(all_nums)} unique nums, missing={sorted(missing)[:5]}..., issues={ticket_issues[:2]}")
                
                if len(errors) >= 10:
                    break  # Stop collecting after 10 errors
        
        success_rate = ((total_sheets - invalid_count) / total_sheets) * 100
        
        assert invalid_count == 0, (
            f"FAILED: {invalid_count}/{total_sheets} full sheets invalid ({success_rate:.1f}% success rate)\n"
            f"First errors:\n" + "\n".join(errors[:5])
        )
        
        print(f"✓ Generated {total_sheets} valid full sheets (100% success rate)")
    
    def test_generate_100_full_sheets_detailed_validation(self):
        """Generate 100 full sheets with detailed validation of each"""
        for i in range(100):
            full_sheet = generate_full_sheet()
            
            # Collect all numbers
            all_numbers = []
            for ticket in full_sheet:
                for row in ticket:
                    for num in row:
                        if num is not None:
                            all_numbers.append(num)
            
            # Check total count
            assert len(all_numbers) == 90, f"Sheet {i+1}: has {len(all_numbers)} numbers, expected 90"
            
            # Check uniqueness
            unique_numbers = set(all_numbers)
            assert len(unique_numbers) == 90, f"Sheet {i+1}: has {len(unique_numbers)} unique numbers, expected 90"
            
            # Check range
            assert unique_numbers == set(range(1, 91)), f"Sheet {i+1}: numbers don't match 1-90"
            
            # Check each ticket
            for t_idx, ticket in enumerate(full_sheet):
                total = sum(1 for row in ticket for c in row if c is not None)
                assert total == 15, f"Sheet {i+1}, Ticket {t_idx+1}: has {total} numbers, expected 15"
                
                for r_idx, row in enumerate(ticket):
                    row_count = sum(1 for c in row if c is not None)
                    assert row_count == 5, f"Sheet {i+1}, Ticket {t_idx+1}, Row {r_idx+1}: has {row_count} numbers, expected 5"
        
        print("✓ Generated 100 full sheets with detailed validation (100% success rate)")


class TestColumnRangeDistribution:
    """Test that column ranges are correctly distributed"""
    
    def test_column_ranges_are_correct(self):
        """Verify COLUMN_RANGES constant is correct"""
        expected_ranges = [
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
        assert COLUMN_RANGES == expected_ranges, f"COLUMN_RANGES mismatch"
        print("✓ COLUMN_RANGES constant is correct")
    
    def test_column_sizes_sum_to_90(self):
        """Column sizes should sum to 90"""
        total = sum(end - start + 1 for start, end in COLUMN_RANGES)
        assert total == 90, f"Column sizes sum to {total}, expected 90"
        print("✓ Column sizes sum to 90")
    
    def test_full_sheet_column_distribution(self):
        """Each column in full sheet should have correct number of numbers"""
        full_sheet = generate_full_sheet()
        
        # Count numbers per column across all 6 tickets
        col_counts = [0] * 9
        for ticket in full_sheet:
            for row in ticket:
                for col, num in enumerate(row):
                    if num is not None:
                        col_counts[col] += 1
        
        expected_counts = [9, 10, 10, 10, 10, 10, 10, 10, 11]  # Based on column ranges
        assert col_counts == expected_counts, f"Column counts {col_counts} != expected {expected_counts}"
        print(f"✓ Full sheet column distribution is correct: {col_counts}")


class TestWhatsAppNumberUpdate:
    """Test that WhatsApp number was updated in GameDetails.js"""
    
    def test_whatsapp_number_is_updated(self):
        """Verify WhatsApp number is 918837489781 (new number)"""
        with open('/app/frontend/src/pages/GameDetails.js', 'r') as f:
            content = f.read()
        
        # Check new number is present
        assert '918837489781' in content, "New WhatsApp number 918837489781 not found in GameDetails.js"
        
        # Check old number is NOT present
        assert '916909166157' not in content, "Old WhatsApp number 916909166157 still present in GameDetails.js"
        
        print("✓ WhatsApp number updated to 918837489781")
    
    def test_auth_headers_function_exists(self):
        """Verify getAuthHeaders function exists in GameDetails.js"""
        with open('/app/frontend/src/pages/GameDetails.js', 'r') as f:
            content = f.read()
        
        assert 'getAuthHeaders' in content, "getAuthHeaders function not found in GameDetails.js"
        assert 'Authorization' in content, "Authorization header not found in GameDetails.js"
        assert 'Bearer' in content, "Bearer token format not found in GameDetails.js"
        
        print("✓ getAuthHeaders function with Authorization header exists")
    
    def test_api_calls_include_auth_headers(self):
        """Verify API calls include auth headers for mobile fallback"""
        with open('/app/frontend/src/pages/GameDetails.js', 'r') as f:
            content = f.read()
        
        # Check that getAuthHeaders() is used in API calls
        assert 'headers: getAuthHeaders()' in content, "API calls don't include getAuthHeaders()"
        
        print("✓ API calls include auth headers for mobile fallback")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
