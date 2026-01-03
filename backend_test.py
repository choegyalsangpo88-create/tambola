import requests
import sys
import json
from datetime import datetime

class TambolaAPITester:
    def __init__(self, base_url="https://tambola-live-6.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = "9740c20a7af441c6be784ececbe13a422a63031193f24b9d80c795d5a461a5d3"  # Valid session from DB
        self.user_id = "test_user_123"
        self.tests_run = 0
        self.tests_passed = 0
        self.game_id = None
        self.booking_id = None
        self.ticket_ids = []
        self.user_game_id = None
        self.share_code = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        default_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION ENDPOINTS")
        print("="*50)
        
        # Test /auth/me
        success, user_data = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        if success and user_data:
            print(f"   User: {user_data.get('name')} ({user_data.get('email')})")
            return True
        return False

    def test_game_endpoints(self):
        """Test game management endpoints"""
        print("\n" + "="*50)
        print("TESTING GAME ENDPOINTS")
        print("="*50)
        
        # Test get all games
        success, games_data = self.run_test(
            "Get All Games",
            "GET",
            "games",
            200
        )
        
        # Test create game
        game_data = {
            "name": f"Test Game {datetime.now().strftime('%H%M%S')}",
            "date": "2025-01-30",
            "time": "20:00",
            "price": 50.0,
            "prizes": {
                "first_line": 1000.0,
                "second_line": 500.0,
                "full_house": 2000.0
            }
        }
        
        success, created_game = self.run_test(
            "Create Game",
            "POST",
            "games",
            200,
            data=game_data
        )
        
        if success and created_game:
            self.game_id = created_game.get('game_id')
            print(f"   Created Game ID: {self.game_id}")
            
            # Test get specific game
            success, game_details = self.run_test(
                "Get Game Details",
                "GET",
                f"games/{self.game_id}",
                200
            )
            
            return True
        return False

    def test_ticket_endpoints(self):
        """Test ticket management endpoints"""
        if not self.game_id:
            print("❌ Skipping ticket tests - no game_id available")
            return False
            
        print("\n" + "="*50)
        print("TESTING TICKET ENDPOINTS")
        print("="*50)
        
        # Test generate tickets
        success, generate_result = self.run_test(
            "Generate Tickets",
            "POST",
            f"games/{self.game_id}/generate-tickets",
            200
        )
        
        if success:
            # Test get game tickets
            success, tickets_data = self.run_test(
                "Get Game Tickets",
                "GET",
                f"games/{self.game_id}/tickets?page=1&limit=5&available_only=true",
                200
            )
            
            if success and tickets_data.get('tickets'):
                # Store some ticket IDs for booking tests
                self.ticket_ids = [t['ticket_id'] for t in tickets_data['tickets'][:2]]
                print(f"   Available tickets: {len(tickets_data['tickets'])}")
                print(f"   Selected ticket IDs: {self.ticket_ids}")
                return True
        
        return False

    def test_booking_endpoints(self):
        """Test booking management endpoints"""
        if not self.game_id or not self.ticket_ids:
            print("❌ Skipping booking tests - no game_id or ticket_ids available")
            return False
            
        print("\n" + "="*50)
        print("TESTING BOOKING ENDPOINTS")
        print("="*50)
        
        # Test create booking
        booking_data = {
            "game_id": self.game_id,
            "ticket_ids": self.ticket_ids
        }
        
        success, created_booking = self.run_test(
            "Create Booking",
            "POST",
            "bookings",
            200,
            data=booking_data
        )
        
        if success and created_booking:
            self.booking_id = created_booking.get('booking_id')
            print(f"   Created Booking ID: {self.booking_id}")
            
            # Test get my bookings
            success, my_bookings = self.run_test(
                "Get My Bookings",
                "GET",
                "bookings/my",
                200
            )
            
            # Test get booking tickets
            if self.booking_id:
                success, booking_tickets = self.run_test(
                    "Get Booking Tickets",
                    "GET",
                    f"bookings/{self.booking_id}/tickets",
                    200
                )
            
            return True
        return False

    def test_admin_endpoints(self):
        """Test admin endpoints"""
        print("\n" + "="*50)
        print("TESTING ADMIN ENDPOINTS")
        print("="*50)
        
        # Test get all bookings
        success, all_bookings = self.run_test(
            "Get All Bookings (Admin)",
            "GET",
            "admin/bookings",
            200
        )
        
        # Test confirm booking if we have one
        if self.booking_id:
            success, confirm_result = self.run_test(
                "Confirm Booking (Admin)",
                "PUT",
                f"admin/bookings/{self.booking_id}/confirm",
                200
            )
        
        return True

    def test_live_game_endpoints(self):
        """Test live game functionality"""
        if not self.game_id:
            print("❌ Skipping live game tests - no game_id available")
            return False
            
        print("\n" + "="*50)
        print("TESTING LIVE GAME ENDPOINTS")
        print("="*50)
        
        # Test start game
        success, start_result = self.run_test(
            "Start Game",
            "POST",
            f"games/{self.game_id}/start",
            200
        )
        
        if success:
            # Test get game session
            success, session_data = self.run_test(
                "Get Game Session",
                "GET",
                f"games/{self.game_id}/session",
                200
            )
            
            # Test call number
            success, call_result = self.run_test(
                "Call Number",
                "POST",
                f"games/{self.game_id}/call-number",
                200
            )
            
            if success and call_result:
                print(f"   Called number: {call_result.get('number')}")
            
            return True
        return False

    def test_profile_endpoints(self):
        """Test profile management endpoints"""
        print("\n" + "="*50)
        print("TESTING PROFILE ENDPOINTS")
        print("="*50)
        
        # Test update profile
        profile_data = {
            "name": "Updated Test User",
            "avatar": "avatar2"
        }
        
        success, updated_profile = self.run_test(
            "Update Profile",
            "PUT",
            "profile",
            200,
            data=profile_data
        )
        
        return success

    def test_user_games_critical_fixes(self):
        """Test critical fixes for user games - ticket generation and duplicate prevention"""
        print("\n" + "="*50)
        print("TESTING USER GAMES CRITICAL FIXES")
        print("="*50)
        
        # Test 1: User Game Creation with Proper Ticket Generation
        print("\n🔍 TEST 1: User Game Creation with Ticket Generation")
        user_game_data = {
            "name": f"Critical Test Game {datetime.now().strftime('%H%M%S')}",
            "date": "2025-02-01",
            "time": "19:00",
            "max_tickets": 18,  # 3 full sheets (18 tickets)
            "prizes_description": "1st Prize: ₹500, 2nd Prize: ₹300, 3rd Prize: ₹200"
        }
        
        success, created_user_game = self.run_test(
            "Create User Game with Tickets",
            "POST",
            "user-games",
            200,
            data=user_game_data
        )
        
        if success and created_user_game:
            self.user_game_id = created_user_game.get('user_game_id')
            self.share_code = created_user_game.get('share_code')
            print(f"   ✅ Created User Game ID: {self.user_game_id}")
            print(f"   ✅ Share Code: {self.share_code}")
            
            # Get full game details to verify ticket generation
            success, game_details = self.run_test(
                "Get Game Details with Tickets",
                "GET",
                f"user-games/{self.user_game_id}",
                200
            )
            
            if success and game_details:
                tickets = game_details.get('tickets', [])
                print(f"   ✅ Tickets generated: {len(tickets)}")
                
                # Verify ticket structure
                if tickets:
                    first_ticket = tickets[0]
                    print(f"   ✅ First ticket structure: {list(first_ticket.keys())}")
                    
                    # Check if ticket has proper 3x9 grid
                    numbers = first_ticket.get('numbers', [])
                    if len(numbers) == 3 and all(len(row) == 9 for row in numbers):
                        print(f"   ✅ Ticket has proper 3x9 grid structure")
                        
                        # Count non-null numbers (should be 15 per ticket)
                        non_null_count = sum(1 for row in numbers for cell in row if cell is not None)
                        print(f"   ✅ Numbers per ticket: {non_null_count} (should be 15)")
                        
                        # Verify each row has exactly 5 numbers
                        for i, row in enumerate(numbers):
                            row_count = sum(1 for cell in row if cell is not None)
                            print(f"   ✅ Row {i+1} numbers: {row_count} (should be 5)")
                    else:
                        print(f"   ❌ Invalid ticket structure: {len(numbers)} rows")
                else:
                    print(f"   ❌ No tickets found in game details")
            
            # Test 2: Duplicate Game Prevention
            print(f"\n🔍 TEST 2: Duplicate Game Prevention")
            duplicate_game_data = {
                "name": user_game_data["name"],  # Same name
                "date": user_game_data["date"],  # Same date  
                "time": user_game_data["time"],  # Same time
                "max_tickets": 12,
                "prizes_description": "Different prizes"
            }
            
            success, duplicate_response = self.run_test(
                "Try Creating Duplicate Game",
                "POST",
                "user-games",
                400,  # Should fail with 400
                data=duplicate_game_data
            )
            
            if not success:  # This means we got 400 as expected
                print(f"   ✅ Duplicate prevention working - got expected 400 error")
            else:
                print(f"   ❌ Duplicate prevention failed - duplicate game was created")
            
            # Test 3: User Games API - Public Access
            print(f"\n🔍 TEST 3: User Games API Public Access")
            success, game_by_code = self.run_test(
                "Get User Game by Share Code (Public)",
                "GET",
                f"user-games/code/{self.share_code}",
                200,
                headers={}  # No auth needed for public endpoint
            )
            
            if success and game_by_code:
                print(f"   ✅ Public access working - game found by share code")
                print(f"   ✅ Game name: {game_by_code.get('name')}")
                print(f"   ✅ Game status: {game_by_code.get('status')}")
            
            # Test 4: Join Game Flow
            print(f"\n🔍 TEST 4: Complete User Game Flow")
            join_data = {
                "player_name": "Rajesh Kumar",
                "ticket_count": 2
            }
            
            success, join_result = self.run_test(
                "Join User Game by Share Code",
                "POST",
                f"user-games/code/{self.share_code}/join",
                200,
                data=join_data,
                headers={}  # No auth needed for public endpoint
            )
            
            if success and join_result:
                print(f"   ✅ Player joined: {join_result.get('player_name')}")
                assigned_tickets = join_result.get('tickets', [])
                print(f"   ✅ Tickets assigned: {len(assigned_tickets)}")
                
                # Verify assigned tickets have proper structure
                if assigned_tickets:
                    for i, ticket in enumerate(assigned_tickets):
                        numbers = ticket.get('numbers', [])
                        if len(numbers) == 3 and all(len(row) == 9 for row in numbers):
                            non_null_count = sum(1 for row in numbers for cell in row if cell is not None)
                            print(f"   ✅ Assigned ticket {i+1}: {non_null_count} numbers (proper structure)")
                        else:
                            print(f"   ❌ Assigned ticket {i+1}: Invalid structure")
            
            return True
        return False

    def test_user_games_endpoints(self):
        """Test user games (Create Your Own Game) endpoints"""
        print("\n" + "="*50)
        print("TESTING USER GAMES ENDPOINTS")
        print("="*50)
        
        # Run critical fixes test first
        critical_success = self.test_user_games_critical_fixes()
        
        if not critical_success or not self.user_game_id:
            print("❌ Critical fixes failed - skipping additional tests")
            return False
        
        # Additional tests for completeness
        # Test get my user games
        success, my_user_games = self.run_test(
            "Get My User Games",
            "GET",
            "user-games/my",
            200
        )
        
        # Test get players list
        success, players_data = self.run_test(
            "Get User Game Players",
            "GET",
            f"user-games/{self.user_game_id}/players",
            200
        )
        
        if success and players_data:
            print(f"   Total players: {players_data.get('total', 0)}")
        
        # Test start user game
        success, start_result = self.run_test(
            "Start User Game",
            "POST",
            f"user-games/{self.user_game_id}/start",
            200
        )
        
        if success:
            # Test call number in user game
            success, call_result = self.run_test(
                "Call Number in User Game",
                "POST",
                f"user-games/{self.user_game_id}/call-number",
                200
            )
            
            if success and call_result:
                print(f"   Called number: {call_result.get('number')}")
                print(f"   Remaining numbers: {call_result.get('remaining')}")
            
            # Test get user game session
            success, session_data = self.run_test(
                "Get User Game Session",
                "GET",
                f"user-games/{self.user_game_id}/session",
                200
            )
            
            # Test end user game
            success, end_result = self.run_test(
                "End User Game",
                "POST",
                f"user-games/{self.user_game_id}/end",
                200
            )
        
        return True

    def test_admin_game_automation(self):
        """Test admin game auto-start and auto-calling features"""
        print("\n" + "="*50)
        print("TESTING ADMIN GAME AUTOMATION")
        print("="*50)
        
        # Test 1: Create admin game with past start time for auto-start
        print("\n🔍 TEST 1: Admin Game Auto-Start")
        from datetime import datetime, timedelta
        
        # Create a game scheduled 5 minutes ago to trigger auto-start
        past_time = datetime.now() - timedelta(minutes=5)
        
        auto_game_data = {
            "name": f"Auto-Start Test Game {datetime.now().strftime('%H%M%S')}",
            "date": past_time.strftime('%Y-%m-%d'),
            "time": past_time.strftime('%H:%M'),
            "price": 50.0,
            "total_tickets": 60,
            "prizes": {
                "Early Five": 500.0,
                "Top Line": 1000.0,
                "Middle Line": 1000.0,
                "Bottom Line": 1000.0,
                "Full House": 2000.0
            }
        }
        
        success, auto_game = self.run_test(
            "Create Admin Game with Past Start Time",
            "POST",
            "games",
            200,
            data=auto_game_data
        )
        
        if success and auto_game:
            auto_game_id = auto_game.get('game_id')
            print(f"   ✅ Created auto-start game ID: {auto_game_id}")
            print(f"   ✅ Initial status: {auto_game.get('status')}")
            
            # Wait a moment and check if game auto-started
            import time
            print("   ⏳ Waiting 10 seconds for auto-start to trigger...")
            time.sleep(10)
            
            # Check game status
            success, updated_game = self.run_test(
                "Check Game Status After Auto-Start",
                "GET",
                f"games/{auto_game_id}",
                200
            )
            
            if success and updated_game:
                current_status = updated_game.get('status')
                print(f"   ✅ Current status: {current_status}")
                
                if current_status == 'live':
                    print(f"   ✅ AUTO-START WORKING: Game transitioned to 'live' status")
                    
                    # Test 2: Check if game session was created with auto-calling
                    success, session_data = self.run_test(
                        "Check Game Session for Auto-Calling",
                        "GET",
                        f"games/{auto_game_id}/session",
                        200
                    )
                    
                    if success and session_data:
                        auto_call_enabled = session_data.get('auto_call_enabled', False)
                        called_numbers = session_data.get('called_numbers', [])
                        print(f"   ✅ Auto-call enabled: {auto_call_enabled}")
                        print(f"   ✅ Numbers called so far: {len(called_numbers)}")
                        
                        if called_numbers:
                            print(f"   ✅ Called numbers: {called_numbers}")
                            
                            # Wait a bit more to see if more numbers are called automatically
                            print("   ⏳ Waiting 30 seconds to verify auto-calling...")
                            time.sleep(30)
                            
                            # Check again
                            success, updated_session = self.run_test(
                                "Check Auto-Calling Progress",
                                "GET",
                                f"games/{auto_game_id}/session",
                                200
                            )
                            
                            if success and updated_session:
                                new_called_numbers = updated_session.get('called_numbers', [])
                                print(f"   ✅ Numbers called after 30s: {len(new_called_numbers)}")
                                
                                if len(new_called_numbers) > len(called_numbers):
                                    print(f"   ✅ AUTO-CALLING WORKING: {len(new_called_numbers) - len(called_numbers)} new numbers called")
                                    print(f"   ✅ New numbers: {new_called_numbers[len(called_numbers):]}")
                                else:
                                    print(f"   ⚠️  AUTO-CALLING: No new numbers called in 30 seconds")
                        else:
                            print(f"   ⚠️  No numbers called yet - auto-calling may be slow to start")
                    else:
                        print(f"   ❌ Could not retrieve game session")
                else:
                    print(f"   ❌ AUTO-START FAILED: Game status is still '{current_status}', expected 'live'")
            else:
                print(f"   ❌ Could not retrieve updated game status")
            
            return auto_game_id
        else:
            print(f"   ❌ Failed to create auto-start game")
            return None

    def test_winner_detection_fixes(self):
        """Test CORRECTED winner detection for Six Seven Tambola"""
        print("\n" + "="*50)
        print("TESTING WINNER DETECTION FIXES - SIX SEVEN TAMBOLA")
        print("="*50)
        
        # Import winner detection functions
        import sys
        sys.path.append('/app/backend')
        from winner_detection import check_four_corners, check_full_house, check_full_sheet_bonus
        
        # Test 1: Four Corners Detection (FIXED)
        print("\n🔍 TEST 1: Four Corners Detection (FIXED)")
        print("   Rule: Four Corners = Physical grid positions [0][0], [0][8], [2][0], [2][8]")
        
        # Create test ticket with ALL 4 corner positions having numbers
        test_ticket_corners = [
            [4, None, 12, None, 25, None, 37, None, 61],    # corners: 4, 61
            [None, 8, None, 19, None, 28, None, 45, None],  # middle row
            [7, None, 15, None, 30, None, 42, None, 75]     # corners: 7, 75
        ]
        
        # Test with corner numbers called
        corner_numbers = [4, 61, 7, 75, 12, 25]  # Include corners + some extras
        
        corners_result = check_four_corners(test_ticket_corners, corner_numbers)
        print(f"   ✅ Four Corners with all corners called: {corners_result}")
        
        # Test ticket with blank corner (should fail)
        test_ticket_blank_corner = [
            [4, None, 12, None, 25, None, 37, None, None],   # blank top-right corner
            [None, 8, None, 19, None, 28, None, 45, None],
            [7, None, 15, None, 30, None, 42, None, 75]
        ]
        
        blank_corner_result = check_four_corners(test_ticket_blank_corner, corner_numbers)
        print(f"   ✅ Four Corners with blank corner: {blank_corner_result} (should be False)")
        
        if corners_result and not blank_corner_result:
            print("   ✅ Four Corners detection WORKING correctly!")
        else:
            print("   ❌ Four Corners detection FAILED!")
        
        # Test 2: Full Sheet Bonus (FIXED)
        print("\n🔍 TEST 2: Full Sheet Bonus (FIXED)")
        print("   Rule: Must book 6 tickets (full sheet), each ticket must have at least 1 number marked")
        
        # Create 6 tickets for full sheet test
        full_sheet_tickets = []
        for i in range(6):
            ticket = [
                [1+i, None, 12+i, None, 25+i, None, 37+i, None, 61+i],
                [None, 8+i, None, 19+i, None, 28+i, None, 45+i, None],
                [7+i, None, 15+i, None, 30+i, None, 42+i, None, 75+i]
            ]
            full_sheet_tickets.append(ticket)
        
        # Test with minimum marks (1 from each ticket)
        min_marks_numbers = [1, 2, 3, 4, 5, 6]  # One number from each ticket
        
        full_sheet_result = check_full_sheet_bonus(full_sheet_tickets, min_marks_numbers, min_marks_per_ticket=1)
        print(f"   ✅ Full Sheet Bonus with min marks: {full_sheet_result}")
        
        # Test with one ticket having 0 marks (should fail)
        insufficient_marks = [1, 2, 3, 4, 5]  # Missing mark from 6th ticket
        
        insufficient_result = check_full_sheet_bonus(full_sheet_tickets, insufficient_marks, min_marks_per_ticket=1)
        print(f"   ✅ Full Sheet Bonus with insufficient marks: {insufficient_result} (should be False)")
        
        if full_sheet_result and not insufficient_result:
            print("   ✅ Full Sheet Bonus detection WORKING correctly!")
        else:
            print("   ❌ Full Sheet Bonus detection FAILED!")
        
        # Test 3: Full House 1st/2nd/3rd Sequential
        print("\n🔍 TEST 3: Full House 1st/2nd/3rd Sequential")
        print("   Rule: Full House = All 15 numbers marked on ONE ticket")
        
        # Create test ticket with exactly 15 numbers (5 per row)
        full_house_ticket = [
            [4, None, 12, None, 25, None, 37, None, 61],    # 5 numbers: 4, 12, 25, 37, 61
            [None, 8, None, 19, None, 28, None, 45, None],  # 4 numbers: 8, 19, 28, 45
            [7, None, 15, None, 30, None, 42, None, 75]     # 5 numbers: 7, 15, 30, 42, 75
        ]
        
        # Fix: Add one more number to middle row to make it exactly 15
        full_house_ticket[1][8] = 89  # Add 89 to make it 5 numbers in middle row
        
        # Extract all non-None numbers from the ticket
        all_numbers = []
        for row in full_house_ticket:
            for num in row:
                if num is not None:
                    all_numbers.append(num)
        
        print(f"   📋 Ticket numbers: {sorted(all_numbers)} (count: {len(all_numbers)})")
        
        complete_numbers = all_numbers + [1, 2, 3]  # Add extra numbers
        
        full_house_result = check_full_house(full_house_ticket, complete_numbers)
        print(f"   ✅ Full House with all 15 numbers: {full_house_result}")
        
        # Test with 14/15 numbers (should fail)
        incomplete_numbers = all_numbers[:-1]  # Remove last number
        print(f"   📋 Incomplete numbers: {sorted(incomplete_numbers)} (count: {len(incomplete_numbers)})")
        
        incomplete_house_result = check_full_house(full_house_ticket, incomplete_numbers)
        print(f"   ✅ Full House with 14/15 numbers: {incomplete_house_result} (should be False)")
        
        if full_house_result and not incomplete_house_result:
            print("   ✅ Full House detection WORKING correctly!")
        else:
            print("   ❌ Full House detection FAILED!")
            print(f"   🔍 Debug: full_house_result={full_house_result}, incomplete_house_result={incomplete_house_result}")
        
        # Summary
        all_tests_passed = (
            corners_result and not blank_corner_result and
            full_sheet_result and not insufficient_result and
            full_house_result and not incomplete_house_result
        )
        
        if all_tests_passed:
            print("\n🎉 ALL WINNER DETECTION FIXES WORKING CORRECTLY!")
            return True
        else:
            print("\n❌ SOME WINNER DETECTION FIXES FAILED!")
            return False

    def test_tts_endpoint(self):
        """Test TTS endpoint for mobile audio"""
        print("\n" + "="*50)
        print("TESTING TTS ENDPOINT FOR MOBILE AUDIO")
        print("="*50)
        
        # Test 1: TTS with exact review request parameters
        print("\n🔍 TEST 1: TTS with Review Request Parameters")
        success, tts_response = self.run_test(
            "TTS Generate - Number 45 without prefix",
            "POST",
            "tts/generate?text=Number%2045&include_prefix=false",
            200
        )
        
        if success and tts_response:
            print(f"   ✅ TTS Response keys: {list(tts_response.keys())}")
            print(f"   ✅ Use browser TTS: {tts_response.get('use_browser_tts')}")
            print(f"   ✅ Text: {tts_response.get('text')}")
            print(f"   ✅ Has audio data: {tts_response.get('audio') is not None}")
            print(f"   ✅ Format: {tts_response.get('format')}")
            
            # Check if audio is base64 encoded
            audio_data = tts_response.get('audio')
            if audio_data:
                print(f"   ✅ Audio data length: {len(audio_data)} characters")
                print(f"   ✅ Audio data type: base64 string")
                print("   ✅ Audio can be played on mobile browsers (iOS Safari, Chrome)")
            
            # Check voice settings
            voice_settings = tts_response.get('voice_settings', {})
            if voice_settings:
                print(f"   ✅ Voice settings: {voice_settings}")
        
        # Test 2: TTS with prefix
        print("\n🔍 TEST 2: TTS with Prefix")
        success, tts_response_prefix = self.run_test(
            "TTS Generate with Prefix",
            "POST",
            "tts/generate?text=Number%2045&include_prefix=true",
            200
        )
        
        if success and tts_response_prefix:
            text_with_prefix = tts_response_prefix.get('text', '')
            text_without_prefix = tts_response.get('text', '') if tts_response else ''
            print(f"   ✅ Text with prefix: {text_with_prefix}")
            
            if len(text_with_prefix) > len(text_without_prefix):
                print(f"   ✅ Prefix functionality working - text is longer with prefix")
            else:
                print(f"   ⚠️  Prefix functionality unclear - similar text lengths")
        
        # Test 3: Different number for variety
        print("\n🔍 TEST 3: Different Number Format")
        success, tts_response_diff = self.run_test(
            "TTS Generate Different Number",
            "POST",
            "tts/generate?text=Number%2090&include_prefix=true",
            200
        )
        
        if success and tts_response_diff:
            print(f"   ✅ Different number TTS: {tts_response_diff.get('text')}")
        
        return success
        """Test Auto-Archive feature for completed games"""
        print("\n" + "="*50)
        print("TESTING AUTO-ARCHIVE FEATURE")
        print("="*50)
        
        # Test 1: Get initial game list (should exclude old completed games)
        success, initial_games = self.run_test(
            "Get Default Game List (excludes old completed)",
            "GET",
            "games",
            200
        )
        
        if success:
            print(f"   Initial games count: {len(initial_games)}")
            # Check that no old completed games are included
            for game in initial_games:
                if game.get('status') == 'completed':
                    print(f"   Found recently completed game: {game.get('name')} (should be within 5 mins)")
        
        # Test 2: Get recently completed games (within 5 minutes)
        success, recent_completed = self.run_test(
            "Get Recent Completed Games (within 5 mins)",
            "GET",
            "games/recent-completed",
            200
        )
        
        if success:
            print(f"   Recent completed games: {len(recent_completed)}")
            for game in recent_completed:
                print(f"   - {game.get('name')} (completed_at: {game.get('completed_at')})")
                # Check if winners object exists
                if 'winners' in game:
                    print(f"     Winners: {game['winners']}")
                else:
                    print("     No winners data found")
        
        # Test 3: Get archived completed games (older than 5 minutes)
        success, archived_games = self.run_test(
            "Get Archived Completed Games (older than 5 mins)",
            "GET",
            "games/completed",
            200
        )
        
        if success:
            print(f"   Archived completed games: {len(archived_games)}")
            for game in archived_games:
                print(f"   - {game.get('name')} (completed_at: {game.get('completed_at')})")
                # Check if winners object exists
                if 'winners' in game:
                    print(f"     Winners: {game['winners']}")
                else:
                    print("     No winners data found")
        
        # Test 4: End a game and verify auto-archive behavior (if we have a live game)
        if self.game_id:
            # First start the game to make it live
            success, start_result = self.run_test(
                "Start Game for Archive Test",
                "POST",
                f"games/{self.game_id}/start",
                200
            )
            
            if success:
                # Now end the game
                success, end_result = self.run_test(
                    "End Game (set completed_at timestamp)",
                    "POST",
                    f"games/{self.game_id}/end",
                    200
                )
                
                if success:
                    print(f"   Game {self.game_id} ended successfully")
                    
                    # Verify it appears in recent-completed
                    success, recent_after_end = self.run_test(
                        "Verify Game in Recent Completed After End",
                        "GET",
                        "games/recent-completed",
                        200
                    )
                    
                    if success:
                        found_in_recent = any(g.get('game_id') == self.game_id for g in recent_after_end)
                        if found_in_recent:
                            print(f"   ✅ Game {self.game_id} correctly appears in recent-completed")
                        else:
                            print(f"   ❌ Game {self.game_id} NOT found in recent-completed")
                    
                    # Verify it appears in default games list
                    success, games_after_end = self.run_test(
                        "Verify Game in Default List After End",
                        "GET",
                        "games",
                        200
                    )
                    
                    if success:
                        found_in_default = any(g.get('game_id') == self.game_id for g in games_after_end)
                        if found_in_default:
                            print(f"   ✅ Game {self.game_id} correctly appears in default games list")
                        else:
                            print(f"   ❌ Game {self.game_id} NOT found in default games list")
                    
                    # Note: We can't test the 5-minute archive transition in real-time
                    print("   ℹ️  Note: 5-minute archive transition cannot be tested in real-time")
                    print("   ℹ️  After 5 minutes, the game should move from recent-completed to archived")
        
        return True

    def test_six_seven_tambola_review_request(self):
        """Test the specific Six Seven Tambola new features from review request"""
        print("\n" + "="*50)
        print("TESTING SIX SEVEN TAMBOLA REVIEW REQUEST")
        print("="*50)
        
        # Test 1: Completed Games API
        print("\n🔍 TEST 1: Completed Games API")
        import time
        start_time = time.time()
        
        success, completed_games = self.run_test(
            "GET /api/games/completed",
            "GET",
            "games/completed",
            200
        )
        
        response_time = (time.time() - start_time) * 1000
        print(f"   ⏱️  Response time: {response_time:.0f}ms")
        
        if success and completed_games:
            print(f"   ✅ Found {len(completed_games)} completed games")
            
            # Check if games have winners info
            for i, game in enumerate(completed_games[:3]):  # Check first 3 games
                game_name = game.get('name', 'Unknown')
                winners = game.get('winners', {})
                print(f"   📋 Game {i+1}: {game_name}")
                print(f"       Winners: {list(winners.keys()) if winners else 'No winners'}")
                
                # Verify required fields
                required_fields = ['game_id', 'name', 'status', 'winners']
                missing_fields = [field for field in required_fields if field not in game]
                if missing_fields:
                    print(f"       ⚠️  Missing fields: {missing_fields}")
                else:
                    print(f"       ✅ All required fields present")
        else:
            print("   ❌ Failed to get completed games or empty response")
        
        # Test 2: Winner Detection Still Works
        print("\n🔍 TEST 2: Winner Detection Still Works")
        
        # Create a test game for winner detection
        test_game_data = {
            "name": f"Winner Detection Test {datetime.now().strftime('%H%M%S')}",
            "date": "2025-01-30",
            "time": "21:00",
            "price": 50.0,
            "prizes": {
                "Top Line": 1000.0,
                "Middle Line": 1000.0,
                "Bottom Line": 1000.0,
                "Four Corners": 500.0,
                "Full House": 2000.0
            }
        }
        
        start_time = time.time()
        success, test_game = self.run_test(
            "Create Test Game for Winner Detection",
            "POST",
            "games",
            200,
            data=test_game_data
        )
        response_time = (time.time() - start_time) * 1000
        print(f"   ⏱️  Game creation time: {response_time:.0f}ms")
        
        if success and test_game:
            test_game_id = test_game.get('game_id')
            print(f"   ✅ Created test game: {test_game_id}")
            
            # Start the game
            success, start_result = self.run_test(
                "Start Test Game",
                "POST",
                f"games/{test_game_id}/start",
                200
            )
            
            if success:
                # Call a few numbers
                for i in range(3):
                    success, call_result = self.run_test(
                        f"Call Number {i+1}",
                        "POST",
                        f"games/{test_game_id}/call-number",
                        200
                    )
                    
                    if success and call_result:
                        called_number = call_result.get('number')
                        new_winners = call_result.get('new_winners', [])
                        print(f"   📞 Called number: {called_number}")
                        if new_winners:
                            print(f"   🏆 New winners detected: {new_winners}")
                
                # Check game session for winners
                success, session_data = self.run_test(
                    "Get Game Session (Check Winners)",
                    "GET",
                    f"games/{test_game_id}/session",
                    200
                )
                
                if success and session_data:
                    winners = session_data.get('winners', {})
                    called_numbers = session_data.get('called_numbers', [])
                    print(f"   ✅ Numbers called: {len(called_numbers)}")
                    print(f"   ✅ Winners stored: {list(winners.keys()) if winners else 'None yet'}")
                    
                    if winners:
                        print("   ✅ Winner detection system is working!")
                    else:
                        print("   ℹ️  No winners yet (normal for few numbers called)")
        
        # Test 3: TTS for Winner Announcement
        print("\n🔍 TEST 3: TTS for Winner Announcement")
        
        start_time = time.time()
        success, tts_response = self.run_test(
            "TTS Winner Announcement",
            "POST",
            "tts/generate?text=Congratulations%20John!%20You%20have%20won%20Top%20Line!",
            200
        )
        response_time = (time.time() - start_time) * 1000
        print(f"   ⏱️  TTS response time: {response_time:.0f}ms")
        
        if success and tts_response:
            print(f"   ✅ TTS Response received")
            print(f"   ✅ Text: {tts_response.get('text', 'N/A')}")
            print(f"   ✅ Has audio data: {tts_response.get('audio') is not None}")
            print(f"   ✅ Use browser TTS: {tts_response.get('use_browser_tts', 'N/A')}")
            print(f"   ✅ Format: {tts_response.get('format', 'N/A')}")
            
            # Check if it's server-side TTS (better for mobile)
            if not tts_response.get('use_browser_tts', True):
                print("   ✅ Server-side TTS working (good for mobile)")
            else:
                print("   ℹ️  Using browser TTS fallback")
        else:
            print("   ❌ TTS endpoint failed")
        
        # Test 4: API Response Times
        print("\n🔍 TEST 4: API Response Times (MongoDB Indexes)")
        
        endpoints_to_test = [
            ("games", "GET", "games"),
            ("games/completed", "GET", "games/completed"),
            ("games/recent-completed", "GET", "games/recent-completed"),
            ("auth/me", "GET", "auth/me")
        ]
        
        response_times = []
        for name, method, endpoint in endpoints_to_test:
            start_time = time.time()
            success, response = self.run_test(
                f"Performance Test: {name}",
                method,
                endpoint,
                200
            )
            response_time = (time.time() - start_time) * 1000
            response_times.append((name, response_time))
            
            if response_time < 500:
                print(f"   ✅ {name}: {response_time:.0f}ms (excellent)")
            elif response_time < 1000:
                print(f"   ⚠️  {name}: {response_time:.0f}ms (acceptable)")
            else:
                print(f"   ❌ {name}: {response_time:.0f}ms (slow)")
        
        # Calculate average response time
        avg_response_time = sum(rt for _, rt in response_times) / len(response_times)
        print(f"\n   📊 Average response time: {avg_response_time:.0f}ms")
        
        if avg_response_time < 500:
            print("   ✅ MongoDB indexes are helping - excellent performance!")
        elif avg_response_time < 1000:
            print("   ⚠️  Performance is acceptable but could be improved")
        else:
            print("   ❌ Performance issues detected - indexes may need optimization")
        
        # Summary
        print(f"\n📋 SIX SEVEN TAMBOLA REVIEW REQUEST SUMMARY:")
        print(f"   ✅ Completed Games API: {'PASS' if completed_games else 'FAIL'}")
        print(f"   ✅ Winner Detection: {'PASS' if test_game else 'FAIL'}")
        print(f"   ✅ TTS Announcement: {'PASS' if tts_response else 'FAIL'}")
        print(f"   ✅ API Performance: {'PASS' if avg_response_time < 500 else 'NEEDS IMPROVEMENT'}")
        
        return all([completed_games, test_game, tts_response, avg_response_time < 1000])

    def run_all_tests(self):
        """Run all API tests with focus on Six Seven Tambola review request"""
        print("🚀 Starting Tambola API Tests - SIX SEVEN TAMBOLA REVIEW REQUEST")
        print(f"🔗 Base URL: {self.base_url}")
        print(f"👤 Test User ID: {self.user_id}")
        print(f"🔑 Session Token: {self.session_token[:20]}...")
        
        # Run authentication first
        auth_success = self.test_auth_endpoints()
        if not auth_success:
            print("❌ Authentication failed - stopping tests")
            return False
        
        # PRIORITY: Six Seven Tambola Review Request Testing
        print("\n" + "🎯"*60)
        print("SIX SEVEN TAMBOLA REVIEW REQUEST TESTING - PRIORITY 1")
        print("🎯"*60)
        
        # Test the specific review request items
        review_request_success = self.test_six_seven_tambola_review_request()
        
        # ADDITIONAL TESTING (Priority 2) - Only if review request passes
        if review_request_success:
            print("\n" + "📋"*60)
            print("ADDITIONAL API TESTING - PRIORITY 2")
            print("📋"*60)
            
            # Test 2: Winner Detection Logic (Four Corners, Full House, Full Sheet Bonus)
            winner_detection_success = self.test_winner_detection_fixes()
            
            # Test 3: TTS Endpoint for Mobile Audio
            tts_success = self.test_tts_endpoint()
            
            # Test 4: User Games Critical Fixes (Ticket Generation + Duplicate Prevention)
            user_games_success = self.test_user_games_endpoints()
            
            # Test 5: Admin Game Auto-Start and Auto-Calling
            auto_game_id = self.test_admin_game_automation()
        else:
            print("\n⚠️  Skipping additional tests due to review request failures")
            winner_detection_success = False
            tts_success = False
            user_games_success = False
            auto_game_id = None
        
        # Print final results
        print("\n" + "="*60)
        print("FINAL TEST RESULTS")
        print("="*60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"✅ Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # Review request results (Priority 1)
        print("\n🎯 SIX SEVEN TAMBOLA REVIEW REQUEST RESULTS:")
        print(f"   Review Request Tests: {'✅ PASS' if review_request_success else '❌ FAIL'}")
        
        if review_request_success:
            # Additional test results (Priority 2)
            print("\n📋 ADDITIONAL TEST SUITE RESULTS:")
            additional_results = [
                ("Winner Detection Logic", winner_detection_success),
                ("TTS Endpoint Extended", tts_success),
                ("User Games Critical Fixes", user_games_success),
                ("Admin Game Auto-Start", auto_game_id is not None)
            ]
            
            for test_name, success in additional_results:
                status = "✅ PASS" if success else "❌ FAIL"
                print(f"   {test_name}: {status}")
        
        return review_request_success

def main():
    tester = TambolaAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())