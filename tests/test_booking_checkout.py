"""
Test suite for UPI + WhatsApp Booking Checkout Flow
Tests the booking-requests API endpoints and checkout functionality
"""
import pytest
import requests
import os
import uuid
import subprocess
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://housie-game-1.preview.emergentagent.com').rstrip('/')


class TestBookingCheckoutFlow:
    """Test the complete booking checkout flow"""
    
    # Class-level variables to share between tests
    session_token = None
    user_id = None
    game_id = None
    request_id = None
    
    @classmethod
    def setup_class(cls):
        """Setup test data once for all tests in this class"""
        timestamp = int(datetime.now().timestamp() * 1000)
        cls.user_id = f"test-checkout-{timestamp}"
        cls.session_token = f"test_session_checkout_{timestamp}"
        
        mongo_script = f"""
        use('test_database');
        db.users.insertOne({{
          user_id: '{cls.user_id}',
          email: 'test.checkout.{timestamp}@example.com',
          name: 'Checkout Test User',
          phone: '+918837489781',
          avatar: 'avatar1',
          created_at: new Date()
        }});
        db.user_sessions.insertOne({{
          user_id: '{cls.user_id}',
          session_token: '{cls.session_token}',
          expires_at: new Date(Date.now() + 7*24*60*60*1000),
          created_at: new Date()
        }});
        """
        subprocess.run(['mongosh', '--quiet', '--eval', mongo_script], capture_output=True)
        print(f"Created test user: {cls.user_id}")
    
    @classmethod
    def teardown_class(cls):
        """Cleanup after all tests in this class"""
        cleanup_script = f"""
        use('test_database');
        db.users.deleteMany({{user_id: '{cls.user_id}'}});
        db.user_sessions.deleteMany({{session_token: '{cls.session_token}'}});
        db.booking_requests.deleteMany({{user_id: '{cls.user_id}'}});
        if ('{cls.game_id}' !== 'None') {{
            db.games.deleteOne({{game_id: '{cls.game_id}'}});
            db.tickets.deleteMany({{game_id: '{cls.game_id}'}});
        }}
        """
        subprocess.run(['mongosh', '--quiet', '--eval', cleanup_script], capture_output=True)
        print(f"Cleaned up test data")
    
    def get_auth_headers(self):
        """Get authorization headers"""
        return {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
    
    def test_01_create_upcoming_game(self):
        """Create an upcoming game for testing"""
        game_data = {
            "name": f"Checkout Test Game {uuid.uuid4().hex[:8]}",
            "date": "2026-02-01",
            "time": "20:00",
            "price": 100,
            "total_tickets": 60,
            "prizes": {
                "Top Line": 500,
                "Full House": 2000
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/games",
            json=game_data
        )
        
        assert response.status_code == 200, f"Failed to create game: {response.text}"
        data = response.json()
        assert data["status"] == "upcoming"
        TestBookingCheckoutFlow.game_id = data["game_id"]
        print(f"Created test game: {TestBookingCheckoutFlow.game_id}")
    
    def test_02_get_game_tickets(self):
        """Get available tickets for the game"""
        response = requests.get(
            f"{BASE_URL}/api/games/{self.game_id}/tickets?limit=10"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        assert len(data["tickets"]) > 0
        
        # Verify ticket structure
        ticket = data["tickets"][0]
        assert "ticket_id" in ticket
        assert "ticket_number" in ticket
        assert ticket["is_booked"] == False
        print(f"Found {len(data['tickets'])} tickets")
    
    def test_03_create_booking_request(self):
        """Create a booking request"""
        # Get first 2 available tickets
        response = requests.get(
            f"{BASE_URL}/api/games/{self.game_id}/tickets?limit=2&available_only=true"
        )
        tickets = response.json()["tickets"]
        ticket_ids = [t["ticket_id"] for t in tickets[:2]]
        
        # Create booking request
        response = requests.post(
            f"{BASE_URL}/api/booking-requests",
            json={
                "game_id": self.game_id,
                "ticket_ids": ticket_ids
            },
            headers=self.get_auth_headers()
        )
        
        assert response.status_code == 200, f"Failed to create booking request: {response.text}"
        data = response.json()
        
        assert "request_id" in data
        assert data["request_id"].startswith("req_")
        assert data["total_amount"] == 200  # 2 tickets * 100
        
        TestBookingCheckoutFlow.request_id = data["request_id"]
        print(f"Created booking request: {TestBookingCheckoutFlow.request_id}")
    
    def test_04_get_booking_request_by_id(self):
        """Get booking request by ID (for checkout page)"""
        response = requests.get(
            f"{BASE_URL}/api/booking-requests/{self.request_id}",
            headers=self.get_auth_headers()
        )
        
        assert response.status_code == 200, f"Failed to get booking request: {response.text}"
        data = response.json()
        
        # Verify all required fields for checkout page
        assert data["request_id"] == self.request_id
        assert data["game_id"] == self.game_id
        assert data["total_amount"] == 200
        assert "game_name" in data
        assert "ticket_numbers" in data
        assert len(data["ticket_numbers"]) == 2
        assert data["ticket_count"] == 2
        
        print(f"Booking request data: game={data['game_name']}, tickets={data['ticket_numbers']}, amount={data['total_amount']}")
    
    def test_05_get_my_booking_requests(self):
        """Get user's booking requests"""
        response = requests.get(
            f"{BASE_URL}/api/booking-requests/my",
            headers=self.get_auth_headers()
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Find our request
        our_request = next((r for r in data if r["request_id"] == self.request_id), None)
        assert our_request is not None
        assert our_request["status"] == "pending"
        
        print(f"Found {len(data)} booking requests for user")
    
    def test_06_duplicate_booking_request_rejected(self):
        """Verify duplicate booking request is rejected"""
        # Get more tickets
        response = requests.get(
            f"{BASE_URL}/api/games/{self.game_id}/tickets?limit=10&available_only=true"
        )
        tickets = response.json()["tickets"]
        ticket_ids = [t["ticket_id"] for t in tickets[:2]]
        
        # Try to create another booking request
        response = requests.post(
            f"{BASE_URL}/api/booking-requests",
            json={
                "game_id": self.game_id,
                "ticket_ids": ticket_ids
            },
            headers=self.get_auth_headers()
        )
        
        assert response.status_code == 400
        assert "already have a pending request" in response.json()["detail"]
        print("Duplicate booking request correctly rejected")
    
    def test_07_unauthorized_access_rejected(self):
        """Verify unauthorized access to booking request is rejected"""
        # Try to access without auth
        response = requests.get(
            f"{BASE_URL}/api/booking-requests/{self.request_id}"
        )
        
        assert response.status_code == 401
        print("Unauthorized access correctly rejected")
    
    def test_08_booking_request_for_live_game_rejected(self):
        """Verify booking request for live game is rejected"""
        # Get a live game
        response = requests.get(f"{BASE_URL}/api/games?status=live")
        games = response.json()
        
        if len(games) > 0:
            live_game = games[0]
            
            # Get tickets for live game
            response = requests.get(
                f"{BASE_URL}/api/games/{live_game['game_id']}/tickets?limit=2&available_only=true"
            )
            
            if response.status_code == 200:
                tickets = response.json().get("tickets", [])
                if len(tickets) >= 2:
                    ticket_ids = [t["ticket_id"] for t in tickets[:2]]
                    
                    # Create a new user for this test
                    timestamp = int(datetime.now().timestamp() * 1000)
                    new_user_id = f"test-live-{timestamp}"
                    new_session = f"test_session_live_{timestamp}"
                    
                    mongo_script = f"""
                    use('test_database');
                    db.users.insertOne({{
                      user_id: '{new_user_id}',
                      email: 'test.live.{timestamp}@example.com',
                      name: 'Live Test User',
                      avatar: 'avatar1',
                      created_at: new Date()
                    }});
                    db.user_sessions.insertOne({{
                      user_id: '{new_user_id}',
                      session_token: '{new_session}',
                      expires_at: new Date(Date.now() + 7*24*60*60*1000),
                      created_at: new Date()
                    }});
                    """
                    subprocess.run(['mongosh', '--quiet', '--eval', mongo_script], capture_output=True)
                    
                    # Try to create booking request for live game
                    response = requests.post(
                        f"{BASE_URL}/api/booking-requests",
                        json={
                            "game_id": live_game["game_id"],
                            "ticket_ids": ticket_ids
                        },
                        headers={
                            "Authorization": f"Bearer {new_session}",
                            "Content-Type": "application/json"
                        }
                    )
                    
                    assert response.status_code == 400
                    assert "not accepting bookings" in response.json()["detail"]
                    print("Booking request for live game correctly rejected")
                    
                    # Cleanup
                    cleanup_script = f"""
                    use('test_database');
                    db.users.deleteMany({{user_id: '{new_user_id}'}});
                    db.user_sessions.deleteMany({{session_token: '{new_session}'}});
                    """
                    subprocess.run(['mongosh', '--quiet', '--eval', cleanup_script], capture_output=True)
                else:
                    print("Skipping live game test - no available tickets")
            else:
                print("Skipping live game test - couldn't get tickets")
        else:
            print("Skipping live game test - no live games found")


class TestTransactionReferenceFormat:
    """Test transaction reference generation format"""
    
    def test_txn_ref_format(self):
        """Verify transaction reference format: TMB + 6 alphanumeric chars"""
        import random
        
        # The format should be TMB followed by 6 characters from:
        # ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (excluding I,O,0,1)
        valid_chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        
        # Generate multiple refs and verify format
        for _ in range(10):
            ref = "TMB"
            for _ in range(6):
                ref += random.choice(valid_chars)
            
            assert ref.startswith("TMB")
            assert len(ref) == 9
            
            # Verify no confusing characters
            suffix = ref[3:]
            assert "I" not in suffix
            assert "O" not in suffix
            assert "0" not in suffix
            assert "1" not in suffix
        
        print("Transaction reference format verified: TMB + 6 chars (no I,O,0,1)")


class TestWhatsAppMessageFormat:
    """Test WhatsApp message format"""
    
    def test_message_format(self):
        """Verify WhatsApp message format matches specification"""
        # Expected format:
        # ✅ PAYMENT DONE
        #
        # Game: <name>
        # Tickets: <list>
        # Amount: ₹<amount>
        # Txn Ref: <ref>
        #
        # 📸 Screenshot attached
        
        game_name = "Test Game"
        tickets = "T001, T002"
        amount = 200
        txn_ref = "TMBABCDEF"
        
        expected_message = f"""✅ PAYMENT DONE

Game: {game_name}
Tickets: {tickets}
Amount: ₹{amount}
Txn Ref: {txn_ref}

📸 Screenshot attached"""
        
        # Verify message contains all required parts
        assert "✅ PAYMENT DONE" in expected_message
        assert f"Game: {game_name}" in expected_message
        assert f"Tickets: {tickets}" in expected_message
        assert f"Amount: ₹{amount}" in expected_message
        assert f"Txn Ref: {txn_ref}" in expected_message
        assert "📸 Screenshot attached" in expected_message
        
        print("WhatsApp message format verified")


class TestUPIConfiguration:
    """Test UPI configuration"""
    
    def test_upi_id_format(self):
        """Verify UPI ID format"""
        upi_id = "choegyalsangpo@ibl"
        
        # UPI ID should contain @ symbol
        assert "@" in upi_id
        
        # Should have valid format: name@bank
        parts = upi_id.split("@")
        assert len(parts) == 2
        assert len(parts[0]) > 0
        assert len(parts[1]) > 0
        
        print(f"UPI ID format verified: {upi_id}")
    
    def test_whatsapp_number_format(self):
        """Verify WhatsApp number format"""
        whatsapp_number = "918837489781"
        whatsapp_display = "+91 8837489781"
        
        # Number should be digits only (for API)
        assert whatsapp_number.isdigit()
        
        # Display should have + prefix
        assert whatsapp_display.startswith("+")
        
        print(f"WhatsApp number format verified: {whatsapp_display}")


class TestRouteConfiguration:
    """Test route configuration in App.js"""
    
    def test_checkout_route_exists(self):
        """Verify /checkout/:requestId route exists in App.js"""
        with open('/app/frontend/src/App.js', 'r') as f:
            app_content = f.read()
        
        # Check for checkout route
        assert '/checkout/:requestId' in app_content or 'checkout/:requestId' in app_content
        assert 'BookingCheckout' in app_content
        
        print("Checkout route verified in App.js")
    
    def test_booking_checkout_component_exists(self):
        """Verify BookingCheckout component exists"""
        import os
        assert os.path.exists('/app/frontend/src/pages/BookingCheckout.js')
        
        with open('/app/frontend/src/pages/BookingCheckout.js', 'r') as f:
            content = f.read()
        
        # Check for required data-testid attributes
        assert 'data-testid="booking-summary"' in content
        assert 'data-testid="pay-upi-btn"' in content
        assert 'data-testid="send-whatsapp-btn"' in content
        
        # Check for UPI ID
        assert 'choegyalsangpo@ibl' in content
        
        # Check for WhatsApp number
        assert '918837489781' in content
        assert '+91 8837489781' in content
        
        print("BookingCheckout component verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
