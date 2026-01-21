# Winner Notification Helper
# WhatsApp messages are now sent via deep links (no Twilio API)

import os
import logging

logger = logging.getLogger(__name__)


def send_whatsapp_message(to_number, message):
    """
    DEPRECATED: WhatsApp messages are now sent via deep links from the frontend.
    This function is kept for backward compatibility but only logs the message.
    """
    logger.info(f"📱 [WhatsApp via Deep Link] To: {to_number}")
    logger.info(f"   Message preview: {message[:100]}...")
    return True


def send_winner_whatsapp(phone_number, user_name, prize_type, prize_amount, game_name):
    """
    DEPRECATED: Winner notifications are now sent via deep links from the admin panel.
    """
    logger.info(f"🏆 [Winner Notification] {user_name} won {prize_type} (₹{prize_amount}) in {game_name}")
    return True


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
    """
    DEPRECATED: SMS/WhatsApp notifications are now sent via deep links.
    """
    logger.info(f"📱 [Winner SMS/WhatsApp] {user_name} - {prize_type} (₹{prize_amount})")
    return True


def send_game_invite_whatsapp(phone_number, game_name, host_name, join_link, date, time):
    """
    DEPRECATED: Game invites are now sent via deep links from the frontend.
    """
    logger.info(f"📱 [Game Invite] To: {phone_number} for {game_name}")
    return True
