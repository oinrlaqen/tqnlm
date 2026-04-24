import markdown as md

from django import template
from django.template.defaultfilters import stringfilter
from django.utils.safestring import mark_safe

import bleach

register = template.Library()

@register.filter
@stringfilter
def convert_markdown(value):
    extensions = [
        'markdown.extensions.fenced_code', # code blocks
        'markdown.extensions.codehilite', # syntax highlighting
        'markdown.extensions.tables', # tables
        'markdown.extensions.toc', # table of contents
        'markdown.extensions.nl2br', # newlines to <br>
        'markdown.extensions.extra',
        'markdown.extensions.sane_lists',
        'markdown.extensions.smarty',
        ]
    extension_configs = {
        'codehilite': {
            'guess_lang': False,
            'linenums': False
        },
        'toc': {
            'permalink': True
        }
    }
    result = md.markdown(value, extensions=extensions, extension_configs=extension_configs)
    return mark_safe(result)