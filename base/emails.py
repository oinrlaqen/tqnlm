import resend
from django.conf import settings

resend.api_key = settings.RESEND_API_KEY

def send_verification_email(user, raw_token):
    verify_url = f"{settings.FRONTEND_BASE_URL}/verify-email/{raw_token}/"
    resend.Emails.send({
        "from": f"Scriba <{settings.DEFAULT_FROM_EMAIL}>",
        "to": [user.email],
        "subject": "Verify your email",
        "html": (
            f'<p style="font-size:16px; line-height:1.5;"> Welcome to Scriba 👋 </p>'
            f'<p style="font-size:14px; line-height:1.6;"> Thanks for signing up! To get the most out of your account please confirm your email address. </p>'
            f'<p style="margin:20px 0;"> <a href="{verify_url}" style="display:inline-block; padding:10px 16px; background-color:#4f46e5; color:#ffffff; text-decoration:none; border-radius:6px; font-size:14px;"> Verify your email </a> </p>'
            f'<p style="font-size:14px; line-height:1.6;"> This link will expire in {settings.EMAIL_VERIFICATION_TOKEN_TTL_HOURS} hours. </p>'
            f'<p style="font-size:14px; line-height:1.6;"> If you didn’t create this account, just ignore this email. </p>'
        ),
    })