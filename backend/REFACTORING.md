# Backend Refactoring Guide

This document outlines the modular structure for the Tambola PWA backend.

## Current State
The application currently has a monolithic `server.py` (~4800 lines) with all endpoints.

## Existing Modular Structure (Partially Used)
```
/backend/
├── server.py              # Main monolithic file (active)
├── routes/
│   ├── __init__.py
│   ├── auth.py           # Auth routes (exists but not used)
│   ├── games.py          # Game routes (exists but not used)
│   └── tts.py            # TTS routes (exists but not used)
├── models/
│   ├── __init__.py
│   └── schemas.py        # Pydantic models (exists)
├── services/
│   ├── __init__.py
│   └── database.py       # DB connection (exists)
├── utils/
│   ├── __init__.py
│   └── database.py       # Duplicate DB connection
├── ticket_generator.py   # Ticket generation logic
├── winner_detection.py   # Winner detection logic
└── notifications.py      # WhatsApp/SMS notifications
```

## Proposed Final Structure
```
/backend/
├── main.py                # App initialization, middleware, startup
├── routes/
│   ├── __init__.py
│   ├── auth.py           # User auth (Phone/PIN, Google OAuth)
│   ├── admin.py          # Admin panel endpoints
│   ├── games.py          # Game CRUD, tickets, sessions
│   ├── bookings.py       # Booking requests, payments
│   ├── user_games.py     # User-hosted games
│   ├── agents.py         # Agent management
│   └── whatsapp.py       # WhatsApp messaging
├── models/
│   ├── __init__.py
│   └── schemas.py        # All Pydantic models
├── services/
│   ├── __init__.py
│   ├── database.py       # MongoDB connection
│   ├── auth.py           # Auth helpers (get_current_user, verify_admin)
│   ├── game_manager.py   # Auto-game management
│   └── winner_detection.py
├── utils/
│   └── helpers.py        # Utility functions
└── config.py             # Configuration settings
```

## server.py Section Organization

The current server.py is organized into these sections:
1. **Lines 1-35**: Imports and MongoDB setup
2. **Lines 37-327**: Pydantic Models
3. **Lines 329-475**: Auth helpers (get_current_user, verify_admin, verify_agent)
4. **Lines 476-627**: Booking utilities
5. **Lines 629-866**: Phone/PIN Authentication
6. **Lines 868-1105**: Admin User Management & Agent Management
7. **Lines 1108-1375**: Agent Portal
8. **Lines 1377-1625**: Booking with Agent Flow
9. **Lines 1625-2010**: Game CRUD
10. **Lines 2014-2490**: Admin Booking/Request Management
11. **Lines 2495-2640**: Caller Settings & TTS
12. **Lines 2644-2950**: Live Game (start, call, session, end)
13. **Lines 2957-3460**: User Games (host your own)
14. **Lines 3462-4110**: Admin Game Control & WhatsApp
15. **Lines 4112-4150**: WhatsApp Logs
16. **Lines 4153-4820**: Background Tasks (auto-game, winner detection)
17. **Lines 4821-4884**: Startup/Shutdown events

## Migration Strategy

When adding new features:
1. Identify which section the feature belongs to
2. Consider extracting that section to its own route file
3. Import and register the router in server.py
4. Test thoroughly before removing from server.py

## API Endpoint Categories

### Auth Endpoints (/api/auth/*)
- POST /auth/session - Google OAuth exchange
- POST /auth/phone/check - Check if phone exists
- POST /auth/phone/register - Register with phone/PIN
- POST /auth/phone/login - Login with phone/PIN
- GET /auth/me - Get current user
- POST /auth/logout - Logout

### Admin Endpoints (/api/admin/*)
- POST /admin/login - Admin login
- GET /admin/users - List all users
- POST /admin/users/{id}/reset-pin - Reset user PIN
- POST /admin/users/{id}/block - Block user
- GET /admin/bookings - List bookings
- PUT /admin/booking-requests/{id}/approve - Approve booking
- GET /admin/games/{id}/control - Game control panel

### Game Endpoints (/api/games/*)
- GET /games - List games
- POST /games - Create game
- GET /games/{id} - Get game
- POST /games/{id}/start - Start game
- POST /games/{id}/call-number - Call number
- GET /games/{id}/session - Get session

### Booking Endpoints (/api/booking*/*)
- POST /booking-requests - Create booking request
- GET /booking-requests/my - My requests
- PUT /booking-requests/{id}/payment-method - Update payment method

## Notes
- Current monolithic structure works and is tested
- Full migration should be done incrementally
- Each route file should have comprehensive tests
