"""
Admin Panel Tests for Tambola Game
Tests: Admin login, Create Game, Manage Games, Start/End Game
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://indian-housie.preview.emergentagent.com')

# Admin credentials
ADMIN_USERNAME = "sixtysevenceo"
ADMIN_PASSWORD = "Freetibet123!@#"


class TestAdminAuthentication:
    """Test admin login and authentication"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "token" in data
        assert data["token"].startswith("admin_")
        print(f"✅ Admin login successful, token: {data['token'][:20]}...")
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"username": "wronguser", "password": "wrongpass"}
        )
        assert response.status_code == 401
        print("✅ Invalid credentials correctly rejected")
    
    def test_admin_verify_valid_session(self):
        """Test admin session verification"""
        # First login
        login_resp = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        token = login_resp.json()["token"]
        
        # Verify session
        response = requests.get(
            f"{BASE_URL}/api/admin/verify",
            headers={"Authorization": f"Admin {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == True
        print("✅ Admin session verification successful")


class TestGameCRUD:
    """Test game creation, reading, updating, and deletion"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_create_game_success(self, admin_token):
        """Test creating a new game with all required fields"""
        game_name = f"Test Game {uuid.uuid4().hex[:8]}"
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        game_data = {
            "name": game_name,
            "date": tomorrow,
            "time": "20:00",
            "price": 50,
            "total_tickets": 600,
            "prizes": {
                "Quick Five": 500,
                "Top Line": 200,
                "Middle Line": 200,
                "Bottom Line": 200,
                "Full House": 2000
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/games",
            json=game_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "game_id" in data
        assert data["name"] == game_name
        assert data["date"] == tomorrow
        assert data["time"] == "20:00"
        assert data["price"] == 50
        assert data["status"] == "upcoming"
        assert data["ticket_count"] == 600
        assert data["available_tickets"] == 600
        
        # Verify prizes
        assert "prizes" in data
        assert data["prizes"]["Quick Five"] == 500
        assert data["prizes"]["Full House"] == 2000
        
        print(f"✅ Game created successfully: {data['game_id']}")
        return data["game_id"]
    
    def test_create_game_with_custom_tickets(self, admin_token):
        """Test creating a game with custom ticket count (must be multiple of 6)"""
        game_name = f"Custom Tickets Game {uuid.uuid4().hex[:8]}"
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        game_data = {
            "name": game_name,
            "date": tomorrow,
            "time": "21:00",
            "price": 100,
            "total_tickets": 120,  # 20 full sheets
            "prizes": {
                "Top Line": 500,
                "Full House": 3000
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/games", json=game_data)
        assert response.status_code == 200
        data = response.json()
        assert data["ticket_count"] == 120
        print(f"✅ Game with custom tickets created: {data['game_id']}")
    
    def test_create_game_invalid_tickets(self, admin_token):
        """Test that ticket count must be multiple of 6"""
        game_data = {
            "name": "Invalid Tickets Game",
            "date": "2025-01-20",
            "time": "20:00",
            "price": 50,
            "total_tickets": 100,  # Not multiple of 6
            "prizes": {"Full House": 1000}
        }
        
        response = requests.post(f"{BASE_URL}/api/games", json=game_data)
        assert response.status_code == 400
        assert "multiple of 6" in response.json()["detail"]
        print("✅ Invalid ticket count correctly rejected")
    
    def test_get_all_games(self):
        """Test fetching all games"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} games")
    
    def test_get_game_by_id(self, admin_token):
        """Test fetching a specific game by ID"""
        # First create a game
        game_name = f"Get By ID Test {uuid.uuid4().hex[:8]}"
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        create_resp = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "name": game_name,
                "date": tomorrow,
                "time": "19:00",
                "price": 50,
                "total_tickets": 60,
                "prizes": {"Full House": 1000}
            }
        )
        game_id = create_resp.json()["game_id"]
        
        # Get the game
        response = requests.get(f"{BASE_URL}/api/games/{game_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["game_id"] == game_id
        assert data["name"] == game_name
        print(f"✅ Game retrieved by ID: {game_id}")
    
    def test_update_game(self, admin_token):
        """Test updating an upcoming game"""
        # Create a game first
        game_name = f"Update Test {uuid.uuid4().hex[:8]}"
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        create_resp = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "name": game_name,
                "date": tomorrow,
                "time": "18:00",
                "price": 50,
                "total_tickets": 60,
                "prizes": {"Full House": 1000}
            }
        )
        game_id = create_resp.json()["game_id"]
        
        # Update the game
        updated_name = f"Updated {game_name}"
        response = requests.put(
            f"{BASE_URL}/api/games/{game_id}",
            json={
                "name": updated_name,
                "date": tomorrow,
                "time": "19:30",
                "price": 75,
                "total_tickets": 60,
                "prizes": {"Full House": 1500, "Top Line": 500}
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == updated_name
        assert data["price"] == 75
        assert data["prizes"]["Full House"] == 1500
        print(f"✅ Game updated successfully: {game_id}")


class TestGameLifecycle:
    """Test game status transitions: upcoming → live → completed"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    @pytest.fixture
    def upcoming_game(self, admin_token):
        """Create an upcoming game for testing"""
        game_name = f"Lifecycle Test {uuid.uuid4().hex[:8]}"
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "name": game_name,
                "date": tomorrow,
                "time": "20:00",
                "price": 50,
                "total_tickets": 60,
                "prizes": {"Full House": 1000}
            }
        )
        return response.json()
    
    def test_start_game(self, admin_token, upcoming_game):
        """Test starting an upcoming game (upcoming → live)"""
        game_id = upcoming_game["game_id"]
        
        # Verify initial status
        assert upcoming_game["status"] == "upcoming"
        
        # Start the game
        response = requests.post(f"{BASE_URL}/api/games/{game_id}/start")
        assert response.status_code == 200
        
        # Verify status changed to live
        game_resp = requests.get(f"{BASE_URL}/api/games/{game_id}")
        assert game_resp.status_code == 200
        assert game_resp.json()["status"] == "live"
        
        # Verify game session was created
        session_resp = requests.get(f"{BASE_URL}/api/games/{game_id}/session")
        assert session_resp.status_code == 200
        session = session_resp.json()
        assert session["game_id"] == game_id
        assert session["called_numbers"] == []
        assert session["winners"] == {}
        
        print(f"✅ Game started successfully: {game_id}")
    
    def test_end_game(self, admin_token, upcoming_game):
        """Test ending a live game (live → completed)"""
        game_id = upcoming_game["game_id"]
        
        # Start the game first
        requests.post(f"{BASE_URL}/api/games/{game_id}/start")
        
        # End the game
        response = requests.post(f"{BASE_URL}/api/games/{game_id}/end")
        assert response.status_code == 200
        
        # Verify status changed to completed
        game_resp = requests.get(f"{BASE_URL}/api/games/{game_id}")
        assert game_resp.status_code == 200
        game_data = game_resp.json()
        assert game_data["status"] == "completed"
        
        print(f"✅ Game ended successfully: {game_id}")
    
    def test_cannot_edit_live_game(self, admin_token, upcoming_game):
        """Test that live games cannot be edited"""
        game_id = upcoming_game["game_id"]
        
        # Start the game
        requests.post(f"{BASE_URL}/api/games/{game_id}/start")
        
        # Try to update
        response = requests.put(
            f"{BASE_URL}/api/games/{game_id}",
            json={
                "name": "Should Fail",
                "date": "2025-01-20",
                "time": "20:00",
                "price": 100,
                "total_tickets": 60,
                "prizes": {"Full House": 2000}
            }
        )
        
        assert response.status_code == 400
        assert "upcoming" in response.json()["detail"].lower()
        print("✅ Live game edit correctly rejected")


class TestAdminGameManagement:
    """Test admin-specific game management features"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_delete_upcoming_game(self, admin_token):
        """Test deleting an upcoming game"""
        # Create a game
        game_name = f"Delete Test {uuid.uuid4().hex[:8]}"
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        create_resp = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "name": game_name,
                "date": tomorrow,
                "time": "20:00",
                "price": 50,
                "total_tickets": 60,
                "prizes": {"Full House": 1000}
            }
        )
        game_id = create_resp.json()["game_id"]
        
        # Delete the game
        response = requests.delete(
            f"{BASE_URL}/api/admin/games/{game_id}",
            headers={"Authorization": f"Admin {admin_token}"}
        )
        
        assert response.status_code == 200
        
        # Verify game is deleted
        get_resp = requests.get(f"{BASE_URL}/api/games/{game_id}")
        assert get_resp.status_code == 404
        
        print(f"✅ Game deleted successfully: {game_id}")
    
    def test_delete_live_game_requires_force(self, admin_token):
        """Test that deleting a live game requires force flag"""
        # Create and start a game
        game_name = f"Force Delete Test {uuid.uuid4().hex[:8]}"
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        create_resp = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "name": game_name,
                "date": tomorrow,
                "time": "20:00",
                "price": 50,
                "total_tickets": 60,
                "prizes": {"Full House": 1000}
            }
        )
        game_id = create_resp.json()["game_id"]
        
        # Start the game
        requests.post(f"{BASE_URL}/api/games/{game_id}/start")
        
        # Try to delete without force
        response = requests.delete(
            f"{BASE_URL}/api/admin/games/{game_id}",
            headers={"Authorization": f"Admin {admin_token}"}
        )
        assert response.status_code == 400
        
        # Delete with force
        response = requests.delete(
            f"{BASE_URL}/api/admin/games/{game_id}?force=true",
            headers={"Authorization": f"Admin {admin_token}"}
        )
        assert response.status_code == 200
        
        print("✅ Force delete of live game successful")
    
    def test_get_game_tickets_admin(self, admin_token):
        """Test admin endpoint to get all tickets for a game"""
        # Create a game
        game_name = f"Tickets Admin Test {uuid.uuid4().hex[:8]}"
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        create_resp = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "name": game_name,
                "date": tomorrow,
                "time": "20:00",
                "price": 50,
                "total_tickets": 60,
                "prizes": {"Full House": 1000}
            }
        )
        game_id = create_resp.json()["game_id"]
        
        # Get tickets
        response = requests.get(
            f"{BASE_URL}/api/admin/games/{game_id}/tickets",
            headers={"Authorization": f"Admin {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        assert data["total"] == 60
        assert len(data["tickets"]) == 60
        
        # Verify ticket structure
        ticket = data["tickets"][0]
        assert "ticket_id" in ticket
        assert "ticket_number" in ticket
        assert "full_sheet_id" in ticket
        assert "numbers" in ticket
        assert "is_booked" in ticket
        
        print(f"✅ Admin tickets endpoint working: {data['total']} tickets")


class TestGameSession:
    """Test live game session functionality"""
    
    @pytest.fixture
    def live_game(self):
        """Create and start a game for testing"""
        game_name = f"Session Test {uuid.uuid4().hex[:8]}"
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        create_resp = requests.post(
            f"{BASE_URL}/api/games",
            json={
                "name": game_name,
                "date": tomorrow,
                "time": "20:00",
                "price": 50,
                "total_tickets": 60,
                "prizes": {"Full House": 1000}
            }
        )
        game_id = create_resp.json()["game_id"]
        
        # Start the game
        requests.post(f"{BASE_URL}/api/games/{game_id}/start")
        
        return game_id
    
    def test_call_number(self, live_game):
        """Test calling numbers in a live game"""
        game_id = live_game
        
        # Call a number
        response = requests.post(f"{BASE_URL}/api/games/{game_id}/call-number")
        assert response.status_code == 200
        data = response.json()
        
        assert "number" in data
        assert 1 <= data["number"] <= 90
        assert "called_numbers" in data
        assert len(data["called_numbers"]) == 1
        
        print(f"✅ Number called: {data['number']}")
    
    def test_get_session(self, live_game):
        """Test getting game session data"""
        game_id = live_game
        
        # Call some numbers first
        for _ in range(5):
            requests.post(f"{BASE_URL}/api/games/{game_id}/call-number")
        
        # Get session
        response = requests.get(f"{BASE_URL}/api/games/{game_id}/session")
        assert response.status_code == 200
        data = response.json()
        
        assert data["game_id"] == game_id
        assert len(data["called_numbers"]) == 5
        assert "current_number" in data
        assert "winners" in data
        
        print(f"✅ Session retrieved: {len(data['called_numbers'])} numbers called")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
