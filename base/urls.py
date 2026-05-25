from django.urls import path
from .views import ( 
    RegisterPage, NoteList, NoteDetail, NoteCreate, NoteUpdate, 
    NoteDelete, CustomLoginView, LogoutView, remove_tag_from_note,
    delete_tag, rename_tag, export_notes, import_notes, change_password
)

urlpatterns = [
    path('login/', CustomLoginView.as_view(), name='login'),
    path('register/', RegisterPage.as_view(), name='register'),
    path('logout/', LogoutView.as_view(next_page='/'), name='logout'),
    path('', NoteList.as_view(), name='notes'),
    path('view/<str:token>/', NoteDetail.as_view(), name='note'),
    path('new/', NoteCreate.as_view(), name='note-create'),
    path('edit/<str:token>/', NoteUpdate.as_view(), name='note-update'),
    path('delete/<str:token>/', NoteDelete.as_view(), name='note-delete'),
    path('note/<str:token>/remove-tag/<int:tag_pk>/', remove_tag_from_note, name='remove-tag'),
    path('tags/<int:tag_pk>/delete/', delete_tag, name='delete_tag'),
    path('tags/<int:tag_pk>/rename/', rename_tag, name='rename_tag'),
    path('export/', export_notes, name='export_notes'),
    path('import/', import_notes, name='import_notes'),
    path('change-password/', change_password, name='change_password'),
]