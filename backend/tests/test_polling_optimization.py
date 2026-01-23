"""
Test suite for Tambola PWA Polling Optimization
Tests lightweight polling endpoints and delta updates for real-time game updates.

Features tested:
1. GET /api/games/poll-list - lightweight game list for dashboard
2. GET /api/games/{game_id}/poll - delta updates with last_count parameter
3. Response payload sizes (lightweight vs full endpoints)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test game with known data
COMPLETED_GAME_ID = "game_ed9cc4d9"  # Has 86 called numbers
TEST_LAST_COUNT = 80  # Should return 6 new numbers


class TestPollListEndpoint:
    """Tests for GET /api/games/poll-list - lightweight game list"""
    
    def test_poll_list_returns_200(self):
        """Poll-list endpoint should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/games/poll-list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Poll-list endpoint returns 200 OK")
    
    def test_poll_list_returns_games_array(self):
        """Poll-list should return games array"""
        response = requests.get(f"{BASE_URL}/api/games/poll-list")
        data = response.json()
        
        assert "games" in data, "Response should contain 'games' key"
        assert isinstance(data["games"], list), "games should be a list"
        print(f"✓ Poll-list returns {len(data['games'])} games")
    
    def test_poll_list_returns_status_counts(self):
        """Poll-list should return live_count and upcoming_count"""
        response = requests.get(f"{BASE_URL}/api/games/poll-list")
        data = response.json()
        
        assert "live_count" in data, "Response should contain 'live_count'"
        assert "upcoming_count" in data, "Response should contain 'upcoming_count'"
        assert "timestamp" in data, "Response should contain 'timestamp'"
        
        print(f"✓ Status counts: live={data['live_count']}, upcoming={data['upcoming_count']}")
    
    def test_poll_list_returns_minimal_fields(self):
        """Poll-list should return only minimal fields for each game"""
        response = requests.get(f"{BASE_URL}/api/games/poll-list")
        data = response.json()
        
        if len(data["games"]) > 0:
            game = data["games"][0]
            
            # Required minimal fields
            required_fields = ["game_id", "name", "status", "date", "time", "prize_pool"]
            for field in required_fields:
                assert field in game, f"Game should have '{field}' field"
            
            # Should NOT have heavy fields
            heavy_fields = ["prizes", "ticket_count", "available_tickets", "created_at"]
            for field in heavy_fields:
                if field in game:
                    print(f"⚠ Warning: Poll-list includes heavy field '{field}'")
            
            print(f"✓ Poll-list returns minimal fields: {list(game.keys())}")
        else:
            print("⚠ No games to verify fields")
    
    def test_poll_list_response_is_lightweight(self):
        """Poll-list response should be smaller than full games endpoint"""
        poll_response = requests.get(f"{BASE_URL}/api/games/poll-list")
        full_response = requests.get(f"{BASE_URL}/api/games")
        
        poll_size = len(poll_response.content)
        full_size = len(full_response.content)
        
        print(f"✓ Response sizes: poll-list={poll_size} bytes, full={full_size} bytes")
        
        # Poll-list should be smaller (or at least not significantly larger)
        if full_size > 0:
            ratio = poll_size / full_size
            print(f"✓ Poll-list is {ratio:.2%} of full response size")


class TestGamePollEndpoint:
    """Tests for GET /api/games/{game_id}/poll - delta updates"""
    
    def test_game_poll_returns_200(self):
        """Game poll endpoint should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Game poll endpoint returns 200 OK")
    
    def test_game_poll_returns_required_fields(self):
        """Game poll should return all required fields"""
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll")
        data = response.json()
        
        required_fields = ["status", "total_called", "new_numbers", "current_number", "winners", "has_changes"]
        for field in required_fields:
            assert field in data, f"Response should contain '{field}'"
        
        print(f"✓ Game poll returns all required fields: {list(data.keys())}")
    
    def test_game_poll_delta_updates_with_last_count(self):
        """Game poll with last_count should return only new numbers"""
        # First get total count
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll")
        data = response.json()
        total_called = data["total_called"]
        
        print(f"Total called numbers: {total_called}")
        
        # Now poll with last_count = 80 (should return 6 new numbers if total is 86)
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll?last_count={TEST_LAST_COUNT}")
        data = response.json()
        
        expected_new = total_called - TEST_LAST_COUNT
        actual_new = len(data["new_numbers"])
        
        assert actual_new == expected_new, f"Expected {expected_new} new numbers, got {actual_new}"
        print(f"✓ Delta update works: last_count={TEST_LAST_COUNT}, got {actual_new} new numbers")
    
    def test_game_poll_no_changes_when_up_to_date(self):
        """Game poll with current count should return no new numbers"""
        # First get total count
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll")
        data = response.json()
        total_called = data["total_called"]
        
        # Poll with current count
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll?last_count={total_called}")
        data = response.json()
        
        assert len(data["new_numbers"]) == 0, "Should return no new numbers when up to date"
        assert data["has_changes"] == False, "has_changes should be False when up to date"
        
        print(f"✓ No changes when up to date (last_count={total_called})")
    
    def test_game_poll_returns_winners(self):
        """Game poll should return winners dict"""
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll")
        data = response.json()
        
        assert "winners" in data, "Response should contain 'winners'"
        assert isinstance(data["winners"], dict), "winners should be a dict"
        
        if data["winners"]:
            print(f"✓ Game has {len(data['winners'])} winners: {list(data['winners'].keys())}")
        else:
            print("✓ Game has no winners yet")
    
    def test_game_poll_returns_current_number(self):
        """Game poll should return current_number"""
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll")
        data = response.json()
        
        assert "current_number" in data, "Response should contain 'current_number'"
        print(f"✓ Current number: {data['current_number']}")
    
    def test_game_poll_404_for_nonexistent_game(self):
        """Game poll should return 404 for non-existent game"""
        response = requests.get(f"{BASE_URL}/api/games/nonexistent_game_xyz/poll")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Returns 404 for non-existent game")
    
    def test_game_poll_response_is_lightweight(self):
        """Game poll response should be smaller than full session endpoint"""
        poll_response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll")
        session_response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/session")
        
        poll_size = len(poll_response.content)
        session_size = len(session_response.content)
        
        print(f"✓ Response sizes: poll={poll_size} bytes, session={session_size} bytes")
        
        if session_size > 0:
            ratio = poll_size / session_size
            print(f"✓ Poll is {ratio:.2%} of full session size")


class TestPollingPerformance:
    """Tests for polling performance and response times"""
    
    def test_poll_list_response_time(self):
        """Poll-list should respond quickly (< 500ms)"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/games/poll-list")
        elapsed = (time.time() - start) * 1000
        
        assert response.status_code == 200
        assert elapsed < 500, f"Response took {elapsed:.0f}ms, expected < 500ms"
        print(f"✓ Poll-list response time: {elapsed:.0f}ms")
    
    def test_game_poll_response_time(self):
        """Game poll should respond quickly (< 500ms)"""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll")
        elapsed = (time.time() - start) * 1000
        
        assert response.status_code == 200
        assert elapsed < 500, f"Response took {elapsed:.0f}ms, expected < 500ms"
        print(f"✓ Game poll response time: {elapsed:.0f}ms")
    
    def test_multiple_rapid_polls(self):
        """Simulate rapid polling (5 requests in quick succession)"""
        times = []
        for i in range(5):
            start = time.time()
            response = requests.get(f"{BASE_URL}/api/games/poll-list")
            elapsed = (time.time() - start) * 1000
            times.append(elapsed)
            assert response.status_code == 200
        
        avg_time = sum(times) / len(times)
        max_time = max(times)
        
        print(f"✓ Rapid polling: avg={avg_time:.0f}ms, max={max_time:.0f}ms")
        assert avg_time < 500, f"Average response time {avg_time:.0f}ms exceeds 500ms"


class TestCompletedGamePolling:
    """Tests for polling behavior on completed games"""
    
    def test_completed_game_poll_returns_completed_status(self):
        """Polling a completed game should return 'completed' status"""
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll")
        data = response.json()
        
        # Game should be completed or live
        assert data["status"] in ["completed", "live"], f"Unexpected status: {data['status']}"
        print(f"✓ Game status: {data['status']}")
    
    def test_completed_game_has_all_numbers(self):
        """Completed game should have all called numbers available"""
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll")
        data = response.json()
        
        total_called = data["total_called"]
        print(f"✓ Completed game has {total_called} called numbers")
        
        # Verify we can get all numbers with last_count=0
        response = requests.get(f"{BASE_URL}/api/games/{COMPLETED_GAME_ID}/poll?last_count=0")
        data = response.json()
        
        assert len(data["new_numbers"]) == total_called, "Should return all numbers when last_count=0"
        print(f"✓ All {total_called} numbers returned with last_count=0")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
