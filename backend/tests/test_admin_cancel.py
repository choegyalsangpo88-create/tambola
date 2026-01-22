"""
Test Admin Cancel Booking and Cancel Ticket APIs
Tests the validation that cancellation only works for 'upcoming' games
"""
import pytest
import requests
import os
import hashlib
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_USERNAME = "sixtysevenceo"
ADMIN_PASSWORD = "Freetibet123!@#"


class TestAdminCancelAPIs:
    """Test admin cancel booking and cancel ticket endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session for tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Admin {token}"})
        
        yield
        
        # Cleanup - logout
        self.session.post(f"{BASE_URL}/api/admin/logout")
    
    def test_admin_login_success(self):
        """Test admin login works correctly"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data.get("success") == True
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login fails with wrong credentials"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "wronguser",
            "password": "wrongpass"
        })
        assert response.status_code == 401
    
    def test_cancel_booking_nonexistent(self):
        """Test cancelling a non-existent booking returns 404"""
        response = self.session.post(f"{BASE_URL}/api/admin/bookings/nonexistent_booking_id/cancel")
        assert response.status_code == 404
        assert "not found" in response.json().get("detail", "").lower()
    
    def test_cancel_ticket_nonexistent(self):
        """Test cancelling a non-existent ticket returns 404"""
        response = self.session.post(f"{BASE_URL}/api/admin/tickets/nonexistent_ticket_id/cancel")
        assert response.status_code == 404
        assert "not found" in response.json().get("detail", "").lower()
    
    def test_get_games_list(self):
        """Test getting list of games"""
        response = self.session.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        games = response.json()
        assert isinstance(games, list)
        print(f"Found {len(games)} games")
        for game in games:
            print(f"  - {game.get('name')} ({game.get('game_id')}): status={game.get('status')}")
    
    def test_get_admin_bookings(self):
        """Test getting all bookings as admin"""
        response = self.session.get(f"{BASE_URL}/api/admin/bookings")
        assert response.status_code == 200
        bookings = response.json()
        assert isinstance(bookings, list)
        print(f"Found {len(bookings)} bookings")
        for booking in bookings[:5]:  # Print first 5
            print(f"  - {booking.get('booking_id')}: status={booking.get('status')}, game_id={booking.get('game_id')}")
    
    def test_cancel_booking_for_live_game_fails(self):
        """Test that cancelling a booking for a live game returns 400 error"""
        # First get all bookings
        bookings_response = self.session.get(f"{BASE_URL}/api/admin/bookings")
        assert bookings_response.status_code == 200
        bookings = bookings_response.json()
        
        # Get all games
        games_response = self.session.get(f"{BASE_URL}/api/games")
        assert games_response.status_code == 200
        games = games_response.json()
        
        # Find a booking for a live game
        live_game_ids = [g["game_id"] for g in games if g.get("status") == "live"]
        print(f"Live game IDs: {live_game_ids}")
        
        live_booking = None
        for booking in bookings:
            if booking.get("game_id") in live_game_ids and booking.get("status") != "cancelled":
                live_booking = booking
                break
        
        if live_booking:
            print(f"Testing cancel on live game booking: {live_booking.get('booking_id')}")
            response = self.session.post(f"{BASE_URL}/api/admin/bookings/{live_booking['booking_id']}/cancel")
            assert response.status_code == 400, f"Expected 400 for live game, got {response.status_code}"
            error_detail = response.json().get("detail", "")
            assert "live" in error_detail.lower() or "cannot cancel" in error_detail.lower(), f"Error message should mention live game: {error_detail}"
            print(f"✓ Correctly rejected cancel for live game: {error_detail}")
        else:
            print("No bookings found for live games - skipping live game cancel test")
            pytest.skip("No bookings for live games to test")
    
    def test_cancel_ticket_for_live_game_fails(self):
        """Test that cancelling a ticket for a live game returns 400 error"""
        # Get all games
        games_response = self.session.get(f"{BASE_URL}/api/games")
        assert games_response.status_code == 200
        games = games_response.json()
        
        # Find a live game
        live_game = None
        for game in games:
            if game.get("status") == "live":
                live_game = game
                break
        
        if not live_game:
            print("No live games found - skipping live game ticket cancel test")
            pytest.skip("No live games to test")
        
        print(f"Found live game: {live_game.get('name')} ({live_game.get('game_id')})")
        
        # Get tickets for this game
        tickets_response = self.session.get(f"{BASE_URL}/api/admin/games/{live_game['game_id']}/tickets?status=booked")
        assert tickets_response.status_code == 200
        tickets_data = tickets_response.json()
        tickets = tickets_data.get("tickets", [])
        
        if not tickets:
            print("No booked tickets found for live game - skipping")
            pytest.skip("No booked tickets for live game")
        
        # Try to cancel a booked ticket
        ticket = tickets[0]
        print(f"Testing cancel on live game ticket: {ticket.get('ticket_id')}")
        response = self.session.post(f"{BASE_URL}/api/admin/tickets/{ticket['ticket_id']}/cancel")
        assert response.status_code == 400, f"Expected 400 for live game ticket, got {response.status_code}"
        error_detail = response.json().get("detail", "")
        assert "live" in error_detail.lower() or "cannot cancel" in error_detail.lower(), f"Error message should mention live game: {error_detail}"
        print(f"✓ Correctly rejected cancel for live game ticket: {error_detail}")
    
    def test_cancel_booking_for_upcoming_game_succeeds(self):
        """Test that cancelling a booking for an upcoming game works"""
        # Get all games
        games_response = self.session.get(f"{BASE_URL}/api/games")
        assert games_response.status_code == 200
        games = games_response.json()
        
        # Find an upcoming game
        upcoming_game = None
        for game in games:
            if game.get("status") == "upcoming":
                upcoming_game = game
                break
        
        if not upcoming_game:
            print("No upcoming games found - skipping upcoming game cancel test")
            pytest.skip("No upcoming games to test")
        
        print(f"Found upcoming game: {upcoming_game.get('name')} ({upcoming_game.get('game_id')})")
        
        # Get bookings for this game
        bookings_response = self.session.get(f"{BASE_URL}/api/admin/bookings")
        assert bookings_response.status_code == 200
        bookings = bookings_response.json()
        
        upcoming_booking = None
        for booking in bookings:
            if booking.get("game_id") == upcoming_game["game_id"] and booking.get("status") != "cancelled":
                upcoming_booking = booking
                break
        
        if not upcoming_booking:
            print("No bookings found for upcoming game - skipping")
            pytest.skip("No bookings for upcoming game")
        
        print(f"Testing cancel on upcoming game booking: {upcoming_booking.get('booking_id')}")
        response = self.session.post(f"{BASE_URL}/api/admin/bookings/{upcoming_booking['booking_id']}/cancel")
        
        # Should succeed with 200
        assert response.status_code == 200, f"Expected 200 for upcoming game, got {response.status_code}: {response.text}"
        data = response.json()
        assert "cancelled" in data.get("message", "").lower() or "released" in data.get("message", "").lower()
        print(f"✓ Successfully cancelled booking for upcoming game: {data.get('message')}")
    
    def test_cancel_already_cancelled_booking_fails(self):
        """Test that cancelling an already cancelled booking returns 400"""
        # Get all bookings
        bookings_response = self.session.get(f"{BASE_URL}/api/admin/bookings")
        assert bookings_response.status_code == 200
        bookings = bookings_response.json()
        
        # Find a cancelled booking
        cancelled_booking = None
        for booking in bookings:
            if booking.get("status") == "cancelled":
                cancelled_booking = booking
                break
        
        if not cancelled_booking:
            print("No cancelled bookings found - skipping")
            pytest.skip("No cancelled bookings to test")
        
        print(f"Testing cancel on already cancelled booking: {cancelled_booking.get('booking_id')}")
        response = self.session.post(f"{BASE_URL}/api/admin/bookings/{cancelled_booking['booking_id']}/cancel")
        assert response.status_code == 400, f"Expected 400 for already cancelled, got {response.status_code}"
        error_detail = response.json().get("detail", "")
        assert "already cancelled" in error_detail.lower(), f"Error message should mention already cancelled: {error_detail}"
        print(f"✓ Correctly rejected cancel for already cancelled booking: {error_detail}")
    
    def test_cancel_unbooked_ticket_fails(self):
        """Test that cancelling an unbooked ticket returns 400"""
        # Get all games
        games_response = self.session.get(f"{BASE_URL}/api/games")
        assert games_response.status_code == 200
        games = games_response.json()
        
        if not games:
            pytest.skip("No games found")
        
        # Get available tickets for first game
        game = games[0]
        tickets_response = self.session.get(f"{BASE_URL}/api/admin/games/{game['game_id']}/tickets?status=available")
        assert tickets_response.status_code == 200
        tickets_data = tickets_response.json()
        tickets = tickets_data.get("tickets", [])
        
        if not tickets:
            print("No available tickets found - skipping")
            pytest.skip("No available tickets to test")
        
        # Try to cancel an available (unbooked) ticket
        ticket = tickets[0]
        print(f"Testing cancel on unbooked ticket: {ticket.get('ticket_id')}")
        response = self.session.post(f"{BASE_URL}/api/admin/tickets/{ticket['ticket_id']}/cancel")
        assert response.status_code == 400, f"Expected 400 for unbooked ticket, got {response.status_code}"
        error_detail = response.json().get("detail", "")
        assert "not booked" in error_detail.lower(), f"Error message should mention not booked: {error_detail}"
        print(f"✓ Correctly rejected cancel for unbooked ticket: {error_detail}")


class TestAdminVerify:
    """Test admin session verification"""
    
    def test_admin_verify_without_token(self):
        """Test admin verify without token returns invalid"""
        response = requests.get(f"{BASE_URL}/api/admin/verify")
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") == False
    
    def test_admin_verify_with_valid_token(self):
        """Test admin verify with valid token returns valid"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        
        # Verify with token
        response = requests.get(
            f"{BASE_URL}/api/admin/verify",
            headers={"Authorization": f"Admin {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") == True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
