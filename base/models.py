from django.db import models, transaction
from django.contrib.auth.models import AbstractUser, BaseUserManager

import hashlib
from django.utils import timezone
from datetime import timedelta
from django.conf import settings

import secrets

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email required')
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)

    SIGNUP_EMAIL = 'email'
    SIGNUP_GOOGLE = 'google'
    SIGNUP_CHOICES = [(SIGNUP_EMAIL, 'Email/Password'), (SIGNUP_GOOGLE, 'Google')]

    signup_provider = models.CharField(max_length=10, choices=SIGNUP_CHOICES, default=SIGNUP_EMAIL)
    is_email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    last_activity = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=100, null=True, blank=True)
    is_frozen = models.BooleanField(default=False)
    frozen_reason = models.CharField(max_length=255, null=True, blank=True)
    frozen_at = models.DateTimeField(null=True, blank=True)

    
    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    # --- verification helper properties ---
    @property
    def requires_email_verification(self):
        return self.signup_provider == self.SIGNUP_EMAIL and not self.is_email_verified

    @property
    def note_limit(self):
        return settings.UNVERIFIED_NOTE_LIMIT if self.requires_email_verification else None

    @property
    def note_max_chars(self):
        return (
            settings.UNVERIFIED_NOTE_MAX_CHARS
            if self.requires_email_verification
            else settings.VERIFIED_NOTE_MAX_CHARS
        )

class EmailVerificationToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verification_tokens')
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['user', 'used_at'])]

    @staticmethod
    def _hash(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode()).hexdigest()

    @classmethod
    def issue(cls, user):
        """Invalidates any prior unused tokens for this user, then creates + returns (instance, raw_token)"""
        cls.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
        raw_token = secrets.token_urlsafe(32)
        instance = cls.objects.create(
            user=user,
            token_hash=cls._hash(raw_token),
            expires_at=timezone.now() + timedelta(hours=settings.EMAIL_VERIFICATION_TOKEN_TTL_HOURS),
        )
        return instance, raw_token

    @classmethod
    def consume(cls, raw_token):
        """Returns the associated user if the token is valid and unused, else None. Marks it used atomically"""
        token_hash = cls._hash(raw_token)
        with transaction.atomic():
            try:
                obj = cls.objects.select_for_update().get(token_hash=token_hash)
            except cls.DoesNotExist:
                return None
            if obj.used_at is not None or obj.expires_at < timezone.now():
                return None
            obj.used_at = timezone.now()
            obj.save(update_fields=['used_at'])
            return obj.user

class Tag(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tags')
    name = models.CharField(max_length=20)

    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']
        unique_together = [['user', 'name']]

class Note(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name='notes')
    created = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title
    
    class Meta:
        ordering = ['created']

class NoteToken(models.Model):
    token = models.CharField(max_length=20, unique=True, db_index=True)
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='tokens')
    
    @staticmethod
    def generate_token():
        return secrets.token_urlsafe(10)