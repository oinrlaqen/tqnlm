from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.urls import reverse

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