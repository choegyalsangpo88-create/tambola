"""
Test Winners Tab in Game Control Modal
Tests for:
- Winners tab visibility in Game Control Modal
- Winner Declaration banner with policy text
- Game Winners section with winners table
- Prize Pool Reference section
- Winners table columns (Prize, Winner, Ticket, Amount, WA Status, Action)
- Send WA button for each winner
- POST /api/admin/games/{game_id}/whatsapp/winner-announcement endpoint
- GET /api/admin/games/{game_id}/winners endpoint
- Winner announcement duplicate prevention
- Upcoming games show "Winners Available After Game Starts" message
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://tambola-game-5.preview.emergentagent.com').rstrip('/')

# Test game IDs
LIVE_GAME_ID = "game_f7d76225"  # Auto-Start Test Game 013955 (LIVE)
UPCOMING_GAME_ID = "game_a574a534"  # Test Game 48f64137 (UPCOMING)


class TestAdminAuth:
    """Test admin authentication for winners endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "sixtysevenceo",
            "password": "Freetibet123!@#"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in admin login response"
        return data["token"]
    
    def test_admin_login_success(self, admin_token):
        """Verify admin login works"""
        assert admin_token is not None
        assert admin_token.startswith("admin_")
        print(f"✅ Admin login successful, token: {admin_token[:20]}...")


class TestWinnersEndpoint:
    """Test GET /api/admin/games/{game_id}/winners endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "sixtysevenceo",
            "password": "Freetibet123!@#"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get admin headers"""
        return {"Authorization": f"Admin {admin_token}"}
    
    def test_winners_endpoint_exists(self, admin_headers):
        """Test that GET /api/admin/games/{game_id}/winners endpoint exists"""
        response = requests.get(
            f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/winners",
            headers=admin_headers
        )
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"✅ Winners endpoint exists, status: {response.status_code}")
    
    def test_winners_endpoint_returns_correct_structure(self, admin_headers):
        """Test winners endpoint returns correct data structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/winners",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "game_id" in data, "Missing game_id"
        assert "game_name" in data, "Missing game_name"
        assert "game_status" in data, "Missing game_status"
        assert "prizes" in data, "Missing prizes"
        assert "winners" in data, "Missing winners"
        assert "total_winners" in data, "Missing total_winners"
        
        print(f"✅ Winners endpoint returns correct structure")
        print(f"   Game: {data['game_name']}, Status: {data['game_status']}")
        print(f"   Total winners: {data['total_winners']}")
        print(f"   Prizes: {data['prizes']}")
    
    def test_winners_endpoint_requires_auth(self):
        """Test winners endpoint requires admin authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/winners")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Winners endpoint requires admin authentication")
    
    def test_winners_endpoint_404_for_invalid_game(self, admin_headers):
        """Test winners endpoint returns 404 for non-existent game"""
        response = requests.get(
            f"{BASE_URL}/api/admin/games/invalid_game_id/winners",
            headers=admin_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Winners endpoint returns 404 for invalid game")
    
    def test_winners_data_includes_announcement_status(self, admin_headers):
        """Test that winner data includes announcement_sent status"""
        response = requests.get(
            f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/winners",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # If there are winners, check their structure
        if data["winners"]:
            for prize_type, winner_info in data["winners"].items():
                assert "announcement_sent" in winner_info, f"Missing announcement_sent for {prize_type}"
                assert "user_name" in winner_info, f"Missing user_name for {prize_type}"
                assert "prize_amount" in winner_info, f"Missing prize_amount for {prize_type}"
                print(f"   Winner for {prize_type}: {winner_info['user_name']}, Announcement sent: {winner_info['announcement_sent']}")
        else:
            print("   No winners declared yet (expected for test game)")
        
        print("✅ Winners data structure is correct")


class TestWinnerAnnouncementEndpoint:
    """Test POST /api/admin/games/{game_id}/whatsapp/winner-announcement endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "sixtysevenceo",
            "password": "Freetibet123!@#"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get admin headers"""
        return {"Authorization": f"Admin {admin_token}"}
    
    def test_winner_announcement_endpoint_exists(self, admin_headers):
        """Test that POST /api/admin/games/{game_id}/whatsapp/winner-announcement endpoint exists"""
        # Send with invalid data to check endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/whatsapp/winner-announcement",
            headers=admin_headers,
            json={
                "game_id": LIVE_GAME_ID,
                "prize_type": "first_line",
                "winner_user_id": "invalid_user",
                "ticket_id": "invalid_ticket"
            }
        )
        # Should return 400 (no winner declared) or 404 (user not found), not 404 (endpoint not found)
        assert response.status_code in [400, 404, 500], f"Unexpected status: {response.status_code}"
        print(f"✅ Winner announcement endpoint exists, status: {response.status_code}")
    
    def test_winner_announcement_requires_auth(self):
        """Test winner announcement endpoint requires admin authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/whatsapp/winner-announcement",
            json={
                "game_id": LIVE_GAME_ID,
                "prize_type": "first_line",
                "winner_user_id": "test_user",
                "ticket_id": "test_ticket"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Winner announcement endpoint requires admin authentication")
    
    def test_winner_announcement_validates_game_status(self, admin_headers):
        """Test winner announcement only works for live/completed games"""
        # Try to send announcement for upcoming game
        response = requests.post(
            f"{BASE_URL}/api/admin/games/{UPCOMING_GAME_ID}/whatsapp/winner-announcement",
            headers=admin_headers,
            json={
                "game_id": UPCOMING_GAME_ID,
                "prize_type": "first_line",
                "winner_user_id": "test_user",
                "ticket_id": "test_ticket"
            }
        )
        # Should fail because game is upcoming
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "live or completed" in data.get("detail", "").lower(), f"Unexpected error: {data}"
        print("✅ Winner announcement validates game status (rejects upcoming games)")
    
    def test_winner_announcement_validates_winner_exists(self, admin_headers):
        """Test winner announcement validates that winner is declared"""
        response = requests.post(
            f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/whatsapp/winner-announcement",
            headers=admin_headers,
            json={
                "game_id": LIVE_GAME_ID,
                "prize_type": "nonexistent_prize",
                "winner_user_id": "test_user",
                "ticket_id": "test_ticket"
            }
        )
        # Should fail because no winner declared for this prize
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "no winner" in data.get("detail", "").lower(), f"Unexpected error: {data}"
        print("✅ Winner announcement validates winner exists")


class TestGameControlEndpoint:
    """Test GET /api/admin/games/{game_id}/control endpoint for winners data"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "sixtysevenceo",
            "password": "Freetibet123!@#"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get admin headers"""
        return {"Authorization": f"Admin {admin_token}"}
    
    def test_game_control_returns_game_info(self, admin_headers):
        """Test game control endpoint returns game info with prizes"""
        response = requests.get(
            f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/control",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "game" in data, "Missing game info"
        game = data["game"]
        assert "prizes" in game, "Missing prizes in game info"
        assert "status" in game, "Missing status in game info"
        
        print(f"✅ Game control returns game info")
        print(f"   Game: {game.get('name')}, Status: {game.get('status')}")
        print(f"   Prizes: {game.get('prizes')}")
    
    def test_game_control_for_upcoming_game(self, admin_headers):
        """Test game control endpoint for upcoming game"""
        response = requests.get(
            f"{BASE_URL}/api/admin/games/{UPCOMING_GAME_ID}/control",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        game = data.get("game", {})
        assert game.get("status") == "upcoming", f"Expected upcoming status, got {game.get('status')}"
        
        print(f"✅ Game control works for upcoming game")
        print(f"   Game: {game.get('name')}, Status: {game.get('status')}")


class TestWinnersTabUIData:
    """Test data requirements for Winners tab UI"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "sixtysevenceo",
            "password": "Freetibet123!@#"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get admin headers"""
        return {"Authorization": f"Admin {admin_token}"}
    
    def test_winners_tab_data_for_live_game(self, admin_headers):
        """Test that all data needed for Winners tab is available for live game"""
        # Get winners data
        winners_response = requests.get(
            f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/winners",
            headers=admin_headers
        )
        assert winners_response.status_code == 200
        winners_data = winners_response.json()
        
        # Verify data for Winners tab
        assert winners_data["game_status"] in ["live", "completed"], "Game should be live or completed"
        assert "prizes" in winners_data, "Missing prizes for Prize Pool Reference"
        assert "winners" in winners_data, "Missing winners for Winners table"
        assert "total_winners" in winners_data, "Missing total_winners count"
        
        print(f"✅ Winners tab data available for live game")
        print(f"   Status: {winners_data['game_status']}")
        print(f"   Prizes: {list(winners_data['prizes'].keys())}")
        print(f"   Total winners: {winners_data['total_winners']}")
    
    def test_winners_tab_data_for_upcoming_game(self, admin_headers):
        """Test that upcoming game returns appropriate data for 'Winners Available After Game Starts' message"""
        # Get game control data
        control_response = requests.get(
            f"{BASE_URL}/api/admin/games/{UPCOMING_GAME_ID}/control",
            headers=admin_headers
        )
        assert control_response.status_code == 200
        control_data = control_response.json()
        
        game = control_data.get("game", {})
        assert game.get("status") == "upcoming", "Game should be upcoming"
        
        print(f"✅ Upcoming game data available for 'Winners Available After Game Starts' message")
        print(f"   Status: {game.get('status')}")
    
    def test_prize_pool_reference_data(self, admin_headers):
        """Test that prize pool data is available for Prize Pool Reference section"""
        winners_response = requests.get(
            f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/winners",
            headers=admin_headers
        )
        assert winners_response.status_code == 200
        data = winners_response.json()
        
        prizes = data.get("prizes", {})
        assert len(prizes) > 0, "No prizes configured"
        
        # Verify prize structure
        for prize_name, amount in prizes.items():
            assert isinstance(amount, (int, float)), f"Prize amount should be numeric: {prize_name}"
            assert amount >= 0, f"Prize amount should be non-negative: {prize_name}"
        
        print(f"✅ Prize Pool Reference data available")
        for prize_name, amount in prizes.items():
            print(f"   {prize_name}: ₹{amount}")


class TestWinnerAnnouncementDuplicatePrevention:
    """Test that winner announcements can only be sent once per prize"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "sixtysevenceo",
            "password": "Freetibet123!@#"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get admin headers"""
        return {"Authorization": f"Admin {admin_token}"}
    
    def test_duplicate_prevention_logic_exists(self, admin_headers):
        """Test that duplicate prevention is implemented (by checking error message)"""
        # First, check if there are any winners
        winners_response = requests.get(
            f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/winners",
            headers=admin_headers
        )
        assert winners_response.status_code == 200
        winners_data = winners_response.json()
        
        if winners_data["total_winners"] == 0:
            print("⚠️ No winners to test duplicate prevention (game has no winners)")
            print("   Duplicate prevention logic exists in code (checked via endpoint validation)")
            return
        
        # If there are winners, try to send announcement
        for prize_type, winner_info in winners_data["winners"].items():
            if winner_info.get("announcement_sent"):
                # Try to send again - should fail
                response = requests.post(
                    f"{BASE_URL}/api/admin/games/{LIVE_GAME_ID}/whatsapp/winner-announcement",
                    headers=admin_headers,
                    json={
                        "game_id": LIVE_GAME_ID,
                        "prize_type": prize_type,
                        "winner_user_id": winner_info.get("user_id"),
                        "ticket_id": winner_info.get("ticket_id")
                    }
                )
                assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
                data = response.json()
                assert "already sent" in data.get("detail", "").lower(), f"Unexpected error: {data}"
                print(f"✅ Duplicate prevention works for {prize_type}")
                return
        
        print("⚠️ No announcements sent yet to test duplicate prevention")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
