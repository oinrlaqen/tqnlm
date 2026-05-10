from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic.list import ListView
from django.views.generic.detail import DetailView
from django.views.generic.edit import CreateView, UpdateView, DeleteView, FormView
from django.urls import reverse_lazy, reverse

from django.contrib.auth.views import LoginView
from django.contrib.auth.views import LogoutView

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required

from .models import Note, Tag
from .forms import EmailLoginForm, EmailRegisterForm, NoteForm

from django.http import HttpResponse
from django.http import JsonResponse

class CustomLoginView(LoginView):
    template_name = 'base/login.html'
    authentication_form = EmailLoginForm
    redirect_authenticated_user = True

    def get_success_url(self):
        return reverse_lazy('notes')
    
class RegisterPage(FormView):
    template_name = 'base/register.html'
    form_class = EmailRegisterForm
    redirect_authenticated_user = True
    success_url = reverse_lazy('notes')

    def form_valid(self, form):
        user = form.save()
        login(self.request, user, backend='django.contrib.auth.backends.ModelBackend')
        return super().form_valid(form)
    
    def get(self, *args, **kwargs):
        if self.request.user.is_authenticated:
            return redirect('notes')
        return super().get(*args, **kwargs)

class NoteList(LoginRequiredMixin, ListView):
    model = Note
    context_object_name = 'notes'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['notes'] = context['notes'].filter(user=self.request.user)
        
        tag_filter = self.request.GET.get('tag') or ''
        if tag_filter:
            context['notes'] = context['notes'].filter(tags__id=tag_filter)
        
        context['notes'] = context['notes'].order_by('-updated_at')
        context['search_input'] = self.request.GET.get('search-area') or ''
        context['tag_filter'] = tag_filter
        context['user_tags'] = Tag.objects.filter(user=self.request.user)
        return context

class NoteDetail(LoginRequiredMixin, DetailView):
    model = Note
    context_object_name = 'note'
    template_name = 'base/note.html'

    def get_queryset(self):
        return Note.objects.filter(user=self.request.user)

class NoteCreate(LoginRequiredMixin, CreateView):
    model = Note
    form_class = NoteForm
    template_name = 'base/note_create.html'

    def get_success_url(self):
        return reverse('note-update', kwargs={'pk': self.object.pk})

    def form_valid(self, form):
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

    def get_success_url(self):
        return reverse('note-update', kwargs={'pk': self.object.pk})
    
    def get_queryset(self):
        return Note.objects.filter(user=self.request.user)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        note = self.object
 
        context['note_tags'] = note.tags.filter(user=self.request.user)
 
        context['available_tags'] = (
            Tag.objects.filter(user=self.request.user)
            .exclude(notes=note)
        )
        return context
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        note = self.object
        if note is None:
            return response

        # Tags to add: new names and existing tag IDs, both sent on Save
        for name in request.POST.getlist('tags_add_name'):
            name = name.strip()
            if name:
                tag, _ = Tag.objects.get_or_create(user=request.user, name=name)
                note.tags.add(tag)

        for tag_id in request.POST.getlist('tags_add_id'):
            tag = Tag.objects.filter(pk=tag_id, user=request.user).first()
            if tag:
                note.tags.add(tag)

        # Tags to remove: IDs of tags removed in the UI before saving
        for tag_id in request.POST.getlist('tags_remove_id'):
            tag = Tag.objects.filter(pk=tag_id, user=request.user).first()
            if tag:
                note.tags.remove(tag)

        return response

class NoteDelete(LoginRequiredMixin, DeleteView):
    model = Note
    context_object_name = 'note'
    success_url = reverse_lazy('notes')

    def get_queryset(self):
        return Note.objects.filter(user=self.request.user)

@login_required
def remove_tag_from_note(request, note_pk, tag_pk):
    if request.method == 'POST':
        note = get_object_or_404(Note, pk=note_pk, user=request.user)
        tag = get_object_or_404(Tag, pk=tag_pk, user=request.user)
        note.tags.remove(tag)
    return redirect('note-update', pk=note_pk)

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