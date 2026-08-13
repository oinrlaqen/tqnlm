import requests

def get_client_ip(request):
    """Best-effort real client IP, accounting for a reverse proxy/load balancer"""
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')

def lookup_country_from_ip(ip):
    """Returns a country name for the given IP, or None if it can't be resolved"""
    if not ip or ip in ('127.0.0.1', 'localhost'):
        return None
    try:
        resp = requests.get(f'https://ipapi.co/{ip}/country_name/', timeout=2)
        if resp.status_code == 200:
            country = resp.text.strip()
            if country and 'error' not in country.lower():
                return country
    except requests.RequestException:
        pass
    return None