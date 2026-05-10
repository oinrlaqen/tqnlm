import secrets
from django.db import migrations, models
import django.db.models.deletion


def generate_token():
    return secrets.token_urlsafe(10)


def backfill_tokens(apps, schema_editor):
    """Create a token for every existing Note that doesn't have one yet."""
    Note = apps.get_model('base', 'Note')         # replace 'base' with your app name if different
    NoteToken = apps.get_model('base', 'NoteToken')

    existing_note_ids = set(
        NoteToken.objects.values_list('note_id', flat=True)
    )

    tokens_to_create = []
    for note in Note.objects.exclude(id__in=existing_note_ids):
        token_str = generate_token()
        # Ensure uniqueness in the batch being built
        while token_str in {t.token for t in tokens_to_create}:
            token_str = generate_token()
        tokens_to_create.append(NoteToken(note=note, token=token_str))

    NoteToken.objects.bulk_create(tokens_to_create)


def reverse_backfill(apps, schema_editor):
    """Remove all tokens (used when reversing this migration)."""
    NoteToken = apps.get_model('base', 'NoteToken')
    NoteToken.objects.all().delete()


class Migration(migrations.Migration):

    # ------------------------------------------------------------------ #
    # Replace 'base' with your actual app name                            #
    # Replace '0001_initial' with the name of your last migration file    #
    # ------------------------------------------------------------------ #
    dependencies = [
        ('base', '0002_alter_tag_name'),
    ]

    operations = [
        # Step 1: create the NoteToken table
        migrations.CreateModel(
            name='NoteToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(db_index=True, max_length=20, unique=True)),
                ('note', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='tokens',
                    to='base.note',                  # replace 'base' with your app name
                )),
            ],
        ),

        # Step 2: backfill tokens for all existing notes
        migrations.RunPython(backfill_tokens, reverse_code=reverse_backfill),
    ]
