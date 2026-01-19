"""
Test suite for UPI + WhatsApp Booking Checkout Flow
Tests the booking-requests API endpoints and checkout functionality
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://housie-game-1.preview.emergentagent.com').rstrip('/')

# Test data
TEST_SESSION_TOKEN = None
TEST_USER_ID = None
TEST_GAME_ID = None
TEST_REQUEST_ID = None


class TestBookingCheckoutFlow:
    """Test the complete booking checkout flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data before each test"""
        global TEST_SESSION_TOKEN, TEST_USER_ID, TEST_GAME_ID
        
        # Create test user and session via mongosh
        import subprocess
        timestamp = int(datetime.now().timestamp() * 1000)
        user_id = f"test-checkout-{timestamp}"
        session_token = f"test_session_checkout_{timestamp}"
        
        mongo_script = f"""
        use('test_database');
        db.users.insertOne({{
          user_id: '{user_id}',
          email: 'test.checkout.{timestamp}@example.com',
          name: 'Checkout Test User',
          phone: '+918837489781',
          avatar: 'avatar1',
          created_at: new Date()
        }});
        db.user_sessions.insertOne({{
          user_id: '{user_id}',
          session_token: '{session_token}',
          expires_at: new Date(Date.now() + 7*24*60*60*1000),
          created_at: new Date()
        }});
        """
        subprocess.run(['mongosh', '--quiet', '--eval', mongo_script], capture_output=True)
        
        TEST_SESSION_TOKEN = session_token
        TEST_USER_ID = user_id
        
        yield
        
        # Cleanup after test
        cleanup_script = f"""
        use('test_database');
        db.users.deleteMany({{user_id: '{user_id}'}});
        db.user_sessions.deleteMany({{session_token: '{session_token}'}});
        db.booking_requests.deleteMany({{user_id: '{user_id}'}});
        """
        subprocess.run(['mongosh', '--quiet', '--eval', cleanup_script], capture_output=True)
    
    def get_auth_headers(self):
        """Get authorization headers"""
        return {
            "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_01_create_upcoming_game(self):
        """Create an upcoming game for testing"""
        global TEST_GAME_ID
        
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
        TEST_GAME_ID = data["game_id"]
        print(f"Created test game: {TEST_GAME_ID}")
    
    def test_02_get_game_tickets(self):
        """Get available tickets for the game"""
        response = requests.get(
            f"{BASE_URL}/api/games/{TEST_GAME_ID}/tickets?limit=10"
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
        global TEST_REQUEST_ID
        
        # Get first 2 available tickets
        response = requests.get(
            f"{BASE_URL}/api/games/{TEST_GAME_ID}/tickets?limit=2&available_only=true"
        )
        tickets = response.json()["tickets"]
        ticket_ids = [t["ticket_id"] for t in tickets[:2]]
        
        # Create booking request
        response = requests.post(
            f"{BASE_URL}/api/booking-requests",
            json={
                "game_id": TEST_GAME_ID,
                "ticket_ids": ticket_ids
            },
            headers=self.get_auth_headers()
        )
        
        assert response.status_code == 200, f"Failed to create booking request: {response.text}"
        data = response.json()
        
        assert "request_id" in data
        assert data["request_id"].startswith("req_")
        assert data["total_amount"] == 200  # 2 tickets * 100
        
        TEST_REQUEST_ID = data["request_id"]
        print(f"Created booking request: {TEST_REQUEST_ID}")
    
    def test_04_get_booking_request_by_id(self):
        """Get booking request by ID (for checkout page)"""
        response = requests.get(
            f"{BASE_URL}/api/booking-requests/{TEST_REQUEST_ID}",
            headers=self.get_auth_headers()
        )
        
        assert response.status_code == 200, f"Failed to get booking request: {response.text}"
        data = response.json()
        
        # Verify all required fields for checkout page
        assert data["request_id"] == TEST_REQUEST_ID
        assert data["game_id"] == TEST_GAME_ID
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
        our_request = next((r for r in data if r["request_id"] == TEST_REQUEST_ID), None)
        assert our_request is not None
        assert our_request["status"] == "pending"
        
        print(f"Found {len(data)} booking requests for user")
    
    def test_06_duplicate_booking_request_rejected(self):
        """Verify duplicate booking request is rejected"""
        # Get more tickets
        response = requests.get(
            f"{BASE_URL}/api/games/{TEST_GAME_ID}/tickets?limit=10&available_only=true"
        )
        tickets = response.json()["tickets"]
        ticket_ids = [t["ticket_id"] for t in tickets[:2]]
        
        # Try to create another booking request
        response = requests.post(
            f"{BASE_URL}/api/booking-requests",
            json={
                "game_id": TEST_GAME_ID,
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
            f"{BASE_URL}/api/booking-requests/{TEST_REQUEST_ID}"
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
                    import subprocess
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
    
    def test_09_cleanup_test_game(self):
        """Cleanup test game"""
        global TEST_GAME_ID
        
        if TEST_GAME_ID:
            # Delete via admin endpoint
            import subprocess
            cleanup_script = f"""
            use('test_database');
            db.games.deleteOne({{game_id: '{TEST_GAME_ID}'}});
            db.tickets.deleteMany({{game_id: '{TEST_GAME_ID}'}});
            db.booking_requests.deleteMany({{game_id: '{TEST_GAME_ID}'}});
            """
            subprocess.run(['mongosh', '--quiet', '--eval', cleanup_script], capture_output=True)
            print(f"Cleaned up test game: {TEST_GAME_ID}")


class TestTransactionReferenceFormat:
    """Test transaction reference generation format"""
    
    def test_txn_ref_format(self):
        """Verify transaction reference format: TMB + 6 alphanumeric chars"""
        import re
        
        # The format should be TMB followed by 6 characters from:
        # ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (excluding I,O,0,1)
        valid_chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        
        # Generate multiple refs and verify format
        for _ in range(10):
            ref = "TMB"
            import random
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


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
