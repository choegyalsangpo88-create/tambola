# Six Seven Tambola - Product Requirements Document

## Overview
A full-stack Tambola (Housie) game application designed for Indian players with user authentication, game management, live gameplay, and comprehensive admin capabilities. **Now available as a Progressive Web App (PWA) for installation on mobile devices.**

## Core Features

### 0. Progressive Web App (PWA) ✅ (2026-01-23)
**Features:**
- Installable on Android and iOS home screens
- Standalone mode (no browser UI)
- Custom app icon from provided logo
- Service worker for offline support
- iOS "Add to Home Screen" instructions
- Android native install prompt

**Files:**
- `/public/manifest.json` - App manifest with icons, name, display mode
- `/public/service-worker.js` - Caching and offline support
- `/public/icons/` - App icons in various sizes (48x48 to 512x512)
- `/src/components/InstallPrompt.js` - Install prompt UI for iOS/Android

### 1. User Authentication
- **Google OAuth** via Emergent-managed Google Auth
- Session management with 7-day expiry

### 2. Admin Booking/Ticket Cancellation ✅ (2026-01-22)
**Purpose:** Allow admin to cancel tickets or bookings before game starts for users who want to change tickets

**Features:**
- Cancel individual ticket: `POST /api/admin/tickets/{ticket_id}/cancel`
- Cancel entire booking: `POST /api/admin/bookings/{booking_id}/cancel`
- **Only works for "upcoming" games** - cannot cancel for live/completed
- Cancelled tickets released back to available pool
- Cancel buttons (X icon) in Admin Payments tab

**Booking Lifecycle:**
- **Pending**: Can be confirmed, cancelled, 10-min expiry
- **Confirmed/Paid**: Locked, admin can cancel before game starts
- **Cancelled**: Tickets released back to pool

**Validation Rules:**
- Cannot cancel tickets/bookings for live or completed games
- All actions logged in admin action logs
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
- Prize configuration (Quick Five, Four Corners, Full Sheet Corner, Top/Middle/Bottom Line, 1st/2nd/3rd Full House)
  
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

### 6. UPI + WhatsApp Booking Checkout Flow ✅ (2026-01-19)
**Two-Step Payment Process:**
1. **Step 1: UPI Payment**
   - "Pay ₹<amount> via UPI" button opens `upi://pay` deep link
   - UPI ID: `choegyalsangpo@ibl`
   - Fallback text shown if UPI app doesn't open
   
2. **Step 2: WhatsApp Confirmation**
   - "Send Payment Confirmation on WhatsApp" button opens WhatsApp with pre-filled message
   - WhatsApp Number: +91 8837489781
   - Message format:
     ```
     ✅ PAYMENT DONE

     Game: <game_name>
     Tickets: <ticket_list>
     Amount: ₹<amount>
     Txn Ref: TMB<6_chars>

     📸 Screenshot attached
     ```
   - Fallback text shown if WhatsApp doesn't open

**UI Components:**
- Booking Summary (read-only): Game name, Tickets, Total Amount
- Instruction text between buttons
- Transaction Reference display (TMB + 6 alphanumeric chars)
- "View My Tickets" and "Back to Home" navigation

**Rules:**
- NO automatic redirects - all actions require explicit user clicks
- Both buttons work independently
- Deep links work on mobile; fallback info for desktop users

### 7. Full Sheet Corner Dividend ✅ (2026-01-20)
**Definition:**
A full sheet consists of 6 tickets (1-2-3-4-5-6). The Full Sheet Corner is defined as four numbers:
- Top-left corner of the FIRST ticket (ticket 1, row 0)
- Top-right corner of the FIRST ticket (ticket 1, row 0)
- Bottom-left corner of the LAST ticket (ticket 6, row 2)
- Bottom-right corner of the LAST ticket (ticket 6, row 2)

**Rules:**
- Only applicable if ALL 6 tickets of a sheet are booked by ONE player
- Prize is won when all 4 corner numbers are called
- Detected automatically by `winner_detection.py`

### 8. Ticket Design ✅ (2026-01-20)
**Full Sheet Design (ChatGPT-style):**
- Mustard yellow background
- 6 tickets stacked vertically
- Each ticket has yellow border for individual selection
- "LOTTO TICKET T001" header on each ticket
- 3x9 number grid with black borders
- Page number on first ticket (left side)

**Selection Options:**
- Click single ticket → select individual ticket
- Click "Select All 6" → select entire sheet
- Individual ticket count shown (e.g., "2/6 selected")

### 9. Full Sheet Lucky Draw ✅ (2026-01-22)
**Definition:**
When all regular dividends (Top Line, Middle Line, Bottom Line, Full House, etc.) are claimed, a Lucky Draw is automatically triggered to reward Full Sheet bookers.

**How It Works:**
1. Game auto-detects when all non-Lucky Draw prizes are won
2. Lucky Draw is triggered immediately (not waiting for 90 calls)
3. **NEW: Intro Screen** - Shows announcement "All Dividends Claimed! Now it's time for the Full Sheet Lucky Draw" with "Start the Draw!" button
4. Random selection from all eligible Full Sheets (complete 6-ticket bookings)
5. Casino reel animation displays on frontend
6. Game ends automatically after Lucky Draw winner is announced

**Frontend Animation Phases:**
1. **Intro Phase** - Announcement with eligible count and prize amount, "Start the Draw!" button
2. **Spinning Phase** - Casino-style spinning reel showing all eligible Full Sheet IDs
3. **Winner Phase** - Confetti celebration when winner is shown with Full Sheet ID, Holder Name, Ticket Range, Prize Amount

**Backend Logic (`check_winners_for_session`):**
- Excludes Lucky Draw from dividend count when checking if game should end
- Triggers Lucky Draw when: `all_regular_prizes_won && lucky_draw_prize_exists && !already_won`
- Sets `is_lucky_draw: true` flag on winner data for frontend detection

**API Endpoint:**
- `GET /api/games/{game_id}/lucky-draw` - Returns eligible sheets, winner data, and game status

### 10. Admin Ticket/Booking Cancellation ✅ (2026-01-22)
**Purpose:** Allow admin to cancel tickets or entire bookings before game starts (for users who want to change tickets)

**Endpoints:**
1. `POST /api/admin/tickets/{ticket_id}/cancel` - Cancel single ticket
2. `POST /api/admin/bookings/{booking_id}/cancel` - Cancel entire booking

**Rules:**
- Only works for **upcoming** games (before game starts)
- Cannot cancel tickets/bookings for live or completed games
- Cancelled tickets are released back to available pool
- Game's available_tickets count is updated
- Booking status set to "cancelled" with timestamp

### Removed Features
- **Full Sheet Bonus (FSB)**: Removed due to persistent bugs (2026-01-22)
- **Full Sheet Corner (FSC)**: Removed due to persistent bugs (2026-01-22)
- **Twilio Integration**: Removed, replaced with WhatsApp deep links (2026-01-22)

### 6. User Games (Create Your Own)
- Host private games with share codes
- Assign tickets to players
- Host controls game flow

## Dividend/Prize Types
1. Quick Five - First to mark any 5 numbers
2. Four Corners - All 4 corners marked
3. Top Line, Middle Line, Bottom Line
4. 1st, 2nd, 3rd Full House (sequential claiming)
5. **Full Sheet Lucky Draw** - Random draw from Full Sheet bookers when all other dividends are won

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

### 2026-01-19 (Session 5 - Current)
- **UPI + WhatsApp Booking Checkout Flow (COMPLETED)**
  - Created `/app/frontend/src/pages/BookingCheckout.js` with two-step payment process
  - Added `/checkout/:requestId` route to App.js
  - UPI Payment: `upi://pay` deep link to `choegyalsangpo@ibl`
  - WhatsApp Confirmation: `wa.me/918837489781` with pre-filled message
  - Transaction Reference format: TMB + 6 alphanumeric chars (no I,O,0,1)
  - Added `GET /api/booking-requests/{request_id}` endpoint for direct URL navigation
  - All 14 backend tests passing
  - Test file: `/app/tests/test_booking_checkout.py`

### 2026-01-09 (Session 4)
- **Ticket Generator Bug Fix (CRITICAL)**
  - Fixed ticket generation algorithm that was producing invalid tickets (fewer than 15 numbers)
  - Complete rewrite of `generate_full_sheet()` function with constraint-aware distribution
  - Added `_find_valid_distribution()` to ensure each ticket gets exactly 15 numbers
  - Added `_validate_full_sheet()` for robust validation
  - Multiple fallback methods ensure 100% success rate (tested with 2000+ sheets)
  - Old tickets in database still have the bug - only newly generated tickets are fixed
  - Test file created: `/app/tests/test_ticket_generator.py` with 24 test cases

- **WhatsApp Number Update**
  - Updated WhatsApp number from `916909166157` to `918837489781` in `GameDetails.js`
  
- **Mobile Authentication Fix**
  - Added `getAuthHeaders()` function to `GameDetails.js`
  - Added Authorization Bearer header to API calls for mobile fallback
  - Fixes "Not authenticated" error when booking via WhatsApp on mobile

### 2025-01-09 (Session 3)
- **Multi-Region WhatsApp Agent System**
  - Added Agent model and AgentSession for authentication
  - Created Agent Panel (`/agent`) with Dashboard, My Bookings, Profile tabs
  - Added Agents tab to Admin Panel with CRUD functionality
  - Implemented country code based agent assignment (+91 India, +33 France, +1 Canada)
  - Booking lifecycle: Pending (10-min expiry) → Paid (locked) → Cancelled (history)
  - Agent actions: Mark Paid, Cancel (release tickets)
  - Strict validation: agents only access own bookings, cannot modify live/completed games
  - Fixed MongoDB ObjectId serialization in create_agent endpoint
  - All 30 backend tests passing

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
- [x] ~~Ticket Generator Bug~~ - FIXED (2026-01-09)
- [x] ~~WhatsApp Number Update~~ - FIXED (2026-01-09)
- [x] ~~Mobile Authentication Fix~~ - FIXED (2026-01-09)
- [x] ~~UPI + WhatsApp Booking Flow~~ - COMPLETED (2026-01-19)

### P1 - Medium Priority
- [ ] Admin Panel enhancements: Payment History revamp, Players contact list, WhatsApp on payment approval
- [ ] In-game chat feature
- [ ] Backend refactoring (`server.py` → modular routes)

### P2 - Future
- [ ] Global leaderboard and player rankings
- [ ] Game replay feature
- [ ] Performance optimization
- [ ] Mobile audio reliability improvement
- [ ] Admin analytics dashboard

---

## Known Issues (Pending Verification)
1. **Google Login on Custom Domain** - CORS fix applied, requires redeployment to `sixseventambola.com`
2. **WhatsApp Login on Mobile** - Session token fix applied with auth headers, requires redeployment
3. **Old Tickets in Database** - Tickets created before the fix may have invalid numbers (< 15). Only newly created games have valid tickets.
