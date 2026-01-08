# Six Seven Tambola - Product Requirements Document

## Overview
A full-stack Tambola (Housie) game application designed for Indian players with user authentication, game management, live gameplay, and comprehensive admin capabilities.

## Core Features

### 1. User Authentication
- **Google OAuth** via Emergent-managed Google Auth
- **WhatsApp OTP** for phone number authentication (Twilio integration)
- Session management with 7-day expiry

### 2. Game Dashboard
- Display "Live" and "Upcoming" games
- Recently completed games (within 5 minutes)
- Game cards with status, price, tickets available

### 3. Live Game Screen
- Real-time number calling
- Ticket marking interface
- Winner announcements
- Audio announcements (OpenAI TTS)
- Auto-caller functionality

### 4. Admin Panel (`/control-ceo`)
**Completed Sections:**
- ✅ **Create Game Section**
  - Game name, date, time fields
  - Tickets count (must be multiple of 6 for full sheets)
  - Price per ticket
  - Prize configuration (Quick Five, Four Corners, Full Sheet Bonus, Top/Middle/Bottom Line, 1st/2nd/3rd Full House)
  
- ✅ **Manage Games Section**
  - Table view with columns: Game, Date & Time, Tickets (with progress bar), Revenue, Status, Actions
  - Status badges: UPCOMING (amber), LIVE (red/animated), COMPLETED (gray)
  - Admin actions:
    - View Details → Opens modal with stats, prizes, winners
    - Start Game → Transitions Upcoming → Live
    - End Game → Transitions Live → Completed
    - Edit (upcoming only)
    - Delete (with force for live games)
  - Rules enforced:
    - Games can only be started around scheduled time (warning if off-schedule)
    - Completed games are read-only

- ✅ **Requests Tab** - Booking approval workflow
- ✅ **Payments Tab** - Revenue overview, booking confirmations
- ✅ **WhatsApp Tab** - Template-based messaging
- ✅ **Logs Tab** - Admin action audit trail
- ✅ **Settings Tab** - Caller voice configuration

### 5. Booking System
- Ticket selection from available pool
- Full Sheet Bonus eligibility (6 tickets from same sheet)
- Pending → Approved workflow
- WhatsApp confirmation

### 6. User Games (Create Your Own)
- Host private games with share codes
- Assign tickets to players
- Host controls game flow

## Dividend/Prize Types
1. Quick Five - First to mark any 5 numbers
2. Four Corners - All 4 corners marked
3. Full Sheet Bonus - Book all 6 tickets of a full sheet
4. Top Line, Middle Line, Bottom Line
5. 1st, 2nd, 3rd Full House (sequential claiming)

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI
- **Backend:** FastAPI, Python
- **Database:** MongoDB
- **Integrations:** Twilio (WhatsApp), OpenAI TTS, Emergent Google Auth

## Credentials
- Admin Panel: `/control-ceo`
- Username: `sixtysevenceo`
- Password: `Freetibet123!@#`

---

## Changelog

### 2025-01-08
- **Admin Panel Overhaul - Phase 1**
  - Redesigned Games tab with separate "Create Game" and "Manage Games" sections
  - Added table-like layout for game list with column headers
  - Added progress bars for tickets sold
  - Added Game Details modal with comprehensive stats, prizes, and winner info
  - Added End Game functionality for live games
  - Added read-only indicator for completed games
  - Added data-testid attributes for testing
  - All 17 backend tests passing

### Previous Session
- Fixed dividend detection logic (Quick Five, Full Sheet Bonus, sequential Full Houses)
- Fixed ticket generation (proper 90-number full sheets)
- Fixed WhatsApp OTP mobile authentication
- Fixed CORS for custom domain
- UI cleanup on Live Game screen

---

## Pending / Backlog

### P0 - High Priority
- [ ] More Admin Panel sections (user to provide specs)

### P1 - Medium Priority
- [ ] In-game chat feature
- [ ] Backend refactoring (`server.py` → modular routes)

### P2 - Future
- [ ] Global leaderboard and player rankings
- [ ] Game replay feature
- [ ] Performance optimization
- [ ] Mobile audio reliability improvement

---

## Known Issues (Pending Verification)
1. **Google Login on Custom Domain** - CORS fix applied, requires redeployment
2. **WhatsApp Login on Mobile** - Session token fix applied, requires redeployment
