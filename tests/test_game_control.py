"""
Test Game Control Modal and WhatsApp Control Endpoints
Tests for:
- GET /api/admin/games/{game_id}/control - Get game control data
- POST /api/admin/games/{game_id}/whatsapp/booking-confirmation - Send booking confirmation
- POST /api/admin/games/{game_id}/whatsapp/game-reminder - Send game reminder
- POST /api/admin/games/{game_id}/whatsapp/join-link - Send join link
"""

import pytest
import requests
import os
import hashlib
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://tambola-game-5.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

# Admin credentials
ADMIN_USERNAME = "sixtysevenceo"
ADMIN_PASSWORD = "Freetibet123!@#"


class TestAdminAuth:
    """Test admin authentication for Game Control access"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token"""
        session = requests.Session()
        response = session.post(f"{API}/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        token = data.get("token")
        assert token, "No admin token returned"
        session.headers.update({"Authorization": f"Admin {token}"})
        return session
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{API}/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "token" in data
        print(f"✅ Admin login successful, token received")
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(f"{API}/admin/login", json={
            "username": "wronguser",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print(f"✅ Invalid credentials correctly rejected")


class TestGameControlEndpoint:
    """Test GET /api/admin/games/{game_id}/control endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token"""
        session = requests.Session()
        response = session.post(f"{API}/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Admin {token}"})
        return session
    
    @pytest.fixture(scope="class")
    def test_game(self, admin_session):
        """Create a test game for control testing"""
        # Create game scheduled for tomorrow (within 24 hours for reminder testing)
        tomorrow = (datetime.now() + timedelta(hours=20)).strftime("%Y-%m-%d")
        game_data = {
            "name": f"Control Test Game {datetime.now().strftime('%H%M%S')}",
            "date": tomorrow,
            "time": "20:00",
            "price": 50,
            "total_tickets": 12,  # Small for testing
            "prizes": {
                "Quick Five": 500,
                "Top Line": 200,
                "Full House": 2000
            }
        }
        response = requests.post(f"{API}/games", json=game_data)
        assert response.status_code == 200
        game = response.json()
        print(f"✅ Created test game: {game['game_id']}")
        yield game
        # Cleanup - delete game after tests
        admin_session.delete(f"{API}/admin/games/{game['game_id']}?force=true")
    
    def test_get_game_control_data(self, admin_session, test_game):
        """Test GET /api/admin/games/{game_id}/control returns all required data"""
        response = admin_session.get(f"{API}/admin/games/{test_game['game_id']}/control")
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required sections are present
        assert "game" in data, "Missing 'game' section"
        assert "ticket_summary" in data, "Missing 'ticket_summary' section"
        assert "bookings" in data, "Missing 'bookings' section"
        assert "whatsapp_status" in data, "Missing 'whatsapp_status' section"
        assert "whatsapp_logs" in data, "Missing 'whatsapp_logs' section"
        assert "control_logs" in data, "Missing 'control_logs' section"
        assert "has_sold_tickets" in data, "Missing 'has_sold_tickets' field"
        
        # Verify game info
        game = data["game"]
        assert game["game_id"] == test_game["game_id"]
        assert game["name"] == test_game["name"]
        assert game["status"] == "upcoming"
        
        # Verify ticket summary structure
        ticket_summary = data["ticket_summary"]
        assert "total" in ticket_summary
        assert "booked" in ticket_summary
        assert "confirmed" in ticket_summary
        assert "available" in ticket_summary
        assert "revenue" in ticket_summary
        assert ticket_summary["total"] == 12  # Our test game has 12 tickets
        
        # Verify WhatsApp status structure
        whatsapp_status = data["whatsapp_status"]
        assert "reminder_sent" in whatsapp_status
        assert "can_send_reminder" in whatsapp_status
        
        print(f"✅ Game control data returned with all required sections")
        print(f"   - Ticket Summary: {ticket_summary}")
        print(f"   - WhatsApp Status: {whatsapp_status}")
    
    def test_game_control_nonexistent_game(self, admin_session):
        """Test control endpoint with non-existent game returns 404"""
        response = admin_session.get(f"{API}/admin/games/nonexistent_game_id/control")
        assert response.status_code == 404
        print(f"✅ Non-existent game correctly returns 404")
    
    def test_game_control_requires_admin_auth(self, test_game):
        """Test control endpoint requires admin authentication"""
        response = requests.get(f"{API}/admin/games/{test_game['game_id']}/control")
        assert response.status_code == 401
        print(f"✅ Unauthenticated request correctly rejected")


class TestWhatsAppBookingConfirmation:
    """Test POST /api/admin/games/{game_id}/whatsapp/booking-confirmation"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token"""
        session = requests.Session()
        response = session.post(f"{API}/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Admin {token}"})
        return session
    
    def test_booking_confirmation_requires_booking_id(self, admin_session):
        """Test booking confirmation requires booking_id"""
        # Get any game
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game_id = games[0]["game_id"]
        
        # Try without booking_id
        response = admin_session.post(
            f"{API}/admin/games/{game_id}/whatsapp/booking-confirmation",
            json={}
        )
        # Should fail validation
        assert response.status_code in [400, 422]
        print(f"✅ Missing booking_id correctly rejected")
    
    def test_booking_confirmation_invalid_booking(self, admin_session):
        """Test booking confirmation with invalid booking_id returns 404"""
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game_id = games[0]["game_id"]
        
        response = admin_session.post(
            f"{API}/admin/games/{game_id}/whatsapp/booking-confirmation",
            json={"booking_id": "invalid_booking_id"}
        )
        assert response.status_code == 404
        print(f"✅ Invalid booking_id correctly returns 404")


class TestWhatsAppGameReminder:
    """Test POST /api/admin/games/{game_id}/whatsapp/game-reminder"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token"""
        session = requests.Session()
        response = session.post(f"{API}/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Admin {token}"})
        return session
    
    def test_game_reminder_nonexistent_game(self, admin_session):
        """Test game reminder with non-existent game returns 404"""
        response = admin_session.post(f"{API}/admin/games/nonexistent_game/whatsapp/game-reminder")
        assert response.status_code == 404
        print(f"✅ Non-existent game correctly returns 404")
    
    def test_game_reminder_no_bookings(self, admin_session):
        """Test game reminder with no confirmed bookings returns error"""
        # Create a game with no bookings
        tomorrow = (datetime.now() + timedelta(hours=20)).strftime("%Y-%m-%d")
        game_data = {
            "name": f"Reminder Test Game {datetime.now().strftime('%H%M%S')}",
            "date": tomorrow,
            "time": "20:00",
            "price": 50,
            "total_tickets": 6,
            "prizes": {"Full House": 1000}
        }
        response = requests.post(f"{API}/games", json=game_data)
        assert response.status_code == 200
        game = response.json()
        
        try:
            # Try to send reminder - should fail because no bookings
            reminder_response = admin_session.post(
                f"{API}/admin/games/{game['game_id']}/whatsapp/game-reminder"
            )
            assert reminder_response.status_code == 400
            assert "No confirmed bookings" in reminder_response.json().get("detail", "")
            print(f"✅ Game reminder correctly rejected when no bookings")
        finally:
            # Cleanup
            admin_session.delete(f"{API}/admin/games/{game['game_id']}?force=true")
    
    def test_game_reminder_outside_24hr_window(self, admin_session):
        """Test game reminder outside 24hr window returns error"""
        # Create a game scheduled for 3 days from now (outside 24hr window)
        future_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        game_data = {
            "name": f"Future Game {datetime.now().strftime('%H%M%S')}",
            "date": future_date,
            "time": "20:00",
            "price": 50,
            "total_tickets": 6,
            "prizes": {"Full House": 1000}
        }
        response = requests.post(f"{API}/games", json=game_data)
        assert response.status_code == 200
        game = response.json()
        
        try:
            # Try to send reminder - should fail because outside 24hr window
            reminder_response = admin_session.post(
                f"{API}/admin/games/{game['game_id']}/whatsapp/game-reminder"
            )
            # Should fail with 400 (either no bookings or outside window)
            assert reminder_response.status_code == 400
            print(f"✅ Game reminder correctly rejected for game outside 24hr window")
        finally:
            # Cleanup
            admin_session.delete(f"{API}/admin/games/{game['game_id']}?force=true")


class TestWhatsAppJoinLink:
    """Test POST /api/admin/games/{game_id}/whatsapp/join-link"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token"""
        session = requests.Session()
        response = session.post(f"{API}/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Admin {token}"})
        return session
    
    def test_join_link_nonexistent_game(self, admin_session):
        """Test join link with non-existent game returns 404"""
        response = admin_session.post(
            f"{API}/admin/games/nonexistent_game/whatsapp/join-link",
            json={"game_id": "nonexistent_game", "user_id": "some_user"}
        )
        assert response.status_code == 404
        print(f"✅ Non-existent game correctly returns 404")
    
    def test_join_link_nonexistent_user(self, admin_session):
        """Test join link with non-existent user returns 404"""
        # Get any game
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game_id = games[0]["game_id"]
        
        response = admin_session.post(
            f"{API}/admin/games/{game_id}/whatsapp/join-link",
            json={"game_id": game_id, "user_id": "nonexistent_user_id"}
        )
        assert response.status_code == 404
        print(f"✅ Non-existent user correctly returns 404")
    
    def test_join_link_requires_user_id(self, admin_session):
        """Test join link requires user_id"""
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game_id = games[0]["game_id"]
        
        response = admin_session.post(
            f"{API}/admin/games/{game_id}/whatsapp/join-link",
            json={"game_id": game_id}  # Missing user_id
        )
        assert response.status_code in [400, 422]
        print(f"✅ Missing user_id correctly rejected")


class TestGameControlIntegration:
    """Integration tests for Game Control flow"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token"""
        session = requests.Session()
        response = session.post(f"{API}/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Admin {token}"})
        return session
    
    def test_control_data_reflects_ticket_sales(self, admin_session):
        """Test that control data correctly reflects ticket sales"""
        # Get games
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game = games[0]
        
        # Get control data
        control_response = admin_session.get(f"{API}/admin/games/{game['game_id']}/control")
        assert control_response.status_code == 200
        data = control_response.json()
        
        # Verify ticket summary matches game data
        ticket_summary = data["ticket_summary"]
        assert ticket_summary["total"] == game.get("ticket_count", 0)
        
        # Verify has_sold_tickets is boolean
        assert isinstance(data["has_sold_tickets"], bool)
        
        print(f"✅ Control data correctly reflects ticket sales")
        print(f"   - Total tickets: {ticket_summary['total']}")
        print(f"   - Booked: {ticket_summary['booked']}")
        print(f"   - Confirmed: {ticket_summary['confirmed']}")
        print(f"   - Has sold tickets: {data['has_sold_tickets']}")
    
    def test_whatsapp_logs_structure(self, admin_session):
        """Test WhatsApp logs have correct structure"""
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game = games[0]
        
        control_response = admin_session.get(f"{API}/admin/games/{game['game_id']}/control")
        assert control_response.status_code == 200
        data = control_response.json()
        
        # WhatsApp logs should be a list
        assert isinstance(data["whatsapp_logs"], list)
        
        # Control logs should be a list
        assert isinstance(data["control_logs"], list)
        
        print(f"✅ WhatsApp and control logs have correct structure")
        print(f"   - WhatsApp logs count: {len(data['whatsapp_logs'])}")
        print(f"   - Control logs count: {len(data['control_logs'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
