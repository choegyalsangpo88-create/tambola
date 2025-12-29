# Winner Notification Helper
# Twilio WhatsApp Integration Active

from twilio.rest import Client
import os
import logging

logger = logging.getLogger(__name__)

def get_twilio_client():
    """Get Twilio client instance"""
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    
    if not account_sid or not auth_token:
        logger.warning("Twilio credentials not configured")
        return None
    
    return Client(account_sid, auth_token)


def send_whatsapp_message(to_number, message):
    """Send WhatsApp message using Twilio"""
    try:
        client = get_twilio_client()
        if not client:
            logger.info(f"📱 [MOCKED WhatsApp] To: {to_number}")
            logger.info(f"   Message: {message}")
            return True
        
        # Format phone numbers for WhatsApp
        from_whatsapp = f"whatsapp:{os.environ.get('TWILIO_WHATSAPP_NUMBER')}"
        to_whatsapp = f"whatsapp:{to_number}" if not to_number.startswith('whatsapp:') else to_number
        
        msg = client.messages.create(
            body=message,
            from_=from_whatsapp,
            to=to_whatsapp
        )
        
        logger.info(f"✅ WhatsApp sent to {to_number} - SID: {msg.sid}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send WhatsApp: {str(e)}")
        return False


def send_winner_whatsapp(phone_number, user_name, prize_type, prize_amount, game_name):
    """Send winner notification via WhatsApp"""
    message = f"""🎉 *Congratulations {user_name}!*

You won *{prize_type}* worth *₹{prize_amount:,.0f}* in *{game_name}*!

🏆 *Prize Details:*
• Prize: {prize_type}
• Amount: ₹{prize_amount:,.0f}
• Game: {game_name}

📱 *To Claim Your Prize:*
Reply to this message with your:
1. Full Name
2. Bank Account Number
3. IFSC Code
4. UPI ID (optional)

Congratulations again! 🎊"""
    
    return send_whatsapp_message(phone_number, message)


def send_winner_email(user_email, user_name, prize_type, prize_amount, game_name):
    """Send congratulations email to winner using SendGrid"""
    try:
        # Check if SendGrid is configured
        sendgrid_key = os.environ.get('SENDGRID_API_KEY')
        if sendgrid_key and sendgrid_key != 'your_sendgrid_key_here':
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail
            
            message = Mail(
                from_email=os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@tambola.com'),
                to_emails=user_email,
                subject=f'🎉 Congratulations! You Won {prize_type}!',
                html_content=f'''
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #F59E0B;">🎉 Congratulations {user_name}!</h1>
                        <p style="font-size: 18px;">You won <strong>{prize_type}</strong> worth <strong>₹{prize_amount:,.0f}</strong> in {game_name}!</p>
                        
                        <div style="background: #FEF3C7; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3>🏆 Prize Details:</h3>
                            <ul>
                                <li>Prize: {prize_type}</li>
                                <li>Amount: ₹{prize_amount:,.0f}</li>
                                <li>Game: {game_name}</li>
                            </ul>
                        </div>
                        
                        <p style="margin-top: 30px;">Congratulations again! 🎊</p>
                        <p>Best regards,<br>Tambola Team</p>
                    </div>
                '''
            )
            
            sg = SendGridAPIClient(sendgrid_key)
            response = sg.send(message)
            logger.info(f"✅ Email sent to {user_email} - Status: {response.status_code}")
            return True
        else:
            # MOCKED - Log instead
            logger.info(f"📧 [MOCKED EMAIL] To: {user_email}")
            logger.info(f"   Subject: 🎉 Congratulations! You Won {prize_type}!")
            logger.info(f"   Prize: ₹{prize_amount:,.0f} in {game_name}")
            return True
        
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False


def send_winner_sms(phone_number, user_name, prize_type, prize_amount):
    """Send congratulations SMS/WhatsApp to winner using Twilio"""
    try:
        # Use WhatsApp instead of SMS (more reliable and cheaper)
        game_name = "Tambola"  # Default game name for SMS
        return send_winner_whatsapp(phone_number, user_name, prize_type, prize_amount, game_name)
        
    except Exception as e:
        logger.error(f"Failed to send SMS: {str(e)}")
        return False


def send_game_invite_whatsapp(phone_number, game_name, host_name, join_link, date, time):
    """Send game invite via WhatsApp"""
    message = f"""🎲 *Tambola Game Invitation!*

You're invited to play *{game_name}*!

🎯 *Game Details:*
• Host: {host_name}
• Date: {date}
• Time: {time}

👉 *Click to Join:*
{join_link}

Just enter your name and get your ticket - no signup needed!

See you there! 🎉"""
    
    return send_whatsapp_message(phone_number, message)
