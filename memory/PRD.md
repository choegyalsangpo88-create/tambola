# Six Seven Tambola - Product Requirements Document

## Overview
A full-stack Tambola (Housie) game application designed for Indian players with user authentication, game management, live gameplay, and comprehensive admin capabilities.

## Core Features

### 1. User Authentication
- **Google OAuth** via Emergent-managed Google Auth
- **WhatsApp OTP** for phone number authentication (Twilio integration)
- Session management with 7-day expiry

### 2. Multi-Region Agent System ✅ (NEW)
**Roles:**
- **Super Admin**: Full access to all data and actions
- **Agent**: Limited access only to own assigned bookings

**Features:**
- Auto-assign agents based on player phone country code
  - +91 → India agent
  - +33 → France agent
  - +1 → Canada agent
- Click-to-chat WhatsApp redirect (no API automation)
- 10-minute booking expiry for pending payments

**Agent Panel (`/agent`):**
- Dashboard: Stats (pending/paid/total bookings, revenue)
- My Bookings: View and manage assigned bookings
- Profile: View agent details and assigned region

**Admin Panel - Agents Tab:**
- Create/Edit/Deactivate agents
- Region assignment rules view
- Booking stats per agent

**Booking Lifecycle:**
- **Pending**: Can be marked as Paid or Cancelled, 10-min expiry
- **Paid**: Locked, no modifications allowed
- **Cancelled**: Stored for history, tickets released

**Agent Actions:**
- Mark Pending booking as Paid (after WhatsApp payment verification)
- Cancel Pending booking (releases tickets back to pool)
- Cannot modify Live/Completed game bookings

**Validation Rules:**
- Agents only see own assigned bookings
- Cannot cancel Paid bookings
- Cannot modify Live/Completed game bookings
- All actions validated server-side

### 3. Game Dashboard
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

#### Create Game Section ✅
- Game name, date, time fields
- Tickets count (must be multiple of 6 for full sheets)
- Price per ticket
- Prize configuration (Quick Five, Four Corners, Full Sheet Bonus, Top/Middle/Bottom Line, 1st/2nd/3rd Full House)
  
#### Manage Games Section ✅
- Table view with columns: Game, Date & Time, Tickets (with progress bar), Revenue, Status, Actions
- Status badges: UPCOMING (amber), LIVE (red/animated), COMPLETED (gray)
- Admin actions: View Details, Game Control, Start Game, End Game, Edit, Delete
- Rules: Games can only be started around scheduled time, Completed games are read-only

#### Game Control Page ✅
**A. Game Info (Read-Only)**
- Game name, date, time, status badge
- Price per ticket, Prize pool
- Prize configuration list
- "Locked" indicator when tickets are sold (cannot edit after tickets sold)

**B. Bookings Management ✅ (NEW)
Shows for each booking:
- Player name
- Phone number (masked: ****1234)
- Ticket numbers (with View Details button)
- Payment status (Pending / Paid)
- WhatsApp opt-in (YES/NO)
- WhatsApp message status (SENT/DELIVERED/FAILED)

Admin actions:
- Approve Payment → auto-triggers WhatsApp confirmation if opt-in=true
- View ticket details (opens modal with ticket grid preview)

Rules enforced:
- WhatsApp message only sent if opt-in = true
- No bulk resend option (individual only)

**C. WhatsApp Controls (Buttons Only)**
1. **Send Booking Confirmation**
   - Only after payment is approved
   - Can only be sent once per booking
   - Button disabled after sent
   - Respects whatsapp_opt_in

2. **Send Game Reminder**
   - Can only be sent once per game
   - Only allowed within 24 hours before game time
   - Only sends to users with opt-in=true
   - Button shows "Not Available" outside window

3. **Send Join Link**
   - Manual per user
   - Can be resent (no limit)

**D. WhatsApp Message Logs ✅ (NEW)**
Each log entry shows:
- User (recipient name)
- Game ID
- Template name (booking_confirmation_v1, game_reminder_v1, join_link_v1, winner_announcement_v1)
- Status (sent / delivered / failed)
- Timestamp
- Failure reason (if any)

Rules:
- Logs are **immutable** (read-only, no update/delete operations)
- Logs stored in `whatsapp_logs` collection

**E. Winner Declaration ✅ (NEW)**
For Live/Completed games only:
- **Game Winners Table** showing: Prize, Winner name, Ticket, Amount, WA Status, Action
- **Send WA button** to send individual winner announcement via WhatsApp
- **Prize Pool Reference** showing all prizes with checkmark for claimed prizes

Admin actions:
- Send winner announcement WhatsApp message (one per prize, no bulk)
- View all winners with announcement status

Rules enforced:
- One winner per prize
- No bulk winner messages
- Winner announcement can only be sent once per prize
- Only available for live/completed games (upcoming shows "Winners Available After Game Starts")

#### Requests Tab ✅
- Booking approval workflow

#### Payments Tab ✅
- Revenue overview, booking confirmations

#### WhatsApp Tab ✅
- Template-based messaging overview

#### Logs Tab ✅
- Admin action audit trail

#### Settings Tab ✅
- Caller voice configuration

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

## Database Collections
- `games` - Game definitions
- `tickets` - Individual tickets per game
- `bookings` - User ticket bookings
- `booking_requests` - Pending approval requests
- `whatsapp_logs` - WhatsApp message tracking (NEW)
- `game_control_logs` - Admin activity logs (NEW)
- `user_sessions` - Auth sessions
- `admin_sessions` - Admin auth sessions

## Credentials
- Admin Panel: `/control-ceo`
- Username: `sixtysevenceo`
- Password: `Freetibet123!@#`

---

## Changelog

### 2025-01-08 (Session 2 - Part 3)
- **Winner Declaration Section**
  - Added Winners tab in Game Control Modal
  - Winner Declaration banner with policy: "One message per prize - no bulk messages allowed"
  - Game Winners table with columns: Prize, Winner, Ticket, Amount, WA Status, Action
  - Send WA button to send individual winner announcements
  - Prize Pool Reference showing prizes with checkmarks for claimed
  - New endpoints:
    - `POST /api/admin/games/{game_id}/whatsapp/winner-announcement`
    - `GET /api/admin/games/{game_id}/winners`
  - All 16 backend tests passing

### 2025-01-08 (Session 2 - Part 2)
- **Bookings Management Section**
  - Added Bookings tab with table showing: Player, Phone, Tickets, Payment status, WA Opt-in, WA Status
  - Approve Payment auto-triggers WhatsApp confirmation if opt-in=true
  - View ticket details button shows ticket grid preview
  - Auto WhatsApp note: "When you approve payment, confirmation is sent automatically"

- **WhatsApp Message Logs**
  - Added immutable WhatsApp logs table with columns: User, Game ID, Template, Status, Timestamp, Failure Reason
  - Enhanced WhatsAppMessageLog model: template_name, delivery_status, failure_reason
  - New endpoint: GET /api/admin/whatsapp-logs
  - Added whatsapp_opt_in field to Booking model
  - All 14 backend tests passing

### 2025-01-08 (Session 2)
- **Game Control Page Implementation**
  - Created `/app/frontend/src/components/GameControlModal.js` with 4 tabs
  - Added Control button (gamepad icon) to game actions in Manage Games
  - Implemented backend endpoints:
    - `GET /api/admin/games/{game_id}/control` - Comprehensive game data
    - `POST /api/admin/games/{game_id}/whatsapp/booking-confirmation`
    - `POST /api/admin/games/{game_id}/whatsapp/game-reminder`
    - `POST /api/admin/games/{game_id}/whatsapp/join-link`
  - Added WhatsApp message tracking in `whatsapp_logs` collection
  - Added control activity logging in `game_control_logs` collection
  - All 15 backend tests passing

### 2025-01-08 (Session 1)
- Admin Panel Overhaul - Create Game and Manage Games sections
- All 17 backend tests passing

### Previous Session
- Fixed dividend detection logic
- Fixed ticket generation
- Fixed WhatsApp OTP mobile authentication
- Fixed CORS for custom domain
- UI cleanup on Live Game screen

---

## Pending / Backlog

### P0 - High Priority
- [ ] Additional Admin Panel sections (awaiting user specs)

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
