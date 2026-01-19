import requests
import sys
import json
from datetime import datetime

class FocusedAdminTest:
    def __init__(self, base_url="https://housie-game-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = "admin_session_1766786901455"  # Valid admin session
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if params:
            url += f"?{params}"
            
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }

        self.tests_run += 1
        print(f"\n🔍 {name}")
        print(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"   ✅ Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"   ❌ Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False, {}

    def test_review_requirements(self):
        """Test the specific requirements from the review request"""
        print("🚀 Testing Admin Panel Features from Review Request")
        print("="*60)
        
        # 1. Caller Voice Settings
        print("\n📢 CALLER VOICE SETTINGS:")
        
        success, settings = self.run_test(
            "GET caller settings (should return defaults)",
            "GET", "admin/caller-settings", 200
        )
        if success:
            print(f"   Voice: {settings.get('voice')}, Gender: {settings.get('gender')}, Speed: {settings.get('speed')}")
        
        success, updated = self.run_test(
            "PUT caller settings (gender: male, speed: 1.3)",
            "PUT", "admin/caller-settings", 200,
            data={"gender": "male", "speed": 1.3}
        )
        if success:
            print(f"   Updated - Voice: {updated.get('voice')}, Gender: {updated.get('gender')}, Speed: {updated.get('speed')}")
        
        success, _ = self.run_test(
            "POST add prefix line",
            "POST", "admin/caller-settings/prefix-lines", 200,
            params="line=Test%20line"
        )
        
        success, _ = self.run_test(
            "DELETE first prefix line",
            "DELETE", "admin/caller-settings/prefix-lines/0", 200
        )
        
        success, _ = self.run_test(
            "POST reset prefix lines",
            "POST", "admin/caller-settings/reset-prefix-lines", 200
        )
        
        # 2. Game Management
        print("\n🎮 GAME MANAGEMENT:")
        
        game_data = {
            "name": "Test Game",
            "date": "2025-01-15",
            "time": "20:00",
            "price": 50,
            "total_tickets": 12,
            "prizes": {"Top Line": 200}
        }
        
        success, game = self.run_test(
            "POST create game (auto-generate tickets)",
            "POST", "games", 200, data=game_data
        )
        
        game_id = None
        if success and game:
            game_id = game.get('game_id')
            print(f"   Game ID: {game_id}, Tickets: {game.get('ticket_count')}")
        
        if game_id:
            success, tickets = self.run_test(
                "GET game tickets",
                "GET", f"admin/games/{game_id}/tickets", 200
            )
            if success:
                print(f"   Retrieved {len(tickets.get('tickets', []))} tickets")
            
            success, _ = self.run_test(
                "DELETE game (should delete tickets too)",
                "DELETE", f"admin/games/{game_id}", 200
            )
        
        # 3. Ticket Management (need a new game)
        print("\n🎫 TICKET MANAGEMENT:")
        
        success, test_game = self.run_test(
            "POST create test game for ticket management",
            "POST", "games", 200,
            data={"name": "Ticket Test", "date": "2025-01-16", "time": "21:00", "price": 75, "total_tickets": 6, "prizes": {"Full House": 500}}
        )
        
        test_game_id = None
        test_ticket_id = None
        if success and test_game:
            test_game_id = test_game.get('game_id')
            
            success, tickets = self.run_test(
                "GET tickets for management",
                "GET", f"admin/games/{test_game_id}/tickets", 200
            )
            
            if success and tickets.get('tickets'):
                test_ticket_id = tickets['tickets'][0]['ticket_id']
                
                # Book the ticket first
                success, booking = self.run_test(
                    "POST book ticket for testing",
                    "POST", "bookings", 200,
                    data={"game_id": test_game_id, "ticket_ids": [test_ticket_id]}
                )
                
                if success:
                    success, _ = self.run_test(
                        "PUT update ticket holder name",
                        "PUT", f"admin/tickets/{test_ticket_id}/holder", 200,
                        data={"holder_name": "John Doe"}
                    )
                    
                    success, _ = self.run_test(
                        "POST cancel ticket",
                        "POST", f"admin/tickets/{test_ticket_id}/cancel", 200
                    )
            
            # Cleanup
            success, _ = self.run_test(
                "DELETE cleanup test game",
                "DELETE", f"admin/games/{test_game_id}", 200
            )
        
        # 4. Booking Requests
        print("\n📋 BOOKING REQUESTS:")
        
        success, booking_game = self.run_test(
            "POST create game for booking requests",
            "POST", "games", 200,
            data={"name": "Booking Test", "date": "2025-01-17", "time": "19:30", "price": 100, "total_tickets": 6, "prizes": {"Full House": 800}}
        )
        
        booking_game_id = None
        if success and booking_game:
            booking_game_id = booking_game.get('game_id')
            
            success, tickets = self.run_test(
                "GET tickets for booking request",
                "GET", f"admin/games/{booking_game_id}/tickets", 200
            )
            
            if success and tickets.get('tickets'):
                ticket_ids = [t['ticket_id'] for t in tickets['tickets'][:2]]
                
                success, request = self.run_test(
                    "POST create booking request",
                    "POST", "booking-requests", 200,
                    data={"game_id": booking_game_id, "ticket_ids": ticket_ids}
                )
                
                if success and request:
                    request_id = request.get('request_id')
                    
                    success, _ = self.run_test(
                        "GET all booking requests",
                        "GET", "admin/booking-requests", 200
                    )
                    
                    if request_id:
                        success, _ = self.run_test(
                            "PUT approve booking request",
                            "PUT", f"admin/booking-requests/{request_id}/approve", 200
                        )
                
                # Test rejection with another request
                if len(tickets.get('tickets', [])) > 2:
                    success, reject_request = self.run_test(
                        "POST create request for rejection",
                        "POST", "booking-requests", 200,
                        data={"game_id": booking_game_id, "ticket_ids": [tickets['tickets'][2]['ticket_id']]}
                    )
                    
                    if success and reject_request:
                        reject_id = reject_request.get('request_id')
                        if reject_id:
                            success, _ = self.run_test(
                                "PUT reject booking request",
                                "PUT", f"admin/booking-requests/{reject_id}/reject", 200
                            )
            
            # Cleanup
            success, _ = self.run_test(
                "DELETE cleanup booking test game",
                "DELETE", f"admin/games/{booking_game_id}", 200
            )
        
        # 5. TTS Endpoint
        print("\n🔊 TTS ENDPOINT:")
        
        success, tts = self.run_test(
            "POST TTS generate (should return use_browser_tts: true)",
            "POST", "tts/generate", 200,
            params="text=Number%20Twenty-One&include_prefix=true"
        )
        
        if success and tts:
            print(f"   TTS Enabled: {tts.get('enabled')}")
            print(f"   Use Browser TTS: {tts.get('use_browser_tts')}")
            print(f"   Text: {tts.get('text')}")
            if tts.get('use_browser_tts') == True:
                print("   ✅ Correctly using browser TTS fallback")
        
        # Final Results
        print("\n" + "="*60)
        print("ADMIN PANEL TEST RESULTS")
        print("="*60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"✅ Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = FocusedAdminTest()
    success = tester.test_review_requirements()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())