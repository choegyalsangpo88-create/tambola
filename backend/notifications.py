# Winner Notification Helper
# Uncomment and configure when you have SendGrid/Twilio credentials

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from twilio.rest import Client
import os
import logging

logger = logging.getLogger(__name__)

def send_winner_email(user_email, user_name, prize_type, prize_amount, game_name):
    """Send congratulations email to winner using SendGrid"""
    try:
        # Uncomment when you have SENDGRID_API_KEY
        """
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
                    
                    <div style="background: #D1FAE5; padding: 20px; border-radius: 10px;">
                        <h3>📱 To Claim Your Prize:</h3>
                        <p>Share your account details on WhatsApp:</p>
                        <a href="https://wa.me/{os.environ.get('WHATSAPP_CLAIM_NUMBER', '+919876543210')}" 
                           style="display: inline-block; background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0;">
                            Click here to claim on WhatsApp
                        </a>
                        <p style="font-size: 14px; color: #666;">Include your name, email, prize name, and bank account details.</p>
                    </div>
                    
                    <p style="margin-top: 30px;">Congratulations again! 🎊</p>
                    <p>Best regards,<br>Tambola Team</p>
                </div>
            '''
        )
        
        sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
        response = sg.send(message)
        logger.info(f"✅ Email sent to {user_email} - Status: {response.status_code}")
        return True
        """
        
        # MOCKED - Log instead
        logger.info(f"📧 [MOCKED EMAIL] To: {user_email}")
        logger.info(f"   Subject: 🎉 Congratulations! You Won {prize_type}!")
        logger.info(f"   Prize: ₹{prize_amount:,.0f} in {game_name}")
        logger.info(f"   Message: Share account details on WhatsApp {os.environ.get('WHATSAPP_CLAIM_NUMBER', '+919876543210')}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False


def send_winner_sms(phone_number, user_name, prize_type, prize_amount):
    """Send congratulations SMS to winner using Twilio"""
    try:
        # Uncomment when you have Twilio credentials
        """
        client = Client(
            os.environ.get('TWILIO_ACCOUNT_SID'),
            os.environ.get('TWILIO_AUTH_TOKEN')
        )
        
        message = client.messages.create(
            body=f"🎉 Congratulations {user_name}! You won {prize_type} (₹{prize_amount:,.0f}) in Tambola! Share account details on WhatsApp {os.environ.get('WHATSAPP_CLAIM_NUMBER')} to claim.",
            from_=os.environ.get('TWILIO_FROM_NUMBER'),
            to=phone_number
        )
        
        logger.info(f"✅ SMS sent to {phone_number} - SID: {message.sid}")
        return True
        """
        
        # MOCKED - Log instead
        logger.info(f"📱 [MOCKED SMS] To: {phone_number}")
        logger.info(f"   Message: 🎉 Congratulations {user_name}! You won {prize_type} (₹{prize_amount:,.0f})!")
        logger.info(f"   Claim on WhatsApp: {os.environ.get('WHATSAPP_CLAIM_NUMBER', '+919876543210')}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send SMS: {str(e)}")
        return False
