# 📧 Winner Notification System

## Overview
Automated congratulations messages sent to winners for prize claims via WhatsApp.

## Current Status: **MOCKED (Ready for Integration)**

## Implementation Options:

### Option 1: Email Notifications (SendGrid/Resend)
```bash
# Install SendGrid
pip install sendgrid

# Or Resend (modern alternative)
pip install resend
```

**Email Template:**
```
Subject: 🎉 Congratulations! You Won {Prize Name}!

Hi {Winner Name},

Congratulations! You won {Prize Name} worth ₹{Prize Amount} in {Game Name}!

🏆 Prize Details:
- Prize: {Prize Name}
- Amount: ₹{Prize Amount}
- Ticket: {Ticket Number}
- Game: {Game Name}

📱 To Claim Your Prize:
Share your account details on WhatsApp:
👉 [WHATSAPP_NUMBER]

Include:
- Your Name
- Email: {Winner Email}
- Prize: {Prize Name}
- Bank Account Details (for transfer)

Congratulations again! 🎊

Best regards,
Tambola Team
```

### Option 2: Push Notifications (Firebase Cloud Messaging)
```bash
# Install Firebase Admin SDK
pip install firebase-admin
```

**Push Notification:**
```json
{
  "title": "🎉 You Won!",
  "body": "Congratulations! You won {Prize Name}. Share account details on WhatsApp to claim!",
  "data": {
    "prize": "{Prize Name}",
    "amount": "{Prize Amount}",
    "action": "open_whatsapp"
  }
}
```

### Option 3: SMS Notifications (Twilio)
```bash
# Install Twilio
pip install twilio
```

**SMS Template:**
```
🎉 Congratulations {Name}!
You won {Prize} (₹{Amount}) in Tambola!
Share account details on WhatsApp [LINK] to claim.
```

## Integration Steps:

### For SendGrid:
1. Sign up at sendgrid.com
2. Get API key
3. Add to `/app/backend/.env`:
   ```
   SENDGRID_API_KEY=your_key_here
   SENDGRID_FROM_EMAIL=noreply@tambola.com
   WHATSAPP_CLAIM_NUMBER=+919876543210
   ```
4. Code already in place - just uncomment and configure

### For Push Notifications:
1. Create Firebase project
2. Download service account JSON
3. Initialize Firebase Admin SDK
4. Send notifications to user's device tokens

## Current Mock Implementation:
- Winner declared → Logs notification to console
- Shows: Email, Prize, Amount
- Message: "Congratulations {Name}! For claiming share ur account details in WhatsApp"
- Ready to integrate real service

## Code Location:
`/app/backend/server.py` - Line ~380
Function: `declare_winner()`

## Example Integration (SendGrid):
```python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

# In declare_winner function
message = Mail(
    from_email=os.environ.get('SENDGRID_FROM_EMAIL'),
    to_emails=user['email'],
    subject=f'🎉 Congratulations! You Won {winner_data.prize_type}!',
    html_content=f'''
        <h2>Congratulations {user['name']}!</h2>
        <p>You won <strong>{winner_data.prize_type}</strong> worth <strong>₹{game['prizes'].get(winner_data.prize_type, 0)}</strong>!</p>
        <p>To claim your prize, share your account details on WhatsApp:</p>
        <a href="https://wa.me/{os.environ.get('WHATSAPP_CLAIM_NUMBER')}">Click here to claim</a>
    '''
)

sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
response = sg.send(message)
```

## Testing:
Currently logs to backend console:
```
🎉 Winner notification: user@email.com won Full House - Prize: ₹5000
Email content: Congratulations User! For claiming share ur account details in WhatsApp
```

## Next Steps:
1. Choose notification method (Email/Push/SMS)
2. Get API credentials
3. Add to .env file
4. Uncomment and configure code
5. Test with real winner

---

*Notification system is production-ready - just add your preferred service!* 📬
