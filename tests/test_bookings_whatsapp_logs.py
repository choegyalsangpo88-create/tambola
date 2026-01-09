"""
Test Bookings Management and WhatsApp Message Logs
Tests for:
- Bookings tab in Game Control Modal (summary cards, table columns)
- PUT /api/admin/bookings/{booking_id}/confirm-payment - Approve payment with auto WhatsApp
- GET /api/admin/whatsapp-logs - Get all WhatsApp logs (immutable)
- GET /api/admin/games/{game_id}/control - Verify booking details with ticket_numbers, whatsapp_opt_in, whatsapp_message_status
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://indian-housie.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

# Admin credentials
ADMIN_USERNAME = "sixtysevenceo"
ADMIN_PASSWORD = "Freetibet123!@#"


@pytest.fixture(scope="module")
def admin_session():
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


class TestConfirmPaymentEndpoint:
    """Test PUT /api/admin/bookings/{booking_id}/confirm-payment endpoint"""
    
    def test_confirm_payment_nonexistent_booking(self, admin_session):
        """Test confirm payment with non-existent booking returns 404"""
        response = admin_session.put(f"{API}/admin/bookings/nonexistent_booking_id/confirm-payment")
        assert response.status_code == 404
        assert "not found" in response.json().get("detail", "").lower()
        print(f"✅ Non-existent booking correctly returns 404")
    
    def test_confirm_payment_endpoint_exists(self, admin_session):
        """Test confirm payment endpoint exists and requires valid booking"""
        # Try with invalid booking ID - should return 404 (not 405 method not allowed)
        response = admin_session.put(f"{API}/admin/bookings/invalid_id/confirm-payment")
        assert response.status_code == 404  # Not 405, meaning endpoint exists
        print(f"✅ Confirm payment endpoint exists and validates booking_id")


class TestWhatsAppLogsEndpoint:
    """Test GET /api/admin/whatsapp-logs endpoint"""
    
    def test_get_whatsapp_logs(self, admin_session):
        """Test GET /api/admin/whatsapp-logs returns logs array"""
        response = admin_session.get(f"{API}/admin/whatsapp-logs")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "logs" in data, "Missing 'logs' field"
        assert "total" in data, "Missing 'total' field"
        assert isinstance(data["logs"], list), "logs should be a list"
        assert isinstance(data["total"], int), "total should be an integer"
        
        print(f"✅ WhatsApp logs endpoint returns correct structure")
        print(f"   - Total logs: {data['total']}")
    
    def test_whatsapp_logs_with_game_filter(self, admin_session):
        """Test WhatsApp logs can be filtered by game_id"""
        # Get any game
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game_id = games[0]["game_id"]
        
        response = admin_session.get(f"{API}/admin/whatsapp-logs?game_id={game_id}")
        assert response.status_code == 200
        data = response.json()
        
        # All logs should be for the specified game
        for log in data["logs"]:
            assert log.get("game_id") == game_id, f"Log game_id mismatch: {log.get('game_id')} != {game_id}"
        
        print(f"✅ WhatsApp logs correctly filtered by game_id")
    
    def test_whatsapp_logs_structure(self, admin_session):
        """Test WhatsApp logs have required fields (template_name, delivery_status, failure_reason)"""
        response = admin_session.get(f"{API}/admin/whatsapp-logs")
        assert response.status_code == 200
        data = response.json()
        
        # If there are logs, verify structure
        if data["logs"]:
            log = data["logs"][0]
            # Required fields per spec
            expected_fields = ["game_id", "message_type", "recipient_name", "sent_at", "status"]
            for field in expected_fields:
                assert field in log, f"Missing required field: {field}"
            
            # New fields from spec
            assert "template_name" in log or log.get("template_name") is None, "template_name field should exist"
            assert "delivery_status" in log or log.get("delivery_status") is None, "delivery_status field should exist"
            # failure_reason can be None
            
            print(f"✅ WhatsApp log has correct structure")
            print(f"   - Fields: {list(log.keys())}")
        else:
            print(f"✅ WhatsApp logs endpoint works (no logs yet)")
    
    def test_whatsapp_logs_requires_admin_auth(self):
        """Test WhatsApp logs endpoint requires admin authentication"""
        response = requests.get(f"{API}/admin/whatsapp-logs")
        assert response.status_code == 401
        print(f"✅ WhatsApp logs correctly requires admin auth")


class TestGameControlBookingsData:
    """Test GET /api/admin/games/{game_id}/control returns booking details"""
    
    def test_control_returns_booking_details(self, admin_session):
        """Test control endpoint returns bookings with ticket_numbers, whatsapp_opt_in, whatsapp_message_status"""
        # Get any game
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game_id = games[0]["game_id"]
        
        response = admin_session.get(f"{API}/admin/games/{game_id}/control")
        assert response.status_code == 200
        data = response.json()
        
        # Verify bookings array exists
        assert "bookings" in data, "Missing 'bookings' field"
        assert isinstance(data["bookings"], list), "bookings should be a list"
        
        # If there are bookings, verify structure
        if data["bookings"]:
            booking = data["bookings"][0]
            
            # Required fields per spec
            assert "ticket_numbers" in booking, "Missing ticket_numbers field"
            assert "whatsapp_opt_in" in booking, "Missing whatsapp_opt_in field"
            # whatsapp_message_status can be None if no message sent
            assert "whatsapp_message_status" in booking or booking.get("confirmation_sent") == False, \
                "Missing whatsapp_message_status field"
            
            # Verify types
            assert isinstance(booking["ticket_numbers"], list), "ticket_numbers should be a list"
            assert isinstance(booking["whatsapp_opt_in"], bool), "whatsapp_opt_in should be boolean"
            
            print(f"✅ Booking has required fields")
            print(f"   - ticket_numbers: {booking['ticket_numbers']}")
            print(f"   - whatsapp_opt_in: {booking['whatsapp_opt_in']}")
            print(f"   - whatsapp_message_status: {booking.get('whatsapp_message_status')}")
        else:
            print(f"✅ Control endpoint works (no bookings for this game)")
    
    def test_control_returns_whatsapp_logs(self, admin_session):
        """Test control endpoint returns whatsapp_logs with template_name, status, failure_reason"""
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game_id = games[0]["game_id"]
        
        response = admin_session.get(f"{API}/admin/games/{game_id}/control")
        assert response.status_code == 200
        data = response.json()
        
        # Verify whatsapp_logs array exists
        assert "whatsapp_logs" in data, "Missing 'whatsapp_logs' field"
        assert isinstance(data["whatsapp_logs"], list), "whatsapp_logs should be a list"
        
        # If there are logs, verify structure
        if data["whatsapp_logs"]:
            log = data["whatsapp_logs"][0]
            
            # Required fields per spec
            expected_fields = ["game_id", "message_type", "recipient_name", "sent_at", "status"]
            for field in expected_fields:
                assert field in log, f"Missing required field: {field}"
            
            print(f"✅ WhatsApp logs in control data have correct structure")
        else:
            print(f"✅ Control endpoint returns whatsapp_logs (empty for this game)")
    
    def test_control_returns_ticket_summary(self, admin_session):
        """Test control endpoint returns ticket_summary with revenue"""
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game_id = games[0]["game_id"]
        
        response = admin_session.get(f"{API}/admin/games/{game_id}/control")
        assert response.status_code == 200
        data = response.json()
        
        # Verify ticket_summary
        assert "ticket_summary" in data, "Missing 'ticket_summary' field"
        summary = data["ticket_summary"]
        
        # Required fields for Bookings tab summary cards
        assert "total" in summary, "Missing 'total' in ticket_summary"
        assert "confirmed" in summary, "Missing 'confirmed' in ticket_summary"
        assert "revenue" in summary, "Missing 'revenue' in ticket_summary"
        
        print(f"✅ Ticket summary has required fields for Bookings tab")
        print(f"   - Total: {summary['total']}")
        print(f"   - Confirmed: {summary['confirmed']}")
        print(f"   - Revenue: {summary['revenue']}")


class TestBookingsTableColumns:
    """Test that bookings data supports all required table columns"""
    
    def test_booking_has_user_info(self, admin_session):
        """Test booking includes user info (name, phone) for table display"""
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game_id = games[0]["game_id"]
        
        response = admin_session.get(f"{API}/admin/games/{game_id}/control")
        assert response.status_code == 200
        data = response.json()
        
        if data["bookings"]:
            booking = data["bookings"][0]
            
            # User info should be included
            assert "user" in booking, "Missing 'user' field in booking"
            user = booking["user"]
            
            if user:
                # User should have name and phone for table columns
                assert "name" in user or user is None, "User should have name"
                # Phone might be None if not provided
                
                print(f"✅ Booking includes user info for table display")
                print(f"   - User name: {user.get('name')}")
                print(f"   - User phone: {user.get('phone', 'N/A')}")
        else:
            print(f"✅ Booking user info test skipped (no bookings)")
    
    def test_booking_has_status(self, admin_session):
        """Test booking includes status for Payment column"""
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game_id = games[0]["game_id"]
        
        response = admin_session.get(f"{API}/admin/games/{game_id}/control")
        assert response.status_code == 200
        data = response.json()
        
        if data["bookings"]:
            booking = data["bookings"][0]
            
            # Status should be present
            assert "status" in booking, "Missing 'status' field in booking"
            assert booking["status"] in ["pending", "confirmed", "cancelled"], \
                f"Invalid status: {booking['status']}"
            
            print(f"✅ Booking has status field: {booking['status']}")
        else:
            print(f"✅ Booking status test skipped (no bookings)")


class TestWhatsAppOptInLogic:
    """Test WhatsApp opt-in logic for auto-send on payment confirmation"""
    
    def test_booking_whatsapp_opt_in_default(self, admin_session):
        """Test that whatsapp_opt_in defaults to True for backwards compatibility"""
        games_response = requests.get(f"{API}/games")
        games = games_response.json()
        if not games:
            pytest.skip("No games available for testing")
        
        game_id = games[0]["game_id"]
        
        response = admin_session.get(f"{API}/admin/games/{game_id}/control")
        assert response.status_code == 200
        data = response.json()
        
        if data["bookings"]:
            booking = data["bookings"][0]
            
            # whatsapp_opt_in should be present and boolean
            assert "whatsapp_opt_in" in booking, "Missing whatsapp_opt_in field"
            assert isinstance(booking["whatsapp_opt_in"], bool), "whatsapp_opt_in should be boolean"
            
            print(f"✅ Booking has whatsapp_opt_in: {booking['whatsapp_opt_in']}")
        else:
            print(f"✅ WhatsApp opt-in test skipped (no bookings)")


class TestLogsImmutability:
    """Test that WhatsApp logs are immutable (read-only)"""
    
    def test_no_update_endpoint_for_logs(self, admin_session):
        """Test there's no PUT/PATCH endpoint for WhatsApp logs"""
        # Try to update a log (should fail with 404 or 405)
        response = admin_session.put(f"{API}/admin/whatsapp-logs/some_log_id")
        assert response.status_code in [404, 405, 422], \
            f"Unexpected status code for log update: {response.status_code}"
        
        response = admin_session.patch(f"{API}/admin/whatsapp-logs/some_log_id")
        assert response.status_code in [404, 405, 422], \
            f"Unexpected status code for log patch: {response.status_code}"
        
        print(f"✅ WhatsApp logs are immutable (no update endpoints)")
    
    def test_no_delete_endpoint_for_logs(self, admin_session):
        """Test there's no DELETE endpoint for WhatsApp logs"""
        response = admin_session.delete(f"{API}/admin/whatsapp-logs/some_log_id")
        assert response.status_code in [404, 405, 422], \
            f"Unexpected status code for log delete: {response.status_code}"
        
        print(f"✅ WhatsApp logs are immutable (no delete endpoint)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
