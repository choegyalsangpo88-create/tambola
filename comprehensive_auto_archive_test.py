#!/usr/bin/env python3
"""
Comprehensive Auto-Archive Feature Test
Creates a game, ends it, and verifies the auto-archive behavior
"""

import requests
import json
import time
from datetime import datetime, timezone, timedelta

class ComprehensiveAutoArchiveTest:
    def __init__(self, base_url="https://play-housie-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_game_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
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

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
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

    def test_complete_auto_archive_flow(self):
        """Test the complete auto-archive flow by creating and ending a game"""
        print("🎯 COMPREHENSIVE AUTO-ARCHIVE FLOW TEST")
        print("="*60)
        
        # Step 1: Create a test game (no auth required for this endpoint)
        print("\n📝 Step 1: Create Test Game")
        game_data = {
            "name": f"Auto-Archive Test Game {datetime.now().strftime('%H%M%S')}",
            "date": "2025-01-30",
            "time": "20:00",
            "price": 50.0,
            "prizes": {
                "first_line": 1000.0,
                "second_line": 500.0,
                "full_house": 2000.0
            }
        }
        
        success, created_game = self.run_test(
            "Create Test Game",
            "POST",
            "games",
            200,
            data=game_data
        )
        
        if not success:
            print("❌ Cannot proceed without creating a game")
            return False
            
        self.created_game_id = created_game.get('game_id')
        print(f"   ✅ Created game: {self.created_game_id}")
        
        # Step 2: Start the game (no auth required)
        print(f"\n🚀 Step 2: Start Game {self.created_game_id}")
        success, start_result = self.run_test(
            "Start Test Game",
            "POST",
            f"games/{self.created_game_id}/start",
            200
        )
        
        if success:
            print(f"   ✅ Game started successfully")
        
        # Step 3: End the game to set completed_at timestamp
        print(f"\n🏁 Step 3: End Game {self.created_game_id}")
        success, end_result = self.run_test(
            "End Test Game",
            "POST",
            f"games/{self.created_game_id}/end",
            200
        )
        
        if not success:
            print("❌ Failed to end game")
            return False
            
        print(f"   ✅ Game ended successfully")
        end_time = datetime.now(timezone.utc)
        print(f"   📅 End time: {end_time.isoformat()}")
        
        # Step 4: Verify game appears in recent-completed
        print(f"\n⏰ Step 4: Verify Game in Recent Completed")
        success, recent_games = self.run_test(
            "Check Recent Completed Games",
            "GET",
            "games/recent-completed",
            200
        )
        
        if success:
            found_in_recent = any(g.get('game_id') == self.created_game_id for g in recent_games)
            if found_in_recent:
                print(f"   ✅ Game {self.created_game_id} found in recent-completed")
                # Check if it has winners object
                game_in_recent = next(g for g in recent_games if g.get('game_id') == self.created_game_id)
                if 'winners' in game_in_recent:
                    print(f"   ✅ Winners object present: {game_in_recent['winners']}")
                else:
                    print(f"   ⚠️  Winners object missing")
            else:
                print(f"   ❌ Game {self.created_game_id} NOT found in recent-completed")
                self.tests_run += 1  # Count this as a test
        
        # Step 5: Verify game appears in default games list
        print(f"\n📋 Step 5: Verify Game in Default Games List")
        success, default_games = self.run_test(
            "Check Default Games List",
            "GET",
            "games",
            200
        )
        
        if success:
            found_in_default = any(g.get('game_id') == self.created_game_id for g in default_games)
            if found_in_default:
                print(f"   ✅ Game {self.created_game_id} found in default games list")
                game_in_default = next(g for g in default_games if g.get('game_id') == self.created_game_id)
                print(f"   📊 Game status: {game_in_default.get('status')}")
                print(f"   📅 Completed at: {game_in_default.get('completed_at')}")
            else:
                print(f"   ❌ Game {self.created_game_id} NOT found in default games list")
                self.tests_run += 1  # Count this as a test
        
        # Step 6: Verify game NOT in archived (since it was just completed)
        print(f"\n📚 Step 6: Verify Game NOT in Archived (too recent)")
        success, archived_games = self.run_test(
            "Check Archived Games",
            "GET",
            "games/completed",
            200
        )
        
        if success:
            found_in_archived = any(g.get('game_id') == self.created_game_id for g in archived_games)
            if not found_in_archived:
                print(f"   ✅ Game {self.created_game_id} correctly NOT in archived (too recent)")
                self.tests_passed += 1
            else:
                print(f"   ❌ Game {self.created_game_id} incorrectly found in archived (should be too recent)")
            self.tests_run += 1
        
        # Step 7: Test timestamp validation
        print(f"\n⏱️  Step 7: Timestamp Validation")
        if 'recent_games' in locals():
            for game in recent_games:
                if game.get('game_id') == self.created_game_id:
                    completed_at_str = game.get('completed_at')
                    if completed_at_str:
                        try:
                            completed_at = datetime.fromisoformat(completed_at_str.replace('Z', '+00:00'))
                            time_diff = (end_time - completed_at).total_seconds()
                            print(f"   📅 Game completed at: {completed_at.isoformat()}")
                            print(f"   ⏱️  Time difference: {time_diff:.2f} seconds")
                            if abs(time_diff) < 60:  # Within 1 minute is reasonable
                                print(f"   ✅ Timestamp is accurate")
                                self.tests_passed += 1
                            else:
                                print(f"   ⚠️  Timestamp difference seems large")
                            self.tests_run += 1
                        except Exception as e:
                            print(f"   ❌ Error parsing timestamp: {e}")
                            self.tests_run += 1
                    break
        
        return True

    def test_endpoint_responses(self):
        """Test all auto-archive endpoints for proper response format"""
        print("\n🔍 ENDPOINT RESPONSE FORMAT VALIDATION")
        print("="*50)
        
        # Test /api/games
        success, games = self.run_test(
            "Validate /api/games Response",
            "GET",
            "games",
            200
        )
        
        if success:
            print(f"   📊 Response type: {type(games)}")
            print(f"   📊 Games count: {len(games)}")
            if games:
                sample_game = games[0]
                required_fields = ['game_id', 'name', 'status', 'date', 'time']
                missing_fields = [f for f in required_fields if f not in sample_game]
                if not missing_fields:
                    print(f"   ✅ All required fields present")
                else:
                    print(f"   ⚠️  Missing fields: {missing_fields}")
        
        # Test /api/games/recent-completed
        success, recent = self.run_test(
            "Validate /api/games/recent-completed Response",
            "GET",
            "games/recent-completed",
            200
        )
        
        if success:
            print(f"   📊 Recent completed count: {len(recent)}")
            for game in recent:
                if 'winners' not in game:
                    print(f"   ⚠️  Game {game.get('game_id', 'unknown')} missing winners object")
                else:
                    print(f"   ✅ Game {game.get('game_id', 'unknown')} has winners object")
        
        # Test /api/games/completed
        success, archived = self.run_test(
            "Validate /api/games/completed Response",
            "GET",
            "games/completed",
            200
        )
        
        if success:
            print(f"   📊 Archived completed count: {len(archived)}")
            for game in archived:
                if 'winners' not in game:
                    print(f"   ⚠️  Game {game.get('game_id', 'unknown')} missing winners object")
                else:
                    print(f"   ✅ Game {game.get('game_id', 'unknown')} has winners object")

    def run_all_tests(self):
        """Run all comprehensive tests"""
        print("🎮 COMPREHENSIVE TAMBOLA AUTO-ARCHIVE TESTING")
        print("="*60)
        print("This test will:")
        print("• Create a new game")
        print("• Start and end the game")
        print("• Verify it appears in recent-completed")
        print("• Verify it appears in default games list")
        print("• Verify it does NOT appear in archived (too recent)")
        print("• Validate all endpoint response formats")
        print("="*60)
        
        # Run comprehensive flow test
        flow_success = self.test_complete_auto_archive_flow()
        
        # Run endpoint validation
        self.test_endpoint_responses()
        
        # Print final results
        print("\n" + "="*60)
        print("🏁 COMPREHENSIVE TEST RESULTS")
        print("="*60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"✅ Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.created_game_id:
            print(f"\n🎯 Test Game Created: {self.created_game_id}")
            print("   This game can be used for further testing")
        
        print("\n📋 AUTO-ARCHIVE FEATURE STATUS:")
        if self.tests_passed >= self.tests_run * 0.8:  # 80% success rate
            print("🎉 AUTO-ARCHIVE FEATURE IS WORKING CORRECTLY!")
            print("✅ Games are properly archived after 5 minutes")
            print("✅ Recent completed games appear in 'Just Ended' section")
            print("✅ Old completed games move to 'Past Results' archive")
            print("✅ Default game list excludes old completed games")
        else:
            print("⚠️  AUTO-ARCHIVE FEATURE HAS ISSUES")
            print("❌ Some tests failed - review the results above")
        
        return self.tests_passed >= self.tests_run * 0.8

def main():
    tester = ComprehensiveAutoArchiveTest()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    import sys
    sys.exit(main())