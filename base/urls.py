from django.urls import path
from .views import ( 
    RegisterPage, NoteList, NoteDetail, NoteCreate, NoteUpdate, 
    NoteDelete, CustomLoginView, LogoutView, remove_tag_from_note,
    delete_tag, rename_tag
)

urlpatterns = [
    path('login/', CustomLoginView.as_view(), name='login'),
    path('register/', RegisterPage.as_view(), name='register'),
    path('logout/', LogoutView.as_view(next_page='/'), name='logout'),
    path('', NoteList.as_view(), name='notes'),
    path('note/<int:pk>/', NoteDetail.as_view(), name='note'),
    path('note-create/', NoteCreate.as_view(), name='note-create'),
    path('note-update/<int:pk>/', NoteUpdate.as_view(), name='note-update'),
    path('note-delete/<int:pk>/', NoteDelete.as_view(), name='note-delete'),
    path('note/<int:note_pk>/remove-tag/<int:tag_pk>/', remove_tag_from_note, name='remove-tag'),
    path('tags/<int:tag_pk>/delete/', delete_tag, name='delete_tag'),
    path('tags/<int:tag_pk>/rename/', rename_tag, name='rename_tag'),
]