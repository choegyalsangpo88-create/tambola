"""
Test Audio Caller Feature for Tambola PWA
Tests:
1. CreateUserGame with audio_only mode
2. GET /api/user-games/{id}/poll - lightweight polling
3. GET /api/user-games/share/{code}/poll - public polling by share code
4. Audio Caller game flow (start, call numbers, end)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_audio_1769612079735"
USER_ID = "test-user-audio-1769612079735"


class TestAudioCallerBackend:
    """Test Audio Caller backend endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.headers = {
            "Authorization": f"Bearer {SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
        self.created_game_id = None
        self.share_code = None
    
    def test_01_auth_works(self):
        """Verify authentication is working"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        print(f"Auth response: {response.status_code}")
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert data.get("user_id") == USER_ID
        print(f"✓ Auth working for user: {data.get('name')}")
    
    def test_02_create_digital_game(self):
        """Test creating a digital tickets game (default mode)"""
        payload = {
            "name": "Test Digital Game",
            "date": "2026-02-15",
            "time": "18:00",
            "max_tickets": 30,
            "prizes_description": "Top Line: ₹200\nFull House: ₹500",
            "audio_only": False,
            "call_interval": 8
        }
        response = requests.post(
            f"{BASE_URL}/api/user-games",
            json=payload,
            headers=self.headers
        )
        print(f"Create digital game response: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "user_game_id" in data
        assert data.get("audio_only") == False
        assert data.get("call_interval") == 8
        print(f"✓ Digital game created: {data.get('user_game_id')}")
        
        # Store for cleanup
        TestAudioCallerBackend.digital_game_id = data.get("user_game_id")
    
    def test_03_create_audio_only_game(self):
        """Test creating an audio-only game"""
        payload = {
            "name": "Test Audio Caller Game",
            "date": "2026-02-20",
            "time": "19:00",
            "max_tickets": 0,  # Audio-only mode doesn't need tickets
            "prizes_description": "Audio-only mode",
            "audio_only": True,
            "call_interval": 10  # Custom interval
        }
        response = requests.post(
            f"{BASE_URL}/api/user-games",
            json=payload,
            headers=self.headers
        )
        print(f"Create audio game response: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "user_game_id" in data
        assert data.get("audio_only") == True, "audio_only should be True"
        assert data.get("call_interval") == 10, "call_interval should be 10"
        assert "share_code" in data, "share_code should be present"
        
        # Store for subsequent tests
        TestAudioCallerBackend.audio_game_id = data.get("user_game_id")
        TestAudioCallerBackend.share_code = data.get("share_code")
        
        print(f"✓ Audio-only game created: {data.get('user_game_id')}")
        print(f"  Share code: {data.get('share_code')}")
        print(f"  audio_only: {data.get('audio_only')}")
        print(f"  call_interval: {data.get('call_interval')}")
    
    def test_04_get_audio_game_details(self):
        """Test fetching audio game details"""
        game_id = getattr(TestAudioCallerBackend, 'audio_game_id', None)
        assert game_id, "Audio game ID not found from previous test"
        
        response = requests.get(f"{BASE_URL}/api/user-games/{game_id}")
        print(f"Get game response: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("audio_only") == True
        assert data.get("call_interval") == 10
        assert data.get("status") == "upcoming"
        print(f"✓ Audio game details verified")
    
    def test_05_poll_user_game_by_id(self):
        """Test GET /api/user-games/{id}/poll - lightweight polling"""
        game_id = getattr(TestAudioCallerBackend, 'audio_game_id', None)
        assert game_id, "Audio game ID not found"
        
        response = requests.get(f"{BASE_URL}/api/user-games/{game_id}/poll?last_count=0")
        print(f"Poll by ID response: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify required fields for poll endpoint
        assert "status" in data, "status field missing"
        assert "audio_only" in data, "audio_only field missing"
        assert "call_interval" in data, "call_interval field missing"
        assert "total_called" in data, "total_called field missing"
        assert "new_numbers" in data, "new_numbers field missing"
        assert "all_called_numbers" in data, "all_called_numbers field missing"
        assert "current_number" in data, "current_number field missing"
        assert "has_changes" in data, "has_changes field missing"
        
        assert data.get("audio_only") == True
        assert data.get("call_interval") == 10
        assert data.get("total_called") == 0
        assert data.get("has_changes") == False
        
        print(f"✓ Poll by ID endpoint working correctly")
        print(f"  Fields returned: {list(data.keys())}")
    
    def test_06_poll_user_game_by_share_code(self):
        """Test GET /api/user-games/share/{code}/poll - public polling"""
        share_code = getattr(TestAudioCallerBackend, 'share_code', None)
        assert share_code, "Share code not found"
        
        # This endpoint should work WITHOUT authentication
        response = requests.get(
            f"{BASE_URL}/api/user-games/share/{share_code}/poll?last_count=0"
        )
        print(f"Poll by share code response: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify required fields
        assert "user_game_id" in data, "user_game_id field missing"
        assert "status" in data, "status field missing"
        assert "audio_only" in data, "audio_only field missing"
        assert "call_interval" in data, "call_interval field missing"
        assert "total_called" in data, "total_called field missing"
        assert "all_called_numbers" in data, "all_called_numbers field missing"
        assert "has_changes" in data, "has_changes field missing"
        
        print(f"✓ Poll by share code endpoint working (no auth required)")
        print(f"  Fields returned: {list(data.keys())}")
    
    def test_07_start_audio_game(self):
        """Test starting an audio-only game"""
        game_id = getattr(TestAudioCallerBackend, 'audio_game_id', None)
        assert game_id, "Audio game ID not found"
        
        response = requests.post(
            f"{BASE_URL}/api/user-games/{game_id}/start",
            headers=self.headers
        )
        print(f"Start game response: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "live"
        print(f"✓ Audio game started successfully")
    
    def test_08_call_number_in_audio_game(self):
        """Test calling numbers in audio-only game"""
        game_id = getattr(TestAudioCallerBackend, 'audio_game_id', None)
        assert game_id, "Audio game ID not found"
        
        # Call 3 numbers
        called_numbers = []
        for i in range(3):
            response = requests.post(
                f"{BASE_URL}/api/user-games/{game_id}/call-number",
                headers=self.headers
            )
            print(f"Call number {i+1} response: {response.status_code}")
            assert response.status_code == 200, f"Failed: {response.text}"
            
            data = response.json()
            assert "current_number" in data
            called_numbers.append(data.get("current_number"))
            time.sleep(0.2)  # Small delay between calls
        
        print(f"✓ Called numbers: {called_numbers}")
        
        # Verify poll shows the called numbers
        response = requests.get(f"{BASE_URL}/api/user-games/{game_id}/poll?last_count=0")
        assert response.status_code == 200
        data = response.json()
        assert data.get("total_called") == 3
        assert len(data.get("all_called_numbers", [])) == 3
        print(f"✓ Poll shows {data.get('total_called')} called numbers")
    
    def test_09_poll_delta_updates(self):
        """Test poll endpoint returns delta updates correctly"""
        game_id = getattr(TestAudioCallerBackend, 'audio_game_id', None)
        assert game_id, "Audio game ID not found"
        
        # Poll with last_count=2 (should return only 1 new number)
        response = requests.get(f"{BASE_URL}/api/user-games/{game_id}/poll?last_count=2")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("total_called") == 3
        assert len(data.get("new_numbers", [])) == 1, "Should return 1 new number"
        assert data.get("has_changes") == True
        
        print(f"✓ Delta update working: new_numbers={data.get('new_numbers')}")
        
        # Poll with current count (should return no new numbers)
        response = requests.get(f"{BASE_URL}/api/user-games/{game_id}/poll?last_count=3")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data.get("new_numbers", [])) == 0
        assert data.get("has_changes") == False
        print(f"✓ No changes when last_count matches total_called")
    
    def test_10_public_poll_during_live_game(self):
        """Test public poll endpoint during live game"""
        share_code = getattr(TestAudioCallerBackend, 'share_code', None)
        assert share_code, "Share code not found"
        
        response = requests.get(
            f"{BASE_URL}/api/user-games/share/{share_code}/poll?last_count=0"
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("status") == "live"
        assert data.get("total_called") == 3
        assert len(data.get("all_called_numbers", [])) == 3
        
        print(f"✓ Public poll shows live game with {data.get('total_called')} numbers")
    
    def test_11_end_audio_game(self):
        """Test ending an audio-only game"""
        game_id = getattr(TestAudioCallerBackend, 'audio_game_id', None)
        assert game_id, "Audio game ID not found"
        
        response = requests.post(
            f"{BASE_URL}/api/user-games/{game_id}/end",
            headers=self.headers
        )
        print(f"End game response: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "completed"
        print(f"✓ Audio game ended successfully")
    
    def test_12_poll_completed_game(self):
        """Test poll endpoint for completed game"""
        game_id = getattr(TestAudioCallerBackend, 'audio_game_id', None)
        assert game_id, "Audio game ID not found"
        
        response = requests.get(f"{BASE_URL}/api/user-games/{game_id}/poll?last_count=0")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("status") == "completed"
        print(f"✓ Poll shows completed status")
    
    def test_13_poll_nonexistent_game(self):
        """Test poll endpoint returns 404 for non-existent game"""
        response = requests.get(f"{BASE_URL}/api/user-games/nonexistent123/poll")
        assert response.status_code == 404
        print(f"✓ Poll returns 404 for non-existent game")
    
    def test_14_poll_nonexistent_share_code(self):
        """Test public poll returns 404 for invalid share code"""
        response = requests.get(f"{BASE_URL}/api/user-games/share/INVALID123/poll")
        assert response.status_code == 404
        print(f"✓ Public poll returns 404 for invalid share code")
    
    def test_15_create_game_default_call_interval(self):
        """Test that default call_interval is 8 seconds"""
        payload = {
            "name": "Test Default Interval Game",
            "date": "2026-02-25",
            "time": "20:00",
            "max_tickets": 30,
            "prizes_description": "Test prizes",
            "audio_only": False
            # Not specifying call_interval - should default to 8
        }
        response = requests.post(
            f"{BASE_URL}/api/user-games",
            json=payload,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("call_interval") == 8, f"Default call_interval should be 8, got {data.get('call_interval')}"
        print(f"✓ Default call_interval is 8 seconds")
        
        # Store for cleanup
        TestAudioCallerBackend.default_interval_game_id = data.get("user_game_id")
    
    def test_16_cleanup_test_games(self):
        """Cleanup test games"""
        game_ids = [
            getattr(TestAudioCallerBackend, 'digital_game_id', None),
            getattr(TestAudioCallerBackend, 'audio_game_id', None),
            getattr(TestAudioCallerBackend, 'default_interval_game_id', None)
        ]
        
        for game_id in game_ids:
            if game_id:
                response = requests.delete(
                    f"{BASE_URL}/api/user-games/{game_id}",
                    headers=self.headers
                )
                print(f"Cleanup {game_id}: {response.status_code}")
        
        print(f"✓ Test games cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
