import requests
import sys
import json
from datetime import datetime

class AdminPanelTester:
    def __init__(self, base_url="https://housie-master-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = "admin_session_1766786901455"  # Valid admin session from DB
        self.user_id = "admin-user-1766786901455"
        self.tests_run = 0
        self.tests_passed = 0
        self.game_id = None
        self.ticket_id = None
        self.booking_request_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if params:
            url += f"?{params}"
            
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
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 800:
                        print(f"   Response: {response_data}")
                    elif isinstance(response_data, list) and len(response_data) > 0:
                        print(f"   Response: {len(response_data)} items returned")
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

    def test_caller_voice_settings(self):
        """Test Caller Voice Settings endpoints"""
        print("\n" + "="*60)
        print("TESTING CALLER VOICE SETTINGS")
        print("="*60)
        
        # 1. GET /api/admin/caller-settings - Should return default settings
        success, settings_data = self.run_test(
            "Get Caller Settings",
            "GET",
            "admin/caller-settings",
            200
        )
        
        if success and settings_data:
            print(f"   Voice: {settings_data.get('voice')}")
            print(f"   Gender: {settings_data.get('gender')}")
            print(f"   Speed: {settings_data.get('speed')}")
            print(f"   Prefix lines count: {len(settings_data.get('prefix_lines', []))}")
        
        # 2. PUT /api/admin/caller-settings - Update settings
        update_data = {
            "gender": "male",
            "speed": 1.3
        }
        
        success, updated_settings = self.run_test(
            "Update Caller Settings",
            "PUT",
            "admin/caller-settings",
            200,
            data=update_data
        )
        
        if success and updated_settings:
            print(f"   Updated Gender: {updated_settings.get('gender')}")
            print(f"   Updated Speed: {updated_settings.get('speed')}")
            print(f"   Auto-selected Voice: {updated_settings.get('voice')}")
        
        # 3. POST /api/admin/caller-settings/prefix-lines - Add prefix line
        success, add_result = self.run_test(
            "Add Prefix Line",
            "POST",
            "admin/caller-settings/prefix-lines",
            200,
            params="line=Test%20line"
        )
        
        # 4. DELETE /api/admin/caller-settings/prefix-lines/0 - Delete first prefix line
        success, delete_result = self.run_test(
            "Delete First Prefix Line",
            "DELETE",
            "admin/caller-settings/prefix-lines/0",
            200
        )
        
        # 5. POST /api/admin/caller-settings/reset-prefix-lines - Reset to defaults
        success, reset_result = self.run_test(
            "Reset Prefix Lines",
            "POST",
            "admin/caller-settings/reset-prefix-lines",
            200
        )
        
        return True

    def test_game_management(self):
        """Test Game Management endpoints"""
        print("\n" + "="*60)
        print("TESTING GAME MANAGEMENT")
        print("="*60)
        
        # 1. POST /api/games - Create game (should auto-generate tickets)
        game_data = {
            "name": "Test Game",
            "date": "2025-01-15",
            "time": "20:00",
            "price": 50,
            "total_tickets": 12,
            "prizes": {"Top Line": 200}
        }
        
        success, created_game = self.run_test(
            "Create Game with Auto-Generated Tickets",
            "POST",
            "games",
            200,
            data=game_data
        )
        
        if success and created_game:
            self.game_id = created_game.get('game_id')
            print(f"   Created Game ID: {self.game_id}")
            print(f"   Ticket Count: {created_game.get('ticket_count')}")
            print(f"   Available Tickets: {created_game.get('available_tickets')}")
        
        # 2. GET /api/admin/games/{game_id}/tickets - Get tickets for the game
        if self.game_id:
            success, tickets_data = self.run_test(
                "Get Game Tickets (Admin)",
                "GET",
                f"admin/games/{self.game_id}/tickets",
                200
            )
            
            if success and tickets_data:
                tickets = tickets_data.get('tickets', [])
                print(f"   Total tickets retrieved: {len(tickets)}")
                if tickets:
                    self.ticket_id = tickets[0].get('ticket_id')
                    print(f"   First ticket ID: {self.ticket_id}")
        
        # 3. DELETE /api/admin/games/{game_id} - Delete the game (test that it deletes tickets too)
        if self.game_id:
            success, delete_result = self.run_test(
                "Delete Game",
                "DELETE",
                f"admin/games/{self.game_id}",
                200
            )
            
            if success:
                print(f"   Game {self.game_id} deleted successfully")
                # Verify tickets are also deleted by trying to get them
                success, verify_tickets = self.run_test(
                    "Verify Tickets Deleted",
                    "GET",
                    f"admin/games/{self.game_id}/tickets",
                    404  # Should return 404 since game is deleted
                )
        
        return True

    def test_ticket_management(self):
        """Test Ticket Management endpoints"""
        print("\n" + "="*60)
        print("TESTING TICKET MANAGEMENT")
        print("="*60)
        
        # First create a new game for ticket management tests
        game_data = {
            "name": "Ticket Management Test Game",
            "date": "2025-01-16",
            "time": "21:00",
            "price": 75,
            "total_tickets": 6,
            "prizes": {"Full House": 500}
        }
        
        success, created_game = self.run_test(
            "Create Game for Ticket Tests",
            "POST",
            "games",
            200,
            data=game_data
        )
        
        if success and created_game:
            test_game_id = created_game.get('game_id')
            
            # Get tickets for this game
            success, tickets_data = self.run_test(
                "Get Tickets for Management",
                "GET",
                f"admin/games/{test_game_id}/tickets",
                200
            )
            
            if success and tickets_data:
                tickets = tickets_data.get('tickets', [])
                if tickets:
                    test_ticket_id = tickets[0].get('ticket_id')
                    
                    # First book the ticket to test management features
                    booking_data = {
                        "game_id": test_game_id,
                        "ticket_ids": [test_ticket_id]
                    }
                    
                    success, booking_result = self.run_test(
                        "Book Ticket for Management Test",
                        "POST",
                        "bookings",
                        200,
                        data=booking_data
                    )
                    
                    if success:
                        # 1. PUT /api/admin/tickets/{ticket_id}/holder - Update ticket holder name
                        holder_data = {
                            "holder_name": "John Doe"
                        }
                        
                        success, holder_result = self.run_test(
                            "Update Ticket Holder Name",
                            "PUT",
                            f"admin/tickets/{test_ticket_id}/holder",
                            200,
                            data=holder_data
                        )
                        
                        # 2. POST /api/admin/tickets/{ticket_id}/cancel - Cancel the booked ticket
                        success, cancel_result = self.run_test(
                            "Cancel Booked Ticket",
                            "POST",
                            f"admin/tickets/{test_ticket_id}/cancel",
                            200
                        )
                        
                        if success:
                            print(f"   Ticket {test_ticket_id} cancelled and returned to available pool")
            
            # Clean up - delete the test game
            success, cleanup_result = self.run_test(
                "Cleanup Test Game",
                "DELETE",
                f"admin/games/{test_game_id}",
                200
            )
        
        return True

    def test_booking_requests(self):
        """Test Booking Requests (Approval Workflow) endpoints"""
        print("\n" + "="*60)
        print("TESTING BOOKING REQUESTS WORKFLOW")
        print("="*60)
        
        # First create a game for booking request tests
        game_data = {
            "name": "Booking Request Test Game",
            "date": "2025-01-17",
            "time": "19:30",
            "price": 100,
            "total_tickets": 6,
            "prizes": {"Early Five": 300, "Full House": 800}
        }
        
        success, created_game = self.run_test(
            "Create Game for Booking Requests",
            "POST",
            "games",
            200,
            data=game_data
        )
        
        if success and created_game:
            test_game_id = created_game.get('game_id')
            
            # Get tickets for this game
            success, tickets_data = self.run_test(
                "Get Tickets for Booking Request",
                "GET",
                f"admin/games/{test_game_id}/tickets",
                200
            )
            
            if success and tickets_data:
                tickets = tickets_data.get('tickets', [])
                if tickets:
                    test_ticket_ids = [t.get('ticket_id') for t in tickets[:2]]
                    
                    # Create a booking request
                    request_data = {
                        "game_id": test_game_id,
                        "ticket_ids": test_ticket_ids
                    }
                    
                    success, request_result = self.run_test(
                        "Create Booking Request",
                        "POST",
                        "booking-requests",
                        200,
                        data=request_data
                    )
                    
                    if success and request_result:
                        self.booking_request_id = request_result.get('request_id')
                        print(f"   Created Booking Request ID: {self.booking_request_id}")
                        
                        # 1. GET /api/admin/booking-requests - Get all booking requests
                        success, all_requests = self.run_test(
                            "Get All Booking Requests",
                            "GET",
                            "admin/booking-requests",
                            200
                        )
                        
                        if success and all_requests:
                            print(f"   Total booking requests: {len(all_requests)}")
                        
                        # 2. PUT /api/admin/booking-requests/{request_id}/approve - Approve the request
                        approve_data = {
                            "admin_notes": "Approved for testing"
                        }
                        
                        success, approve_result = self.run_test(
                            "Approve Booking Request",
                            "PUT",
                            f"admin/booking-requests/{self.booking_request_id}/approve",
                            200,
                            data=approve_data
                        )
                        
                        if success:
                            print(f"   Booking request {self.booking_request_id} approved")
                    
                    # Test rejection workflow with a new request
                    if len(tickets) > 2:
                        reject_ticket_ids = [tickets[2].get('ticket_id')]
                        
                        reject_request_data = {
                            "game_id": test_game_id,
                            "ticket_ids": reject_ticket_ids
                        }
                        
                        success, reject_request_result = self.run_test(
                            "Create Booking Request for Rejection",
                            "POST",
                            "booking-requests",
                            200,
                            data=reject_request_data
                        )
                        
                        if success and reject_request_result:
                            reject_request_id = reject_request_result.get('request_id')
                            
                            # 3. PUT /api/admin/booking-requests/{request_id}/reject - Reject the request
                            reject_data = {
                                "admin_notes": "Rejected for testing purposes"
                            }
                            
                            success, reject_result = self.run_test(
                                "Reject Booking Request",
                                "PUT",
                                f"admin/booking-requests/{reject_request_id}/reject",
                                200,
                                data=reject_data
                            )
                            
                            if success:
                                print(f"   Booking request {reject_request_id} rejected")
            
            # Clean up - delete the test game
            success, cleanup_result = self.run_test(
                "Cleanup Booking Request Test Game",
                "DELETE",
                f"admin/games/{test_game_id}",
                200
            )
        
        return True

    def test_tts_endpoint(self):
        """Test TTS endpoint"""
        print("\n" + "="*60)
        print("TESTING TTS ENDPOINT")
        print("="*60)
        
        # POST /api/tts/generate - Should return with use_browser_tts: true
        success, tts_result = self.run_test(
            "Generate TTS with Prefix",
            "POST",
            "tts/generate",
            200,
            params="text=Number%20Twenty-One&include_prefix=true"
        )
        
        if success and tts_result:
            print(f"   TTS Enabled: {tts_result.get('enabled')}")
            print(f"   Use Browser TTS: {tts_result.get('use_browser_tts')}")
            print(f"   Text: {tts_result.get('text')}")
            
            # Verify it returns use_browser_tts: true as expected
            if tts_result.get('use_browser_tts') == True:
                print("   ✅ Correctly using browser TTS fallback")
            else:
                print("   ⚠️  Expected use_browser_tts: true")
        
        return True

    def test_complete_flow(self):
        """Test the complete flow as described in the review request"""
        print("\n" + "="*60)
        print("TESTING COMPLETE ADMIN PANEL FLOW")
        print("="*60)
        
        # 1. Get initial caller settings
        success, initial_settings = self.run_test(
            "1. Get Initial Caller Settings",
            "GET",
            "admin/caller-settings",
            200
        )
        
        if success and initial_settings:
            print(f"   Initial Gender: {initial_settings.get('gender')}")
            print(f"   Initial Speed: {initial_settings.get('speed')}")
        
        # 2. Update caller settings (change gender to male)
        update_data = {"gender": "male"}
        success, updated_settings = self.run_test(
            "2. Update Caller Settings to Male",
            "PUT",
            "admin/caller-settings",
            200,
            data=update_data
        )
        
        # 3. Add a custom prefix line
        success, add_prefix = self.run_test(
            "3. Add Custom Prefix Line",
            "POST",
            "admin/caller-settings/prefix-lines",
            200,
            params="line=Custom%20test%20line"
        )
        
        # 4. Create a new game and verify tickets are auto-generated
        game_data = {
            "name": "Complete Flow Test Game",
            "date": "2025-01-20",
            "time": "20:30",
            "price": 60,
            "total_tickets": 12,
            "prizes": {"Top Line": 200, "Full House": 500}
        }
        
        success, flow_game = self.run_test(
            "4. Create Game with Auto-Generated Tickets",
            "POST",
            "games",
            200,
            data=game_data
        )
        
        if success and flow_game:
            flow_game_id = flow_game.get('game_id')
            print(f"   Flow Game ID: {flow_game_id}")
            
            # 5. Get the game's tickets list
            success, flow_tickets = self.run_test(
                "5. Get Game Tickets List",
                "GET",
                f"admin/games/{flow_game_id}/tickets",
                200
            )
            
            if success and flow_tickets:
                tickets_count = len(flow_tickets.get('tickets', []))
                print(f"   Tickets auto-generated: {tickets_count}")
                
                # 6. Delete the game and verify it's gone
                success, delete_flow_game = self.run_test(
                    "6. Delete Game and Verify Cleanup",
                    "DELETE",
                    f"admin/games/{flow_game_id}",
                    200
                )
                
                if success:
                    # Verify game is deleted by trying to get it
                    success, verify_deleted = self.run_test(
                        "6b. Verify Game is Deleted",
                        "GET",
                        f"games/{flow_game_id}",
                        404  # Should return 404
                    )
                    
                    if success:  # success here means we got the expected 404
                        print("   ✅ Game successfully deleted and verified")
        
        return True

    def run_all_admin_tests(self):
        """Run all admin panel tests"""
        print("🚀 Starting Admin Panel Tests")
        print(f"🔗 Base URL: {self.base_url}")
        print(f"👤 Test User ID: {self.user_id}")
        print(f"🔑 Session Token: {self.session_token[:20]}...")
        
        # Run test suites
        caller_success = self.test_caller_voice_settings()
        game_mgmt_success = self.test_game_management()
        ticket_mgmt_success = self.test_ticket_management()
        booking_requests_success = self.test_booking_requests()
        tts_success = self.test_tts_endpoint()
        flow_success = self.test_complete_flow()
        
        # Print final results
        print("\n" + "="*60)
        print("ADMIN PANEL TEST RESULTS")
        print("="*60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"✅ Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # Test suite results
        suites = [
            ("Caller Voice Settings", caller_success),
            ("Game Management", game_mgmt_success),
            ("Ticket Management", ticket_mgmt_success),
            ("Booking Requests", booking_requests_success),
            ("TTS Endpoint", tts_success),
            ("Complete Flow", flow_success)
        ]
        
        print("\n📋 Admin Panel Test Suite Results:")
        for suite_name, success in suites:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"   {suite_name}: {status}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = AdminPanelTester()
    success = tester.run_all_admin_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())