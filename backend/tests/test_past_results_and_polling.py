"""
Test Past Results endpoint and polling intervals
Tests for:
1. GET /api/games/{game_id}/results - returns full game details
2. GET /api/games/completed - returns completed games
3. Verify response structure for results endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGameResultsEndpoint:
    """Tests for GET /api/games/{game_id}/results endpoint"""
    
    def test_results_endpoint_returns_full_game_details(self):
        """Test that results endpoint returns complete game information"""
        # Use a known completed game with winners
        game_id = "game_ed9cc4d9"
        
        response = requests.get(f"{BASE_URL}/api/games/{game_id}/results")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert "game" in data, "Response should contain 'game' field"
        assert "called_numbers" in data, "Response should contain 'called_numbers' field"
        assert "total_called" in data, "Response should contain 'total_called' field"
        assert "winners" in data, "Response should contain 'winners' field"
        assert "total_tickets" in data, "Response should contain 'total_tickets' field"
        assert "booked_tickets" in data, "Response should contain 'booked_tickets' field"
        assert "total_bookings" in data, "Response should contain 'total_bookings' field"
        
        # Verify game data
        game = data["game"]
        assert game["game_id"] == game_id
        assert game["status"] == "completed"
        
        # Verify called numbers is a list
        assert isinstance(data["called_numbers"], list)
        assert data["total_called"] == len(data["called_numbers"])
        
        print(f"✅ Results endpoint returned {data['total_called']} called numbers")
        print(f"✅ Winners: {list(data['winners'].keys())}")
    
    def test_results_endpoint_returns_winners_with_ticket_details(self):
        """Test that winners include ticket numbers (3x9 grid)"""
        game_id = "game_ed9cc4d9"
        
        response = requests.get(f"{BASE_URL}/api/games/{game_id}/results")
        assert response.status_code == 200
        
        data = response.json()
        winners = data.get("winners", {})
        
        # This game should have winners
        assert len(winners) > 0, "Game should have winners"
        
        # Check each winner has ticket details
        for prize_type, winner_info in winners.items():
            assert "user_id" in winner_info, f"{prize_type} winner should have user_id"
            assert "ticket_id" in winner_info, f"{prize_type} winner should have ticket_id"
            assert "ticket_number" in winner_info, f"{prize_type} winner should have ticket_number"
            assert "ticket_numbers" in winner_info, f"{prize_type} winner should have ticket_numbers (3x9 grid)"
            
            # Verify ticket_numbers is a 3x9 grid
            ticket_grid = winner_info["ticket_numbers"]
            assert isinstance(ticket_grid, list), "ticket_numbers should be a list"
            assert len(ticket_grid) == 3, "ticket_numbers should have 3 rows"
            for row in ticket_grid:
                assert len(row) == 9, "Each row should have 9 columns"
            
            print(f"✅ {prize_type}: {winner_info['ticket_number']} - grid verified")
    
    def test_results_endpoint_404_for_nonexistent_game(self):
        """Test that results endpoint returns 404 for non-existent game"""
        response = requests.get(f"{BASE_URL}/api/games/nonexistent_game_123/results")
        assert response.status_code == 404
        print("✅ Returns 404 for non-existent game")
    
    def test_results_endpoint_for_game_without_winners(self):
        """Test results endpoint for completed game without winners"""
        # Use a game that was completed without winners
        game_id = "game_35d396f2"  # API Start Test Game
        
        response = requests.get(f"{BASE_URL}/api/games/{game_id}/results")
        assert response.status_code == 200
        
        data = response.json()
        
        # Should still have all fields
        assert "game" in data
        assert "called_numbers" in data
        assert "winners" in data
        
        # Winners should be empty dict
        assert isinstance(data["winners"], dict)
        
        print(f"✅ Game without winners: called_numbers={data['total_called']}, winners={len(data['winners'])}")


class TestCompletedGamesEndpoint:
    """Tests for GET /api/games/completed endpoint"""
    
    def test_completed_games_returns_list(self):
        """Test that completed games endpoint returns a list"""
        response = requests.get(f"{BASE_URL}/api/games/completed")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Found {len(data)} completed games")
    
    def test_completed_games_have_correct_status(self):
        """Test that all returned games have status 'completed'"""
        response = requests.get(f"{BASE_URL}/api/games/completed")
        assert response.status_code == 200
        
        games = response.json()
        
        for game in games:
            assert game["status"] == "completed", f"Game {game['game_id']} should have status 'completed'"
        
        print(f"✅ All {len(games)} games have status 'completed'")
    
    def test_completed_games_include_winners_preview(self):
        """Test that completed games include winners field"""
        response = requests.get(f"{BASE_URL}/api/games/completed")
        assert response.status_code == 200
        
        games = response.json()
        
        for game in games:
            assert "winners" in game, f"Game {game['game_id']} should have 'winners' field"
        
        # Find game with winners
        games_with_winners = [g for g in games if len(g.get("winners", {})) > 0]
        print(f"✅ {len(games_with_winners)} games have winners")


class TestGamesListEndpoint:
    """Tests for GET /api/games endpoint (used for polling)"""
    
    def test_games_list_returns_all_games(self):
        """Test that games list endpoint returns games"""
        response = requests.get(f"{BASE_URL}/api/games")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one game"
        
        # Check game structure
        game = data[0]
        assert "game_id" in game
        assert "name" in game
        assert "status" in game
        
        print(f"✅ Games list returned {len(data)} games")
    
    def test_games_list_includes_live_games(self):
        """Test that games list includes live games for dashboard"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        
        games = response.json()
        live_games = [g for g in games if g["status"] == "live"]
        
        print(f"✅ Found {len(live_games)} live games")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
