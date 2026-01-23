"""
Test suite for:
1. DELETE /api/booking-requests/{request_id} endpoint
2. Pending bookings functionality
3. Zoom controls verification (frontend)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_PHONE = "9876543210"
TEST_PIN = "1234"
TEST_GAME_ID = "game_b1be7e66"  # Sunday Night Tambola - upcoming game

class TestBookingRequestsDelete:
    """Test DELETE /api/booking-requests/{request_id} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.auth_token = None
        self.user_id = None
        
    def login(self):
        """Login and get auth token"""
        # First check if phone exists
        check_response = self.session.post(f"{BASE_URL}/api/auth/phone/check", json={
            "phone": TEST_PHONE
        })
        
        if check_response.status_code == 200 and check_response.json().get("exists"):
            # Login with PIN
            login_response = self.session.post(f"{BASE_URL}/api/auth/phone/login", json={
                "phone": TEST_PHONE,
                "pin": TEST_PIN
            })
            if login_response.status_code == 200:
                data = login_response.json()
                self.auth_token = data.get("session_token")
                self.user_id = data.get("user", {}).get("user_id")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                return True
        return False
    
    def test_login_success(self):
        """Test that login works with test credentials"""
        result = self.login()
        assert result, "Login should succeed with test credentials"
        assert self.auth_token is not None, "Should receive auth token"
        print(f"✓ Login successful, user_id: {self.user_id}")
    
    def test_get_my_booking_requests(self):
        """Test GET /api/booking-requests/my endpoint"""
        self.login()
        
        response = self.session.get(f"{BASE_URL}/api/booking-requests/my")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/booking-requests/my returned {len(data)} bookings")
        return data
    
    def test_create_and_delete_booking_request(self):
        """Test creating a booking request and then deleting it"""
        self.login()
        
        # Get available tickets for the test game
        tickets_response = self.session.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}/tickets?page=1&limit=10")
        if tickets_response.status_code != 200:
            pytest.skip(f"Could not get tickets for game {TEST_GAME_ID}")
        
        tickets_data = tickets_response.json()
        available_tickets = [t for t in tickets_data.get("tickets", []) if not t.get("is_booked")]
        
        if len(available_tickets) < 1:
            pytest.skip("No available tickets for testing")
        
        # Select first available ticket
        ticket_id = available_tickets[0]["ticket_id"]
        
        # Create booking request
        create_response = self.session.post(f"{BASE_URL}/api/booking-requests", json={
            "game_id": TEST_GAME_ID,
            "ticket_ids": [ticket_id]
        })
        
        assert create_response.status_code == 200, f"Create booking failed: {create_response.text}"
        booking_data = create_response.json()
        request_id = booking_data.get("request_id")
        assert request_id is not None, "Should receive request_id"
        print(f"✓ Created booking request: {request_id}")
        
        # Now delete the booking request
        delete_response = self.session.delete(f"{BASE_URL}/api/booking-requests/{request_id}")
        assert delete_response.status_code == 200, f"Delete booking failed: {delete_response.text}"
        
        delete_data = delete_response.json()
        assert "cancelled" in delete_data.get("message", "").lower() or "success" in str(delete_data).lower(), \
            f"Expected success message, got: {delete_data}"
        print(f"✓ Successfully deleted booking request: {request_id}")
        
        # Verify the booking is no longer pending
        my_bookings = self.session.get(f"{BASE_URL}/api/booking-requests/my").json()
        pending_bookings = [b for b in my_bookings if b.get("request_id") == request_id and b.get("status") == "pending"]
        assert len(pending_bookings) == 0, "Deleted booking should not appear as pending"
        print("✓ Verified booking no longer appears as pending")
    
    def test_delete_nonexistent_booking(self):
        """Test deleting a non-existent booking request returns 404"""
        self.login()
        
        fake_request_id = "nonexistent_request_12345"
        response = self.session.delete(f"{BASE_URL}/api/booking-requests/{fake_request_id}")
        
        assert response.status_code == 404, f"Expected 404 for non-existent booking, got {response.status_code}"
        print("✓ DELETE non-existent booking returns 404")
    
    def test_delete_without_auth(self):
        """Test that deleting without auth returns 401"""
        # Don't login - use fresh session
        fresh_session = requests.Session()
        fresh_session.headers.update({"Content-Type": "application/json"})
        
        response = fresh_session.delete(f"{BASE_URL}/api/booking-requests/some_request_id")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ DELETE without auth returns 401/403")


class TestGamesAndTickets:
    """Test games and tickets endpoints for zoom testing context"""
    
    def test_get_upcoming_game(self):
        """Test that the test game exists and is upcoming"""
        response = requests.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}")
        
        assert response.status_code == 200, f"Game not found: {response.text}"
        game = response.json()
        assert game.get("status") == "upcoming", f"Expected upcoming game, got {game.get('status')}"
        print(f"✓ Game {TEST_GAME_ID} exists and is upcoming")
        print(f"  Name: {game.get('name')}")
        print(f"  Date: {game.get('date')} at {game.get('time')}")
    
    def test_get_game_tickets(self):
        """Test getting tickets for a game (needed for zoom display)"""
        response = requests.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}/tickets?page=1&limit=100")
        
        assert response.status_code == 200, f"Failed to get tickets: {response.text}"
        data = response.json()
        
        assert "tickets" in data, "Response should contain tickets"
        tickets = data["tickets"]
        assert len(tickets) > 0, "Should have tickets"
        
        # Verify ticket structure for zoom display
        ticket = tickets[0]
        assert "ticket_id" in ticket, "Ticket should have ticket_id"
        assert "ticket_number" in ticket, "Ticket should have ticket_number"
        assert "numbers" in ticket, "Ticket should have numbers array"
        assert "full_sheet_id" in ticket, "Ticket should have full_sheet_id"
        
        print(f"✓ Got {len(tickets)} tickets for game")
        print(f"  First ticket: {ticket.get('ticket_number')} in sheet {ticket.get('full_sheet_id')}")


class TestPendingBookingsFlow:
    """Test the complete pending bookings flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.auth_token = None
        self.user_id = None
        
    def login(self):
        """Login and get auth token"""
        check_response = self.session.post(f"{BASE_URL}/api/auth/phone/check", json={
            "phone": TEST_PHONE
        })
        
        if check_response.status_code == 200 and check_response.json().get("exists"):
            login_response = self.session.post(f"{BASE_URL}/api/auth/phone/login", json={
                "phone": TEST_PHONE,
                "pin": TEST_PIN
            })
            if login_response.status_code == 200:
                data = login_response.json()
                self.auth_token = data.get("session_token")
                self.user_id = data.get("user", {}).get("user_id")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                return True
        return False
    
    def test_pending_bookings_appear_in_my_bookings(self):
        """Test that pending bookings appear in /api/booking-requests/my"""
        self.login()
        
        # Get available tickets
        tickets_response = self.session.get(f"{BASE_URL}/api/games/{TEST_GAME_ID}/tickets?page=1&limit=10")
        if tickets_response.status_code != 200:
            pytest.skip("Could not get tickets")
        
        tickets_data = tickets_response.json()
        available_tickets = [t for t in tickets_data.get("tickets", []) if not t.get("is_booked")]
        
        if len(available_tickets) < 1:
            pytest.skip("No available tickets")
        
        ticket_id = available_tickets[0]["ticket_id"]
        
        # Create booking
        create_response = self.session.post(f"{BASE_URL}/api/booking-requests", json={
            "game_id": TEST_GAME_ID,
            "ticket_ids": [ticket_id]
        })
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create booking: {create_response.text}")
        
        request_id = create_response.json().get("request_id")
        
        try:
            # Check my bookings
            my_bookings = self.session.get(f"{BASE_URL}/api/booking-requests/my").json()
            pending = [b for b in my_bookings if b.get("status") == "pending"]
            
            assert len(pending) > 0, "Should have at least one pending booking"
            
            # Find our booking
            our_booking = next((b for b in pending if b.get("request_id") == request_id), None)
            assert our_booking is not None, "Our booking should appear in pending list"
            
            # Verify booking has required fields for dashboard display
            assert "game_id" in our_booking, "Booking should have game_id"
            assert "ticket_ids" in our_booking, "Booking should have ticket_ids"
            assert "total_amount" in our_booking, "Booking should have total_amount"
            assert "created_at" in our_booking, "Booking should have created_at"
            
            print(f"✓ Pending booking appears in my bookings")
            print(f"  Request ID: {request_id}")
            print(f"  Tickets: {len(our_booking.get('ticket_ids', []))}")
            print(f"  Amount: ₹{our_booking.get('total_amount')}")
            
        finally:
            # Cleanup - delete the booking
            self.session.delete(f"{BASE_URL}/api/booking-requests/{request_id}")
            print("✓ Cleaned up test booking")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
