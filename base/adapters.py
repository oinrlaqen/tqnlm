from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.urls import reverse
from django.utils import timezone


class AccountAdapter(DefaultAccountAdapter):
    def get_login_redirect_url(self, request):
        return reverse('notes')


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        email = sociallogin.account.extra_data.get('email')
        if not email:
            return

        User = sociallogin.user.__class__
        try:
            existing_user = User.objects.get(email=email)
        except User.DoesNotExist:
            return

        if not sociallogin.is_existing:
            sociallogin.connect(request, existing_user)

            if existing_user.signup_provider == User.SIGNUP_EMAIL and not existing_user.is_email_verified:
                existing_user.is_email_verified = True
                existing_user.email_verified_at = timezone.now()
                existing_user.save(update_fields=['is_email_verified', 'email_verified_at'])

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)

        if sociallogin.account.provider == 'google':
            user.signup_provider = user.SIGNUP_GOOGLE
            user.is_email_verified = True
            user.email_verified_at = timezone.now()
            user.save(update_fields=['signup_provider', 'is_email_verified', 'email_verified_at'])

        return user