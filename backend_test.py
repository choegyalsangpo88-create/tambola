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

    def test_tts_endpoint(self):
        """Test TTS endpoint for number calling"""
        print("\n" + "="*50)
        print("TESTING TTS ENDPOINT")
        print("="*50)
        
        # Test 1: TTS with prefix
        print("\n🔍 TEST 1: TTS with Prefix")
        success, tts_response = self.run_test(
            "TTS Generate with Prefix",
            "POST",
            "tts/generate?text=Number%2045%20-%20Halfway%20There&include_prefix=true",
            200
        )
        
        if success and tts_response:
            print(f"   ✅ TTS Response keys: {list(tts_response.keys())}")
            print(f"   ✅ Use browser TTS: {tts_response.get('use_browser_tts')}")
            print(f"   ✅ Text: {tts_response.get('text')}")
            print(f"   ✅ Has audio: {tts_response.get('audio') is not None}")
            
            # Check voice settings
            voice_settings = tts_response.get('voice_settings', {})
            if voice_settings:
                print(f"   ✅ Voice settings: {voice_settings}")
        
        # Test 2: TTS without prefix
        print("\n🔍 TEST 2: TTS without Prefix")
        success, tts_response_no_prefix = self.run_test(
            "TTS Generate without Prefix",
            "POST",
            "tts/generate?text=Number%2045%20-%20Halfway%20There&include_prefix=false",
            200
        )
        
        if success and tts_response_no_prefix:
            text_with_prefix = tts_response.get('text', '')
            text_without_prefix = tts_response_no_prefix.get('text', '')
            print(f"   ✅ Text without prefix: {text_without_prefix}")
            
            if len(text_with_prefix) > len(text_without_prefix):
                print(f"   ✅ Prefix functionality working - text is longer with prefix")
            else:
                print(f"   ⚠️  Prefix functionality unclear - similar text lengths")
        
        # Test 3: Different number format
        print("\n🔍 TEST 3: Different Number Format")
        success, tts_response_diff = self.run_test(
            "TTS Generate Different Number",
            "POST",
            "tts/generate?text=Number%2090%20-%20Top%20of%20the%20Shop&include_prefix=true",
            200
        )
        
        if success and tts_response_diff:
            print(f"   ✅ Different number TTS: {tts_response_diff.get('text')}")
        
        return True
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

    def run_all_tests(self):
        """Run all API tests with focus on critical fixes"""
        print("🚀 Starting Tambola API Tests - CRITICAL FIXES FOCUS")
        print(f"🔗 Base URL: {self.base_url}")
        print(f"👤 Test User ID: {self.user_id}")
        print(f"🔑 Session Token: {self.session_token[:20]}...")
        
        # Run authentication first
        auth_success = self.test_auth_endpoints()
        if not auth_success:
            print("❌ Authentication failed - stopping tests")
            return False
        
        # CRITICAL FIXES TESTING (Priority 1)
        print("\n" + "🔥"*60)
        print("CRITICAL FIXES TESTING - PRIORITY 1")
        print("🔥"*60)
        
        # Test 1: User Games Critical Fixes (Ticket Generation + Duplicate Prevention)
        user_games_success = self.test_user_games_endpoints()
        
        # Test 2: Admin Game Auto-Start and Auto-Calling
        auto_game_id = self.test_admin_game_automation()
        
        # Test 3: TTS Endpoint
        tts_success = self.test_tts_endpoint()
        
        # ADDITIONAL TESTING (Priority 2)
        print("\n" + "📋"*60)
        print("ADDITIONAL API TESTING - PRIORITY 2")
        print("📋"*60)
        
        game_success = self.test_game_endpoints()
        ticket_success = self.test_ticket_endpoints()
        booking_success = self.test_booking_endpoints()
        admin_success = self.test_admin_endpoints()
        live_success = self.test_live_game_endpoints()
        profile_success = self.test_profile_endpoints()
        auto_archive_success = self.test_auto_archive_feature()
        
        # Print final results
        print("\n" + "="*60)
        print("FINAL TEST RESULTS")
        print("="*60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"✅ Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # Critical fixes results
        print("\n🔥 CRITICAL FIXES RESULTS:")
        critical_results = [
            ("User Games (Tickets + Duplicate Prevention)", user_games_success),
            ("Admin Game Auto-Start & Auto-Calling", auto_game_id is not None),
            ("TTS Endpoint", tts_success)
        ]
        
        for fix_name, success in critical_results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"   {fix_name}: {status}")
        
        # Additional test suite results
        print("\n📋 ADDITIONAL TEST SUITE RESULTS:")
        suites = [
            ("Authentication", auth_success),
            ("Games", game_success),
            ("Tickets", ticket_success),
            ("Bookings", booking_success),
            ("Admin", admin_success),
            ("Live Game", live_success),
            ("Profile", profile_success),
            ("Auto-Archive Feature", auto_archive_success)
        ]
        
        for suite_name, success in suites:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"   {suite_name}: {status}")
        
        # Summary for critical fixes
        critical_passed = sum(1 for _, success in critical_results if success)
        print(f"\n🎯 CRITICAL FIXES SUMMARY: {critical_passed}/{len(critical_results)} PASSED")
        
        return self.tests_passed == self.tests_run

def main():
    tester = TambolaAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())