from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager

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
    
    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

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