from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic.list import ListView
from django.views.generic.detail import DetailView
from django.views.generic.edit import CreateView, UpdateView, DeleteView, FormView
from django.views.decorators.http import require_http_methods
from django.urls import reverse_lazy, reverse

from django.utils import timezone

from django.contrib.auth.views import LoginView
from django.contrib.auth.views import LogoutView

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash

from django_ratelimit.decorators import ratelimit

from .models import User, Note, Tag, NoteToken, EmailVerificationToken
from .forms import EmailLoginForm, EmailRegisterForm, NoteForm
from .emails import send_verification_email
from .utils import get_client_ip, lookup_country_from_ip

from django.http import HttpResponse
from django.http import JsonResponse

from django.core.exceptions import PermissionDenied
from django.db import transaction

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

import io
import os
import zipfile
import json as json_module

class CustomLoginView(LoginView):
    template_name = 'base/auth.html'
    authentication_form = EmailLoginForm
    redirect_authenticated_user = True

    def get_success_url(self):
        return reverse_lazy('notes')

    def form_valid(self, form):
        user = form.get_user()

        if user.is_frozen:
            form.add_error(None, "Your account has been suspended. Contact support for details")
            return self.render_to_response(self.get_context_data(
                form=form,
                frozen_email=user.email,
                show_frozen_popup=True,
            ))

        response = super().form_valid(form)

        if user.requires_email_verification:
            self.request.session['show_verify_popup'] = True

        return response

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['active_tab'] = 'login'
        return context

class RegisterPage(FormView):
    template_name = 'base/auth.html'
    form_class = EmailRegisterForm
    redirect_authenticated_user = True
    success_url = reverse_lazy('notes')

    def form_valid(self, form):
        user = form.save()
        user.signup_provider = User.SIGNUP_EMAIL

        ip = get_client_ip(self.request)
        country = lookup_country_from_ip(ip)
        if country:
            user.location = country

        user.save(update_fields=['signup_provider', 'location'])

        _, raw_token = EmailVerificationToken.issue(user)
        send_verification_email(user, raw_token)

        login(self.request, user, backend='django.contrib.auth.backends.ModelBackend')
        return super().form_valid(form)
    
    def get(self, *args, **kwargs):
        if self.request.user.is_authenticated:
            return redirect('notes')
        return super().get(*args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['active_tab'] = 'signup'
        return context

class NoteList(LoginRequiredMixin, ListView):
    model = Note
    context_object_name = 'notes'
    paginate_by = 20

    def get_queryset(self):
        qs = Note.objects.filter(user=self.request.user).prefetch_related('tags')

        tag_filter = self.request.GET.get('tag') or ''
        if tag_filter:
            qs = qs.filter(tags__id=tag_filter)

        return qs.order_by('-updated_at')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['search_input'] = self.request.GET.get('search-area') or ''
        context['tag_filter'] = self.request.GET.get('tag') or ''
        context['user_tags'] = Tag.objects.filter(user=self.request.user)
        context['unverified_banner'] = self.request.user.requires_email_verification
        context['unverified_email'] = self.request.user.email
        return context

class NoteDetail(LoginRequiredMixin, DetailView):
    model = Note
    context_object_name = 'note'
    template_name = 'base/note.html'

    def get_object(self):
        token = get_object_or_404(
            NoteToken.objects.select_related('note'), token=self.kwargs['token']
        )
        note = token.note
        if note.user != self.request.user:
            raise PermissionDenied
        return note

class NoteCreate(LoginRequiredMixin, CreateView):
    model = Note
    form_class = NoteForm
    template_name = 'base/note_create.html'

    def dispatch(self, request, *args, **kwargs):
        user = request.user
        if user.is_authenticated and user.note_limit is not None:
            current_count = Note.objects.filter(user=user).count()
            if current_count >= user.note_limit:
                if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                    return JsonResponse(
                        {'ok': False, 'error': 'Email verification required',
                         'message': 'Verify your email to create more notes'},
                        status=403,
                    )
                self.blocked = True
        return super().dispatch(request, *args, **kwargs)

    def get_success_url(self):
        token = NoteToken.objects.create(
            note=self.object, 
            token=NoteToken.generate_token()
        )
        return reverse('note-update', kwargs={'token': token.token})

    def form_valid(self, form):
        user = self.request.user
        if user.note_limit is not None and Note.objects.filter(user=user).count() >= user.note_limit:
            form.add_error(None, 'Verify your email to create more notes')
            return self.form_invalid(form)

        description = form.cleaned_data.get('description') or ''
        if len(description) > user.note_max_chars:
            form.add_error('description', f'Note too long (max {user.note_max_chars} characters)')
            return self.form_invalid(form)

        form.instance.user = self.request.user
        response = super(NoteCreate, self).form_valid(form)

        tag_names = self.request.POST.getlist('new_tags')
        for name in tag_names:
            name = name.strip()
            if name:
                tag, _ = Tag.objects.get_or_create(
                    user=self.request.user,
                    name=name,
                )
                self.object.tags.add(tag)

        return response
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['note_tags'] = Tag.objects.none()
        context['available_tags'] = Tag.objects.none()
        context['user_tags'] = Tag.objects.filter(user=self.request.user)
        return context


class NoteUpdate(LoginRequiredMixin, UpdateView):
    model = Note
    form_class = NoteForm
    template_name = 'base/note_update.html'

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        new_description = request.POST.get('description', '')
        if len(new_description) > request.user.note_max_chars:
            return JsonResponse(
                {'ok': False, 'error': f'Note too long (max {request.user.note_max_chars} characters)'},
                status=400,
            )
        response = super().post(request, *args, **kwargs)

        note = self.object
        if note is None:
            return response

        # Tags to add: new names and existing tag IDs, both sent on Save
        new_tags = []
        for name in request.POST.getlist('tags_add_name'):
            name = name.strip()
            if name:
                tag, _ = Tag.objects.get_or_create(user=request.user, name=name)
                new_tags.append(tag)

        add_ids = request.POST.getlist('tags_add_id')
        if add_ids:
            new_tags.extend(Tag.objects.filter(pk__in=add_ids, user=request.user))

        if new_tags:
            note.tags.add(*new_tags)

        # Tags to remove: IDs of tags removed in the UI before saving
        remove_ids = request.POST.getlist('tags_remove_id')
        if remove_ids:
            tags_to_remove = Tag.objects.filter(pk__in=remove_ids, user=request.user)
            note.tags.remove(*tags_to_remove)

        return response

    def get_success_url(self):
        return reverse('note-update', kwargs={'token': self.kwargs['token']})

    def get_object(self):
        token = get_object_or_404(
            NoteToken.objects.select_related('note'), token=self.kwargs['token']
        )
        note = token.note
        if note.user != self.request.user:
            raise PermissionDenied
        return note

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        note = self.object
 
        context['note_tags'] = note.tags.filter(user=self.request.user)
 
        context['available_tags'] = (
            Tag.objects.filter(user=self.request.user)
            .exclude(notes=note)
        )
        return context

class NoteDelete(LoginRequiredMixin, DeleteView):
    model = Note
    context_object_name = 'note'
    success_url = reverse_lazy('notes')

    def get_object(self):
        token = get_object_or_404(
            NoteToken.objects.select_related('note'), token=self.kwargs['token']
        )
        note = token.note
        if note.user != self.request.user:
            raise PermissionDenied
        return note

@login_required
def remove_tag_from_note(request, token, tag_pk):
    if request.method == 'POST':
        note_token = get_object_or_404(
            NoteToken.objects.select_related('note'), token=token
        )
        note = note_token.note
        if note.user != request.user:
            raise PermissionDenied
        tag = get_object_or_404(Tag, pk=tag_pk, user=request.user)
        note.tags.remove(tag)
    return redirect('note-update', token=token)

@login_required
def delete_tag(request, tag_pk):
    if request.method == 'POST':
        tag = get_object_or_404(Tag, pk=tag_pk, user=request.user)
        tag.delete()
        return redirect('notes')

@login_required
def rename_tag(request, tag_pk):
    if request.method == 'POST':
        tag = get_object_or_404(Tag, pk=tag_pk, user=request.user)
        new_name = request.POST.get('name', '').strip()

        if not new_name or new_name.lower() == tag.name.lower():
            return JsonResponse({'ok': True, 'name': tag.name})

        existing_tag = Tag.objects.filter(
            name__iexact=new_name,
            user=request.user
        ).exclude(pk=tag.pk).first()

        if existing_tag:
            return JsonResponse({'ok': False, 'error': 'This tag already exists'})

        tag.name = new_name
        tag.save()
        return JsonResponse({'ok': True, 'name': new_name})

    return JsonResponse({'ok': False, 'error': 'Invalid method'}, status=405)
    
def lockout_response(request, credentials, *args, **kwargs):
    return HttpResponse(
        "Too many failed login attempts. Please try again later",
        status=403
    )

@login_required
def export_notes(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        body = json_module.loads(request.body)
        pks = body.get('ids', [])
    except (ValueError, KeyError):
        return JsonResponse({'error': 'Invalid request'}, status=400)
    
    if not isinstance(pks, list) or not pks:
        return JsonResponse({'error': 'No notes selected'}, status=400)
    
    notes = Note.objects.filter(pk__in=pks, user=request.user)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        seen_names = {}
        for note in notes:
            md_content = f"{note.description or ''}"

            safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in note.title).strip() or f"note_{note.pk}"
            safe_name = safe_name[:60]
            count = seen_names.get(safe_name, 0)
            seen_names[safe_name] = count + 1
            filename = f"{safe_name}.md" if count == 0 else f"{safe_name}_{count}.md"

            zf.writestr(filename, md_content.encode('utf-8'))

    buffer.seek(0)
    response = HttpResponse(buffer.read(), content_type='application/zip')
    response['Content-Disposition'] = 'attachment; filename="notes.zip"'
    response['Cache-Control'] = 'no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response

@login_required
def import_notes(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    MAX_FILES = 50
    files = request.FILES.getlist('files')
    if not files:
        return JsonResponse({'error': 'No files provided'}, status=400)
    if len(files) > MAX_FILES:
        return JsonResponse({'error': f'Too many files. Maximum {MAX_FILES} per one load'}, status=400)

    user = request.user
    limit = user.note_limit
    if limit is not None:
        existing_count = Note.objects.filter(user=user).count()
        remaining = max(0, limit - existing_count)
        if remaining == 0:
            return JsonResponse(
                {'ok': False, 'error': 'Email verification required',
                 'message': 'Verify your email to create more notes'},
                status=403,
            )
        files = files[:remaining]

    ALLOWED_EXTENTIONS = {'.md', '.txt'}
    MAX_FILE_SIZE = 5 * 1024 * 1024
    MAX_TITLE_LENGTH = 199
    max_chars = user.note_max_chars

    notes_to_create = []
    skipped = []

    for f in files:
        name = f.name or ''
        ext = os.path.splitext(name)[1].lower()
        if ext not in ALLOWED_EXTENTIONS:
            skipped.append({'file': name, 'reason': 'Unsupported file type'})
            continue
        if f.size > MAX_FILE_SIZE:
            skipped.append({'file': name, 'reason': 'File exceeds 5 MB'})
            continue
        try:
            content = f.read().decode('utf-8')
        except (UnicodeDecodeError, ValueError):
            skipped.append({'file': name, 'reason': 'Could not read as UTF-8 text'})
            continue

        if len(content) > max_chars:
            skipped.append({'file': name, 'reason': f'Exceeds {max_chars} character limit'})
            continue

        raw_title = os.path.splitext(name)[0]
        title = raw_title[:MAX_TITLE_LENGTH].strip() or 'Untitled'

        notes_to_create.append(Note(user=user, title=title, description=content))

    with transaction.atomic():
        created_notes = Note.objects.bulk_create(notes_to_create)
        NoteToken.objects.bulk_create([
            NoteToken(note=note, token=NoteToken.generate_token())
            for note in created_notes
        ])

    return JsonResponse({
        'ok': True,
        'created': len(created_notes),
        'skipped': skipped,
    })

@login_required
def change_password(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    if request.user.requires_email_verification:
        return JsonResponse(
            {'ok': False, 'error': 'Email verification required',
             'message': 'Verify your email to change your password'},
            status=403,
        )

    try:
        body = json_module.loads(request.body)
        current_password = body.get('current_password', '')
        new_password = body.get('new_password', '')
    except (ValueError, KeyError):
        return JsonResponse({'error': 'Invalid request'}, status=400)

    if not current_password or not new_password:
        return JsonResponse({'ok': False, 'error': 'All fields are required'}, status=400)

    if not request.user.check_password(current_password):
        return JsonResponse({'ok': False, 'error': 'Current password is incorrect'})

    try:
        validate_password(new_password, user=request.user)
    except DjangoValidationError as e:
        return JsonResponse({'ok': False, 'error': ' '.join(e.messages)})

    if request.user.check_password(new_password):
        return JsonResponse({'ok': False, 'error': 'New password must be different'})

    request.user.set_password(new_password)
    request.user.save()

    update_session_auth_hash(request, request.user)

    return JsonResponse({'ok': True})

def verify_email_confirm(request, token):
    if request.method == 'POST':
        user = EmailVerificationToken.consume(token)

        if user is None:
            target = 'notes' if request.user.is_authenticated else 'login'
            return redirect(f"{reverse(target)}?verify_error=1")

        user.is_email_verified = True
        user.email_verified_at = timezone.now()
        user.save(update_fields=['is_email_verified', 'email_verified_at'])
        
        target = 'notes' if request.user.is_authenticated else 'login'
        return redirect(f"{reverse(target)}?verified=1")

    return render(request, 'base/verify_confirm.html', {'token': token})

def email_from_json_body(group, request):
    try:
        body = json_module.loads(request.body)
        return (body.get('email') or '').strip().lower()
    except (ValueError, KeyError):
        return ''

@ratelimit(key=email_from_json_body, rate='5/h', method='POST', block=True)
@ratelimit(key='ip', rate='20/h', method='POST', block=True)
@require_http_methods(['POST'])
def resend_verification(request):
    try:
        body = json_module.loads(request.body)
        email = (body.get('email') or '').strip().lower()
    except (ValueError, KeyError):
        return JsonResponse({'error': 'Invalid request'}, status=400)

    if not email:
        return JsonResponse({'error': 'Email required'}, status=400)

    generic = {'message': 'New verification link has been sent'}

    user = User.objects.filter(email__iexact=email).first()
    if user and user.requires_email_verification:
        _, raw_token = EmailVerificationToken.issue(user)
        send_verification_email(user, raw_token)

    return JsonResponse(generic)