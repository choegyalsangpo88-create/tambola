import requests
import json

def test_auth_endpoints():
    """Test specific auth endpoints mentioned in review request"""
    base_url = "https://housie-game-1.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    print("🔐 Testing Auth Endpoints")
    print("=" * 50)
    
    # Test 1: POST /api/auth/session - Exchange session_id for session_token
    print("\n🔍 Testing POST /api/auth/session")
    session_data = {
        "session_id": "test_session_id_123"  # This would normally come from Google OAuth
    }
    
    try:
        response = requests.post(f"{api_url}/auth/session", json=session_data)
        print(f"   Status: {response.status_code}")
        if response.status_code == 400:
            print(f"   Expected error (invalid session_id): {response.json()}")
            print("   ✅ Endpoint exists and handles invalid session_id correctly")
        else:
            print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 2: GET /api/auth/me with valid session
    print("\n🔍 Testing GET /api/auth/me with valid session")
    headers = {
        'Authorization': 'Bearer lYnA2pHIaXdsZ_NSn4jX6i0MjmwN-Fgz3JFKe9y_ZPI'
    }
    
    try:
        response = requests.get(f"{api_url}/auth/me", headers=headers)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            user_data = response.json()
            print(f"   ✅ User authenticated: {user_data['name']} ({user_data['email']})")
        else:
            print(f"   ❌ Failed: {response.json()}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: GET /api/auth/me without session
    print("\n🔍 Testing GET /api/auth/me without session")
    try:
        response = requests.get(f"{api_url}/auth/me")
        print(f"   Status: {response.status_code}")
        if response.status_code == 401:
            print(f"   ✅ Correctly rejected unauthorized request: {response.json()}")
        else:
            print(f"   ❌ Unexpected response: {response.json()}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    test_auth_endpoints()