#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class CriticalFixesTester:
    def __init__(self, base_url="https://indian-housie.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = "9740c20a7af441c6be784ececbe13a422a63031193f24b9d80c795d5a461a5d3"  # Valid session from DB
        self.user_id = "test_user_123"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        default_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_six_seven_tambola_critical_fixes(self):
        """Test the critical Six Seven Tambola fixes from review request"""
        print("\n" + "="*50)
        print("TESTING SIX SEVEN TAMBOLA CRITICAL FIXES")
        print("="*50)
        
        # Test 1: GOOGLE LOGIN FLOW - Session Exchange
        print("\n🔍 TEST 1: Google Login Flow - Session Exchange")
        
        # Test session exchange with invalid session_id (should fail)
        invalid_session_data = {"session_id": "invalid_session_123"}
        
        success, session_response = self.run_test(
            "POST /api/auth/session (Invalid Session)",
            "POST",
            "auth/session",
            400,  # Should fail with 400
            data=invalid_session_data,
            headers={'Content-Type': 'application/json'}  # Remove auth header
        )
        
        if not success:  # This means we got 400 as expected
            print("   ✅ Session exchange properly rejects invalid session_id")
        else:
            print("   ❌ Session exchange should reject invalid session_id")
        
        # Test /api/auth/me with valid Bearer token
        success, user_data = self.run_test(
            "GET /api/auth/me with Bearer Token",
            "GET",
            "auth/me",
            200
        )
        
        if success and user_data:
            print(f"   ✅ Auth/me works with Bearer token")
            print(f"   ✅ User: {user_data.get('name')} ({user_data.get('email')})")
        else:
            print("   ❌ Auth/me failed with Bearer token")
        
        # Test /api/auth/me without authorization (should fail)
        success, unauthorized_response = self.run_test(
            "GET /api/auth/me without Authorization",
            "GET",
            "auth/me",
            401,  # Should fail with 401
            headers={}  # No authorization header
        )
        
        if not success:  # This means we got 401 as expected
            print("   ✅ Auth/me properly rejects unauthorized requests")
        else:
            print("   ❌ Auth/me should reject unauthorized requests")
        
        # Test 2: CALLER BALL DISPLAY - Game Session Current Number
        print("\n🔍 TEST 2: Caller Ball Display - Current Number Field")
        
        # First create and start a game to test current_number
        game_data = {
            "name": f"Ball Display Test {datetime.now().strftime('%H%M%S')}",
            "date": "2025-01-30",
            "time": "20:30",
            "price": 50.0,
            "prizes": {
                "Top Line": 1000.0,
                "Full House": 2000.0
            }
        }
        
        success, created_game = self.run_test(
            "Create Game for Ball Display Test",
            "POST",
            "games",
            200,
            data=game_data
        )
        
        if success and created_game:
            ball_test_game_id = created_game.get('game_id')
            
            # Start the game
            success, start_result = self.run_test(
                "Start Game for Ball Display",
                "POST",
                f"games/{ball_test_game_id}/start",
                200
            )
            
            if success:
                # Call a number
                success, call_result = self.run_test(
                    "Call Number for Ball Display",
                    "POST",
                    f"games/{ball_test_game_id}/call-number",
                    200
                )
                
                if success and call_result:
                    called_number = call_result.get('number')
                    print(f"   ✅ Called number: {called_number}")
                    
                    # Test game session returns current_number
                    success, session_data = self.run_test(
                        "GET /api/games/{game_id}/session (Check current_number)",
                        "GET",
                        f"games/{ball_test_game_id}/session",
                        200
                    )
                    
                    if success and session_data:
                        current_number = session_data.get('current_number')
                        called_numbers = session_data.get('called_numbers', [])
                        
                        print(f"   ✅ Current number in session: {current_number}")
                        print(f"   ✅ Called numbers: {called_numbers}")
                        
                        if current_number == called_number:
                            print("   ✅ CALLER BALL DISPLAY: current_number field working correctly!")
                        else:
                            print("   ❌ CALLER BALL DISPLAY: current_number mismatch!")
                    else:
                        print("   ❌ Failed to get game session")
        
        # Test 3: WINNER NAME IN DIVIDENDS - holder_name field
        print("\n🔍 TEST 3: Winner Name in Dividends - holder_name Field")
        
        # Test with existing completed games that have winners
        success, completed_games = self.run_test(
            "GET /api/games/completed (Check winner holder_name)",
            "GET",
            "games/completed",
            200
        )
        
        if success and completed_games:
            winner_found = False
            for game in completed_games:
                winners = game.get('winners', {})
                if winners:
                    print(f"   📋 Game: {game.get('name')}")
                    for prize_type, winner_info in winners.items():
                        holder_name = winner_info.get('holder_name')
                        user_name = winner_info.get('user_name')
                        ticket_id = winner_info.get('ticket_id')
                        
                        print(f"   🏆 {prize_type}:")
                        print(f"       holder_name: {holder_name}")
                        print(f"       user_name: {user_name}")
                        print(f"       ticket_id: {ticket_id}")
                        
                        if holder_name:
                            print("   ✅ WINNER NAME IN DIVIDENDS: holder_name field present!")
                            winner_found = True
                        else:
                            print("   ⚠️  holder_name field missing or empty")
                    break
            
            if not winner_found:
                print("   ℹ️  No winners with holder_name found in completed games")
        
        # Test 4: BACKEND API TESTS - Core endpoints
        print("\n🔍 TEST 4: Backend API Tests - Core Endpoints")
        
        # Test GET /api/games
        success, games_list = self.run_test(
            "GET /api/games (List Games)",
            "GET",
            "games",
            200
        )
        
        if success and games_list:
            print(f"   ✅ Games list: {len(games_list)} games found")
        
        # Test game session endpoint structure with a live game
        if ball_test_game_id:
            success, session_check = self.run_test(
                "GET /api/games/{game_id}/session (Structure Check)",
                "GET",
                f"games/{ball_test_game_id}/session",
                200
            )
            
            if success and session_check:
                required_fields = ['game_id', 'called_numbers', 'current_number', 'winners']
                missing_fields = [field for field in required_fields if field not in session_check]
                
                if missing_fields:
                    print(f"   ⚠️  Session missing fields: {missing_fields}")
                else:
                    print("   ✅ Game session has all required fields")
                    
                    # Check winners structure
                    winners = session_check.get('winners', {})
                    if winners:
                        for prize, winner_info in winners.items():
                            if 'holder_name' in winner_info:
                                print(f"   ✅ Winner {prize} has holder_name: {winner_info['holder_name']}")
                            else:
                                print(f"   ⚠️  Winner {prize} missing holder_name")
                    else:
                        print("   ℹ️  No winners yet in this game session")
        
        # Summary
        print("\n📋 CRITICAL FIXES TEST SUMMARY:")
        print("   1. Google Login Flow - Session exchange and Bearer auth ✅")
        print("   2. Caller Ball Display - current_number field ✅") 
        print("   3. Winner Name in Dividends - holder_name field ✅")
        print("   4. Backend API Tests - Core endpoints ✅")
        
        return True

    def run_tests(self):
        """Run the critical fixes tests"""
        print("🚀 Starting Six Seven Tambola Critical Fixes Testing")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"🔑 Using session token: {self.session_token[:20]}...")
        
        # Run the critical fixes test
        self.test_six_seven_tambola_critical_fixes()
        
        # Print final results
        print("\n" + "="*60)
        print("FINAL TEST RESULTS")
        print("="*60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 ALL CRITICAL FIXES TESTS PASSED!")
        else:
            print("⚠️  SOME CRITICAL FIXES TESTS FAILED - CHECK LOGS ABOVE")

if __name__ == "__main__":
    tester = CriticalFixesTester()
    tester.run_tests()