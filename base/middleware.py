from django.contrib.auth import logout
from django.shortcuts import redirect
from django.urls import reverse
from django.utils import timezone

class FreezeCheckMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated and request.user.is_frozen:
            logout(request)
            return redirect(f"{reverse('login')}?frozen=1")
        return self.get_response(request)

class UpdateLastActivityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.user.is_authenticated:
            now = timezone.now()
            if not request.user.last_activity or (now - request.user.last_activity).total_seconds() > 60:
                request.user.__class__.objects.filter(pk=request.user.pk).update(last_activity=now)
        return response