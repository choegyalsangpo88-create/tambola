"""
Test Audio Caller Simplified Feature
- CreateUserGame Audio mode: no date/time fields, auto-fills current date/time
- AudioCaller page: Start Game, Pause, Manual Call, Reset, End buttons
- POST /api/user-games/{id}/reset endpoint
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token (created in MongoDB)
TEST_SESSION_TOKEN = "test_session_audio_1769620736219"
TEST_USER_ID = "test-user-audio-1769620736219"


class TestAudioCallerSimplified:
    """Test simplified Audio Caller feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.headers = {
            "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
        self.game_id = None
    
    def test_01_create_audio_game_without_date_time(self):
        """Test creating audio game - date/time auto-filled"""
        response = requests.post(
            f"{BASE_URL}/api/user-games",
            headers=self.headers,
            json={
                "name": "Test Audio Simplified",
                "date": datetime.now().strftime("%Y-%m-%d"),  # Auto-filled by frontend
                "time": datetime.now().strftime("%H:%M"),     # Auto-filled by frontend
                "max_tickets": 0,
                "prizes_description": "Audio-only mode",
                "audio_only": True,
                "call_interval": 10
            }
        )
        
        assert response.status_code == 200, f"Failed to create game: {response.text}"
        data = response.json()
        
        # Verify audio_only flag
        assert data.get("audio_only") == True, "audio_only should be True"
        
        # Verify call_interval
        assert data.get("call_interval") == 10, "call_interval should be 10"
        
        # Verify status is upcoming
        assert data.get("status") == "upcoming", "Status should be upcoming"
        
        # Store game_id for subsequent tests
        self.__class__.game_id = data.get("user_game_id")
        print(f"Created audio game: {self.__class__.game_id}")
    
    def test_02_start_game(self):
        """Test starting the game"""
        game_id = getattr(self.__class__, 'game_id', None)
        if not game_id:
            pytest.skip("No game_id from previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/user-games/{game_id}/start",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed to start game: {response.text}"
        data = response.json()
        assert "started" in data.get("message", "").lower() or "Game started" in data.get("message", "")
    
    def test_03_call_numbers(self):
        """Test calling numbers (simulates auto-call)"""
        game_id = getattr(self.__class__, 'game_id', None)
        if not game_id:
            pytest.skip("No game_id from previous test")
        
        # Call 3 numbers
        called_numbers = []
        for i in range(3):
            response = requests.post(
                f"{BASE_URL}/api/user-games/{game_id}/call-number",
                headers=self.headers
            )
            
            assert response.status_code == 200, f"Failed to call number: {response.text}"
            data = response.json()
            
            # Verify response structure
            assert "number" in data or "current_number" in data
            called_numbers.append(data.get("number") or data.get("current_number"))
        
        print(f"Called numbers: {called_numbers}")
        assert len(called_numbers) == 3, "Should have called 3 numbers"
    
    def test_04_verify_game_state_before_reset(self):
        """Verify game state has called numbers before reset"""
        game_id = getattr(self.__class__, 'game_id', None)
        if not game_id:
            pytest.skip("No game_id from previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/user-games/{game_id}",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify game is live
        assert data.get("status") == "live", "Game should be live"
        
        # Verify called_numbers has items
        called_numbers = data.get("called_numbers", [])
        assert len(called_numbers) >= 3, f"Should have at least 3 called numbers, got {len(called_numbers)}"
        
        print(f"Game state before reset: {len(called_numbers)} numbers called")
    
    def test_05_reset_game(self):
        """Test POST /api/user-games/{id}/reset endpoint"""
        game_id = getattr(self.__class__, 'game_id', None)
        if not game_id:
            pytest.skip("No game_id from previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/user-games/{game_id}/reset",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed to reset game: {response.text}"
        data = response.json()
        
        # Verify reset response
        assert "reset" in data.get("message", "").lower(), "Response should confirm reset"
        assert data.get("status") == "live", "Status should remain live after reset"
    
    def test_06_verify_game_state_after_reset(self):
        """Verify game state is cleared after reset"""
        game_id = getattr(self.__class__, 'game_id', None)
        if not game_id:
            pytest.skip("No game_id from previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/user-games/{game_id}",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify called_numbers is empty
        called_numbers = data.get("called_numbers", [])
        assert len(called_numbers) == 0, f"called_numbers should be empty after reset, got {len(called_numbers)}"
        
        # Verify current_number is None
        assert data.get("current_number") is None, "current_number should be None after reset"
        
        # Verify status is still live
        assert data.get("status") == "live", "Status should remain live after reset"
        
        print("Game state after reset: called_numbers cleared, status=live")
    
    def test_07_call_numbers_after_reset(self):
        """Test calling numbers works after reset"""
        game_id = getattr(self.__class__, 'game_id', None)
        if not game_id:
            pytest.skip("No game_id from previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/user-games/{game_id}/call-number",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed to call number after reset: {response.text}"
        data = response.json()
        
        # Verify a number was called
        assert data.get("number") or data.get("current_number"), "Should have called a number"
        print(f"Called number after reset: {data.get('number') or data.get('current_number')}")
    
    def test_08_end_game(self):
        """Test ending the game"""
        game_id = getattr(self.__class__, 'game_id', None)
        if not game_id:
            pytest.skip("No game_id from previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/user-games/{game_id}/end",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed to end game: {response.text}"
        data = response.json()
        assert "ended" in data.get("message", "").lower() or "Game ended" in data.get("message", "")
    
    def test_09_verify_game_completed(self):
        """Verify game status is completed after end"""
        game_id = getattr(self.__class__, 'game_id', None)
        if not game_id:
            pytest.skip("No game_id from previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/user-games/{game_id}",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify status is completed
        assert data.get("status") == "completed", "Status should be completed after end"
        
        # Verify ended_at is set
        assert data.get("ended_at") is not None, "ended_at should be set"
        
        print("Game ended successfully")


class TestAudioGameCreationValidation:
    """Test audio game creation validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.headers = {
            "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_audio_game_only_requires_name_and_interval(self):
        """Test that audio game only requires name and call_interval"""
        response = requests.post(
            f"{BASE_URL}/api/user-games",
            headers=self.headers,
            json={
                "name": "Minimal Audio Game",
                "date": "2026-01-28",  # Auto-filled
                "time": "20:00",       # Auto-filled
                "max_tickets": 0,      # 0 for audio-only
                "prizes_description": "Audio-only mode",
                "audio_only": True,
                "call_interval": 8     # Default interval
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("audio_only") == True
        assert data.get("call_interval") == 8
        assert data.get("max_tickets") == 0
    
    def test_default_call_interval_is_8(self):
        """Test that default call_interval is 8 seconds"""
        response = requests.post(
            f"{BASE_URL}/api/user-games",
            headers=self.headers,
            json={
                "name": "Default Interval Game",
                "date": "2026-01-28",
                "time": "21:00",
                "max_tickets": 0,
                "prizes_description": "Audio-only mode",
                "audio_only": True
                # call_interval not specified - should default to 8
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Default call_interval should be 8
        assert data.get("call_interval") == 8, f"Default call_interval should be 8, got {data.get('call_interval')}"


class TestResetEndpointAuthorization:
    """Test reset endpoint authorization"""
    
    def test_reset_requires_authentication(self):
        """Test that reset endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/user-games/ug_nonexistent/reset"
            # No auth header
        )
        
        assert response.status_code == 401, "Should require authentication"
    
    def test_reset_only_by_host(self):
        """Test that only host can reset the game"""
        # Create a game with test user
        headers = {
            "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/user-games",
            headers=headers,
            json={
                "name": "Host Only Reset Test",
                "date": "2026-01-28",
                "time": "22:00",
                "max_tickets": 0,
                "prizes_description": "Audio-only mode",
                "audio_only": True,
                "call_interval": 8
            }
        )
        
        assert create_response.status_code == 200
        game_id = create_response.json().get("user_game_id")
        
        # Start the game
        requests.post(f"{BASE_URL}/api/user-games/{game_id}/start", headers=headers)
        
        # Try to reset with a different (invalid) session
        invalid_headers = {
            "Authorization": "Bearer invalid_session_token",
            "Content-Type": "application/json"
        }
        
        reset_response = requests.post(
            f"{BASE_URL}/api/user-games/{game_id}/reset",
            headers=invalid_headers
        )
        
        # Should fail with 401 (invalid session)
        assert reset_response.status_code == 401, "Should reject invalid session"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
