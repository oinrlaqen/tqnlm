def verification_banner(request):
    if request.user.is_authenticated and request.user.requires_email_verification:
        return {'unverified_banner': True, 'unverified_email': request.user.email}
    return {}