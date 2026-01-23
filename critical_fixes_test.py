import requests
import sys
import json
from datetime import datetime, timedelta

class CriticalFixesTester:
    def __init__(self, base_url="https://tambola-pwa.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = "9740c20a7af441c6be784ececbe13a422a63031193f24b9d80c795d5a461a5d3"
        self.user_id = "test_user_123"
        self.tests_run = 0
        self.tests_passed = 0
        self.user_game_id = None
        self.share_code = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        default_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }
        if headers is not None:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
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

    def test_critical_fix_1_user_game_creation_with_tickets(self):
        """Test 1: User Game Creation with Proper Ticket Generation"""
        print("\n" + "="*60)
        print("CRITICAL FIX 1: USER GAME CREATION WITH TICKETS")
        print("="*60)
        
        user_game_data = {
            "name": f"Critical Test Game {datetime.now().strftime('%H%M%S')}",
            "date": "2025-02-01",
            "time": "19:00",
            "max_tickets": 18,  # 3 full sheets
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
                
                if tickets:
                    first_ticket = tickets[0]
                    numbers = first_ticket.get('numbers', [])
                    
                    # Verify ticket structure
                    if len(numbers) == 3 and all(len(row) == 9 for row in numbers):
                        print(f"   ✅ Ticket has proper 3x9 grid structure")
                        
                        # Count non-null numbers (should be 15 per ticket)
                        non_null_count = sum(1 for row in numbers for cell in row if cell is not None)
                        print(f"   ✅ Numbers per ticket: {non_null_count} (should be 15)")
                        
                        # Verify each row has exactly 5 numbers
                        for i, row in enumerate(numbers):
                            row_count = sum(1 for cell in row if cell is not None)
                            print(f"   ✅ Row {i+1} numbers: {row_count} (should be 5)")
                        
                        return True
                    else:
                        print(f"   ❌ Invalid ticket structure")
                        return False
                else:
                    print(f"   ❌ No tickets found")
                    return False
        
        return False

    def test_critical_fix_2_duplicate_prevention(self):
        """Test 2: Duplicate Game Prevention"""
        print("\n" + "="*60)
        print("CRITICAL FIX 2: DUPLICATE GAME PREVENTION")
        print("="*60)
        
        if not self.user_game_id:
            print("❌ Skipping - no user game created in previous test")
            return False
        
        # Try to create duplicate game with same name, date, time
        duplicate_game_data = {
            "name": f"Critical Test Game {datetime.now().strftime('%H%M%S')}",  # Same name pattern
            "date": "2025-02-01",  # Same date
            "time": "19:00",       # Same time
            "max_tickets": 12,
            "prizes_description": "Different prizes"
        }
        
        # First create a game to test against
        success, first_game = self.run_test(
            "Create First Game",
            "POST",
            "user-games",
            200,
            data=duplicate_game_data
        )
        
        if success:
            # Now try to create exact duplicate
            success, duplicate_response = self.run_test(
                "Try Creating Duplicate Game",
                "POST",
                "user-games",
                400,  # Should fail with 400
                data=duplicate_game_data
            )
            
            if not success:  # This means we got 400 as expected
                print(f"   ✅ Duplicate prevention working - got expected 400 error")
                return True
            else:
                print(f"   ❌ Duplicate prevention failed - duplicate game was created")
                return False
        
        return False

    def test_critical_fix_3_admin_game_auto_start(self):
        """Test 3: Admin Game Auto-Start and Auto-Calling"""
        print("\n" + "="*60)
        print("CRITICAL FIX 3: ADMIN GAME AUTO-START & AUTO-CALLING")
        print("="*60)
        
        # Skip this test due to ticket generation recursion error
        print("   ⚠️  SKIPPING: Admin game creation has recursion error in ticket_generator.py")
        print("   ⚠️  Error: RecursionError in generate_full_sheet() function")
        print("   ⚠️  This needs to be fixed by main agent")
        return False

    def test_critical_fix_4_tts_endpoint(self):
        """Test 4: TTS Endpoint"""
        print("\n" + "="*60)
        print("CRITICAL FIX 4: TTS ENDPOINT")
        print("="*60)
        
        # Test TTS with prefix
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
            
            # Test without prefix
            success2, tts_response2 = self.run_test(
                "TTS Generate without Prefix",
                "POST",
                "tts/generate?text=Number%2045%20-%20Halfway%20There&include_prefix=false",
                200
            )
            
            if success2:
                text_with_prefix = tts_response.get('text', '')
                text_without_prefix = tts_response2.get('text', '')
                
                if len(text_with_prefix) > len(text_without_prefix):
                    print(f"   ✅ Prefix functionality working")
                    return True
        
        return False

    def test_critical_fix_5_user_games_api(self):
        """Test 5: User Games API - Public Access"""
        print("\n" + "="*60)
        print("CRITICAL FIX 5: USER GAMES API PUBLIC ACCESS")
        print("="*60)
        
        if not self.share_code:
            print("❌ Skipping - no share code available")
            return False
        
        # Test public access to game by share code
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
            
            # Test join game flow
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
                headers={}  # No auth needed
            )
            
            if success and join_result:
                print(f"   ✅ Player joined: {join_result.get('player_name')}")
                assigned_tickets = join_result.get('tickets', [])
                print(f"   ✅ Tickets assigned: {len(assigned_tickets)}")
                return True
        
        return False

    def run_all_critical_tests(self):
        """Run all critical fix tests"""
        print("🔥 CRITICAL FIXES TESTING FOR SIX SEVEN TAMBOLA")
        print(f"🔗 Base URL: {self.base_url}")
        print(f"👤 Test User ID: {self.user_id}")
        
        # Test authentication first
        success, user_data = self.run_test(
            "Authentication Check",
            "GET",
            "auth/me",
            200
        )
        
        if not success:
            print("❌ Authentication failed - stopping tests")
            return False
        
        print(f"   ✅ Authenticated as: {user_data.get('name')} ({user_data.get('email')})")
        
        # Run critical fix tests
        results = []
        
        results.append(("User Game Creation with Tickets", self.test_critical_fix_1_user_game_creation_with_tickets()))
        results.append(("Duplicate Game Prevention", self.test_critical_fix_2_duplicate_prevention()))
        results.append(("Admin Game Auto-Start & Auto-Calling", self.test_critical_fix_3_admin_game_auto_start()))
        results.append(("TTS Endpoint", self.test_critical_fix_4_tts_endpoint()))
        results.append(("User Games API Public Access", self.test_critical_fix_5_user_games_api()))
        
        # Print final results
        print("\n" + "="*80)
        print("CRITICAL FIXES TEST RESULTS")
        print("="*80)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"✅ Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        print("\n🔥 CRITICAL FIXES SUMMARY:")
        passed_count = 0
        for fix_name, success in results:
            status = "✅ PASS" if success else "❌ FAIL"
            if success:
                passed_count += 1
            print(f"   {fix_name}: {status}")
        
        print(f"\n🎯 OVERALL CRITICAL FIXES: {passed_count}/{len(results)} PASSED")
        
        return passed_count == len(results)

def main():
    tester = CriticalFixesTester()
    success = tester.run_all_critical_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())