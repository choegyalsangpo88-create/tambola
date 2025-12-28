import requests
import sys
import json
from datetime import datetime

class TambolaAPITester:
    def __init__(self, base_url="https://lucky-numbers-214.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = "lYnA2pHIaXdsZ_NSn4jX6i0MjmwN-Fgz3JFKe9y_ZPI"  # Valid session from DB
        self.user_id = "user_b4186fef9da4"
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

    def test_user_games_endpoints(self):
        """Test user games (Create Your Own Game) endpoints"""
        print("\n" + "="*50)
        print("TESTING USER GAMES ENDPOINTS")
        print("="*50)
        
        # Test create user game
        user_game_data = {
            "name": f"Family Game {datetime.now().strftime('%H%M%S')}",
            "date": "2025-02-01",
            "time": "19:00",
            "max_tickets": 30,
            "prizes_description": "1st Prize: ₹500, 2nd Prize: ₹300, 3rd Prize: ₹200"
        }
        
        success, created_user_game = self.run_test(
            "Create User Game",
            "POST",
            "user-games",
            200,
            data=user_game_data
        )
        
        if success and created_user_game:
            self.user_game_id = created_user_game.get('user_game_id')
            self.share_code = created_user_game.get('share_code')
            print(f"   Created User Game ID: {self.user_game_id}")
            print(f"   Share Code: {self.share_code}")
            
            # Test get my user games
            success, my_user_games = self.run_test(
                "Get My User Games",
                "GET",
                "user-games/my",
                200
            )
            
            # Test get user game by ID
            success, user_game_details = self.run_test(
                "Get User Game Details",
                "GET",
                f"user-games/{self.user_game_id}",
                200
            )
            
            # Test get user game by share code (public)
            success, game_by_code = self.run_test(
                "Get User Game by Share Code",
                "GET",
                f"user-games/code/{self.share_code}",
                200,
                headers={}  # No auth needed for public endpoint
            )
            
            # Test join game by share code (public)
            join_data = {
                "player_name": "Test Player",
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
                print(f"   Player joined: {join_result.get('player_name')}")
                print(f"   Tickets assigned: {len(join_result.get('tickets', []))}")
            
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
        return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Tambola API Tests")
        print(f"🔗 Base URL: {self.base_url}")
        print(f"👤 Test User ID: {self.user_id}")
        print(f"🔑 Session Token: {self.session_token[:20]}...")
        
        # Run test suites
        auth_success = self.test_auth_endpoints()
        if not auth_success:
            print("❌ Authentication failed - stopping tests")
            return False
            
        game_success = self.test_game_endpoints()
        ticket_success = self.test_ticket_endpoints()
        booking_success = self.test_booking_endpoints()
        admin_success = self.test_admin_endpoints()
        live_success = self.test_live_game_endpoints()
        profile_success = self.test_profile_endpoints()
        user_games_success = self.test_user_games_endpoints()
        
        # Print final results
        print("\n" + "="*60)
        print("FINAL TEST RESULTS")
        print("="*60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"✅ Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # Test suite results
        suites = [
            ("Authentication", auth_success),
            ("Games", game_success),
            ("Tickets", ticket_success),
            ("Bookings", booking_success),
            ("Admin", admin_success),
            ("Live Game", live_success),
            ("Profile", profile_success),
            ("User Games", user_games_success)
        ]
        
        print("\n📋 Test Suite Results:")
        for suite_name, success in suites:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"   {suite_name}: {status}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = TambolaAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())