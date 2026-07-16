/* ── Preview toggle ───────────────────────────────────────── */

let isPreview = false;

function togglePreview() {
    isPreview = !isPreview;
    const editArea    = document.getElementById('edit-area');
    const previewArea = document.getElementById('preview-area');
    const tagToolbar  = document.getElementById('tag-toolbar');
    const tagsWrap    = document.getElementById('tags-wrap');
    const btn         = document.getElementById('preview-toggle-btn');

    if (isPreview) {
        const ta = editArea.querySelector('textarea');
        const md = ta ? ta.value : '';
        const previewContent = document.getElementById('preview-content');
        previewContent.innerHTML = marked.parse(md || '*Nothing to preview yet*');
        previewContent.querySelectorAll('pre code').forEach(function (block) {
            hljs.highlightElement(block);
        });
        editArea.classList.add('hidden-edit');
        previewArea.classList.add('active');
        tagToolbar.style.display = 'none';
        document.getElementById('all-notes-btn').style.display = 'none';
        if (tagsWrap) tagsWrap.style.display = 'none';
        btn.classList.add('preview-active');
        btn.innerHTML = 'Edit';
    } else {
        editArea.classList.remove('hidden-edit');
        previewArea.classList.remove('active');
        tagToolbar.style.display = '';
        document.getElementById('all-notes-btn').style.display = '';
        if (tagsWrap) tagsWrap.style.display = '';
        btn.classList.remove('preview-active');
        btn.innerHTML = 'Preview';
    }
}

/* ── Save button state ───────────────────────────────────── */

const saveBtn = document.getElementById('save-note-btn');

function setSaveBtnSaved() {
    saveBtn.innerHTML = 'Saved';
    saveBtn.classList.remove('toolbar-btn-unsaved');
    saveBtn.classList.add('toolbar-btn-accent');
}
function setSaveBtnUnsaved() {
    saveBtn.innerHTML = 'Save';
    saveBtn.classList.remove('toolbar-btn-accent');
    saveBtn.classList.add('toolbar-btn-unsaved');
}

/* ── Warn before leaving via "All Notes" if there are unsaved changes ── */

function handleAllNotesClick(e) {
    e.preventDefault();
    const hasUnsavedChanges = saveBtn.classList.contains('toolbar-btn-unsaved');
    if (hasUnsavedChanges) {
        document.getElementById('unsaved-popup-overlay').classList.add('visible');
    } else {
        window.location.href = document.getElementById('all-notes-btn').href;
    }
}

function hideUnsavedModal() {
    document.getElementById('unsaved-popup-overlay').classList.remove('visible');
}

function confirmLeaveNotes() {
    window.location.href = document.getElementById('all-notes-btn').href;
}

// Default state
setSaveBtnSaved();

// Store original values
const originalTitle = document.getElementById('id_title').value;
const originalBody = document.querySelector('.note-body-area textarea').value;

function checkIfChanged() {
    const titleChanged = document.getElementById('id_title').value !== originalTitle;
    const bodyChanged  = document.querySelector('.note-body-area textarea').value !== originalBody;
    const tagsChanged = tagsAddName.length > 0 || tagsAddId.length > 0 || tagsRemoveId.length > 0;
    if (titleChanged || bodyChanged || tagsChanged) {
        setSaveBtnUnsaved();
    } else {
        setSaveBtnSaved();
    }
}

document.getElementById('id_title').addEventListener('input', checkIfChanged);
document.querySelectorAll('.note-body-area textarea').forEach(function(ta) {
    ta.addEventListener('input', checkIfChanged);
});

// On submit, switch back to Saved
document.getElementById('main-note-form').addEventListener('submit', setSaveBtnSaved);

/* ── Tag color system (mirrors note_list) ─────────────────── */

const PILL_COLORS = [
    'pill-purple','pill-teal','pill-coral','pill-blue','pill-amber',
    'pill-pink','pill-green','pill-indigo','pill-rose','pill-cyan',
    'pill-lime','pill-emerald','pill-violet','pill-fuchsia','pill-sky',
    'pill-orange','pill-red','pill-yellow','pill-slate','pill-gray',
    'pill-zinc','pill-neutral','pill-stone','pill-brown','pill-gold'
];
const _tagColorCache = {};
function pillClassById(tagId) {
    const key = String(tagId);
    if (!_tagColorCache[key]) {
        const hash = parseInt(key, 25) || 0;
        _tagColorCache[key] = PILL_COLORS[hash % PILL_COLORS.length];
    }
    return _tagColorCache[key];
}

/* ── Pending tag state ────────────────────────────────────── */

const tagsAddName   = [];
const tagsAddId     = [];
const tagsRemoveId  = [];
const pendingNewNames = new Set();
const currentTagIds = new Set(
    [...document.querySelectorAll('#tags-scroll .pill[data-tag-id]')]
        .map(el => el.dataset.tagId)
);

/* ── Apply pill colors to select panel on load ────────────── */

document.querySelectorAll('#selectTagPanel .select-tag-item').forEach(function (item) {
    const tagId = item.dataset.tagId;
    if (tagId) item.innerHTML = '<span class="pill ' + pillClassById(tagId) + '">' + item.textContent + '</span>';
});

/* ── Apply pill colors to carousel tags on load ────────────── */

document.querySelectorAll('#tags-scroll .pill[data-tag-id]').forEach(function (pill) {
    const tagId = pill.dataset.tagId;
    if (tagId) pill.classList.add(pillClassById(tagId));
});

/* ── Render a new pill in the carousel ───────────────────────
    tagId may be null for brand-new names not yet in the DB.    */

    function renderPill(tagId, tagName) {
    const wrap = document.getElementById('tags-wrap');
    let scroll = document.getElementById('tags-scroll');

    if (!wrap) {
        const newWrap = document.createElement('div');
        newWrap.className = 'current-tags-wrap';
        newWrap.id = 'tags-wrap';
        newWrap.innerHTML =
            '<button type="button" class="carousel-arrow carousel-arrow-left" id="tags-arrow-left" onclick="carouselScroll(\'tags-scroll\',-1)" aria-label="Scroll left">' +
                '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 1.5L3 5l3.5 3.5"/></svg>' +
            '</button>' +
            '<div class="current-tags" id="tags-scroll"></div>' +
            '<button type="button" class="carousel-arrow carousel-arrow-right" id="tags-arrow-right" onclick="carouselScroll(\'tags-scroll\',1)" aria-label="Scroll right">' +
                '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 1.5L7 5l-3.5 3.5"/></svg>' +
            '</button>';
        const bodyArea = document.querySelector('.note-body-area');
        bodyArea.parentNode.insertBefore(newWrap, bodyArea);
        scroll = newWrap.querySelector('#tags-scroll');
        initCarousel('tags-wrap', 'tags-scroll', 'tags-arrow-left', 'tags-arrow-right');
    }

    const colorClass = tagId ? pillClassById(tagId) : PILL_COLORS[Math.abs(tagName.split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % PILL_COLORS.length];
    const pill = document.createElement('span');
    pill.className = 'pill ' + colorClass;
    if (tagId) {
        pill.dataset.tagId  = tagId;
        pill.dataset.serverId = tagId;
    } else {
        pill.dataset.tagName = tagName;
    }
    pill.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:3px 8px 3px 10px;flex-shrink:0;';
    pill.innerHTML = tagName +
        '<button type="button" onclick="uiRemoveTag(\'' + (tagId||'') + '\',\'' + tagName.replace(/'/g,"\\'") + '\',this)"' +
        ' style="background:none;border:none;cursor:pointer;padding:0;line-height:1;opacity:.6;display:flex;align-items:center;" title="Remove tag">' +
        '<svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
        '<path d="M2 2l6 6M8 2l-6 6"/></svg></button>';
    scroll.appendChild(pill);
    requestAnimationFrame(() => {
        const upd = initCarousel('tags-wrap', 'tags-scroll', 'tags-arrow-left', 'tags-arrow-right');
        if (upd) upd();
        scroll.scrollLeft = scroll.scrollWidth;
    });
}

/* ── Hide a select-panel item by tagId ───────────────────── */

function hideSelectItem(tagId) {
    const item = document.querySelector('#selectTagPanel [data-tag-id="' + tagId + '"]');
    if (item) item.classList.add('hidden');

    const anyVisible = document.querySelectorAll('#selectTagPanel .select-tag-item:not(.hidden)').length > 0;
    const msg = document.getElementById('no-tags-msg')
    if (msg) msg.style.display = anyVisible ? 'none' : 'block';
}
function showSelectItem(tagId) {
    const item = document.querySelector('#selectTagPanel [data-tag-id="' + tagId + '"]');
    if (item) item.classList.remove('hidden');

    const msg = document.getElementById('no-tags-msg');
    if (msg) msg.style.display = 'none';
}

/* ── Add a brand-new tag name (client-side only) ─────────── */

function uiAddNewTag() {
    const input = document.getElementById('new-tag-name');
    const name  = input.value.trim();
    if (!name) return;

    const nameLower = name.toLowerCase();
    if (pendingNewNames.has(nameLower)) { input.value = ''; return; }

    const existingItem = [...document.querySelectorAll('#selectTagPanel [data-tag-id]')]
        .find(el => el.dataset.tagName && el.dataset.tagName.toLowerCase() === nameLower);

    if (existingItem) {
        const tagId = existingItem.dataset.tagId;
        if (currentTagIds.has(tagId)) { input.value = ''; return; }
        uiAssignExistingTag(tagId, existingItem.dataset.tagName);
    } else {
        pendingNewNames.add(nameLower);
        tagsAddName.push(name);
        renderPill(null, name);
    }
    input.value = '';
    checkIfChanged();
}

/* ── Assign an existing tag from the dropdown ────────────── */

function uiAssignExistingTag(tagId, tagName) {
    document.getElementById('selectTagPanel').classList.remove('open');
    if (currentTagIds.has(String(tagId))) return;

    const removeIdx = tagsRemoveId.indexOf(String(tagId));
    if (removeIdx !== -1) {
        tagsRemoveId.splice(removeIdx, 1);
    } else {
        tagsAddId.push(tagId);
    }
    currentTagIds.add(String(tagId));
    hideSelectItem(tagId);
    renderPill(tagId, tagName);
    checkIfChanged();
}

/* ── Remove a tag pill (client-side only) ────────────────── */

function uiRemoveTag(tagId, tagName, btn) {
    const pill = btn.closest('.pill');

    if (tagId) {
        const addIdx = tagsAddId.indexOf(String(tagId));
        if (addIdx !== -1) {
            tagsAddId.splice(addIdx, 1);
        } else {
            tagsRemoveId.push(String(tagId));
        }
        currentTagIds.delete(String(tagId));
        showSelectItem(tagId);
    } else {
        const nameLower = tagName.toLowerCase();
        pendingNewNames.delete(nameLower);
        const nameIdx = tagsAddName.findIndex(n => n.toLowerCase() === nameLower);
        if (nameIdx !== -1) tagsAddName.splice(nameIdx, 1);
    }

    pill.remove();
    checkIfChanged();
    requestAnimationFrame(() => {
        const upd = initCarousel('tags-wrap', 'tags-scroll', 'tags-arrow-left', 'tags-arrow-right');
        if (upd) upd();
    });
}

/* ── Inject hidden inputs before form submit ─────────────── */

document.getElementById('main-note-form').addEventListener('submit', function () {
    const form = this;
    tagsAddName.forEach(name => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'tags_add_name'; inp.value = name;
        form.appendChild(inp);
    });
    tagsAddId.forEach(id => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'tags_add_id'; inp.value = id;
        form.appendChild(inp);
    });
    tagsRemoveId.forEach(id => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'tags_remove_id'; inp.value = id;
        form.appendChild(inp);
    });
});

/* ── Select panel toggle / close on outside click ─────────── */

function toggleSelectPanel(e) {
    e.stopPropagation();
    document.getElementById('selectTagPanel').classList.toggle('open');
}
document.addEventListener('click', function () {
    const p = document.getElementById('selectTagPanel');
    if (p) p.classList.remove('open');
});

/* ── Allow Enter key to add a tag ────────────────────────── */

document.getElementById('new-tag-name').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); uiAddNewTag(); }
});

/* ── Carousel scroll helper ───────────────────────────────── */

function carouselScroll(scrollId, dir) {
    const el = document.getElementById(scrollId);
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
}

/* ── Generic carousel arrow + fade + centering updater ───── */

function initCarousel(wrapId, scrollId, arrowLeftId, arrowRightId) {
    const wrap   = document.getElementById(wrapId);
    const scroll = document.getElementById(scrollId);
    const arrowL = document.getElementById(arrowLeftId);
    const arrowR = document.getElementById(arrowRightId);
    if (!wrap || !scroll) return;

    function update() {
        const overflowing = scroll.scrollWidth > scroll.clientWidth + 2;
        const atStart = scroll.scrollLeft <= 2;
        const atEnd   = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 2;

        const showLeft  = overflowing && !atStart;
        const showRight = overflowing && !atEnd;

        if (arrowL) arrowL.classList.toggle('visible', showLeft);
        if (arrowR) arrowR.classList.toggle('visible', showRight);

        wrap.classList.toggle('has-left',  showLeft);
        wrap.classList.toggle('has-right', showRight);
        wrap.classList.toggle('fade-left',  showLeft);
        wrap.classList.toggle('fade-right', showRight);
        scroll.classList.toggle('overflowing', overflowing);
    }

    scroll.addEventListener('scroll', update, { passive: true });
    requestAnimationFrame(update);
    return update;
}

/* ── Tag carousel (existing note) ────────────────────────── */

(function () {
    initCarousel('tags-wrap', 'tags-scroll', 'tags-arrow-left', 'tags-arrow-right');
})();

/* Auto-grow textarea */

document.querySelectorAll('.note-body-area textarea').forEach(function (ta) {
    function grow() { 
        const scrollY = window.scrollY;
        ta.style.height = 'auto'; 
        ta.style.height = ta.scrollHeight + 'px';
        window.scrollTo({ top: scrollY, behavior: 'instant' })
        }
    ta.addEventListener('input', grow);
    grow();
});

/* Show "No tags here" on load if no available tags */

(function () {
    const anyVisible = document.querySelectorAll('#selectTagPanel .select-tag-item:not(.hidden)').length > 0;
    const msg = document.getElementById('no-tags-msg');
    if (msg) msg.style.display = anyVisible ? 'none' : 'block';
})();

/* ── Highlight mode ───────────────────────────────────────── */

let isHighlight = true;

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatInline(esc) {
    return esc
        .replace(/!\[([^\]\n]*)\]\(([^)\n]*)\)/g, '<span class="hl-image">$&</span>')
        .replace(/(?<!!)\[([^\]\n]*)\]\(([^)\n]*)\)/g, '<span class="hl-link-text">[$1]</span><span class="hl-link-url">($2)</span>')
        .replace(/`([^`\n]+)`/g, '<span class="hl-code">$&</span>')
        .replace(/~~([^~\n]+?)~~/g, '<span class="hl-strike">$&</span>')
        .replace(/&lt;ins&gt;([^<\n]+?)&lt;\/ins&gt;/g, '<span class="hl-underline">$&</span>')
        .replace(/&lt;sub&gt;([^<\n]+?)&lt;\/sub&gt;/g, '<span class="hl-subscript">$&</span>')
        .replace(/&lt;sup&gt;([^<\n]+?)&lt;\/sup&gt;/g, '<span class="hl-superscript">$&</span>')
        .replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<span class="hl-bold-italic">$&</span>')
        .replace(/(?<!\*)\*\*(?!\*)([^*\n]+?)(?<!\*)\*\*(?!\*)/g, '<span class="hl-bold">$&</span>')
        .replace(/(^|(?<=\s))__([^_\n]+?)__((?=\s)|$)/g, '$1<span class="hl-bold">__$2__</span>$3')
        .replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, '<span class="hl-italic">$&</span>')
        .replace(/(^|(?<=\s))_([^_\n]+?)_((?=\s)|$)/g, '$1<span class="hl-italic">_$2_</span>$3')
        .replace(/ {2,}/g, '<span class="hl-space">$&</span>');
}

function renderHighlight() {
    const ta = document.querySelector('.note-body-area textarea');
    const overlay = document.getElementById('highlight-overlay');
    if (!ta || !overlay) return;

    const lines = ta.value.split('\n');
    let inCodeBlock = false;
    const html = lines.map(line => {
        const esc = escapeHtml(line);

        if (/^```/.test(line)) {
            inCodeBlock = !inCodeBlock;
            return `<span class="hl-codeblock">${esc}</span>`;
        }
        if (inCodeBlock)
            return `<span class="hl-codeblock">${esc}</span>`;

        if (/^#{1,6}\s/.test(line))
            return `<span class="hl-heading">${esc}</span>`;

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim()))
            return `<span class="hl-hr">${esc}</span>`;

        if (/^>+\s?/.test(line)) {
            const quoteMatch = esc.match(/^((?:&gt;)+)\s?(.*)/);
            if (quoteMatch)
                return `<span class="hl-quote">${quoteMatch[1]}</span><span class="hl-plain"> ${formatInline(quoteMatch[2])}</span>`;
        }

        const listMatch = esc.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.*)$/);
        if (listMatch) {
            return `<span class="hl-list-marker">${listMatch[1]}</span><span class="hl-plain">${formatInline(listMatch[2])}</span>`;
        }

        return '<span class="hl-plain">' + formatInline(esc) + '</span>';
    }).join('\n');

    overlay.innerHTML = html;
}

document.getElementById('edit-area').classList.add('highlight-mode');
renderHighlight();

// Re-render on every keystroke when highlight is active
document.querySelectorAll('.note-body-area textarea').forEach(ta => {
    ta.addEventListener('input', () => { if (isHighlight) renderHighlight(); });
});

/* ── Format popup ─────────────────────────────────────────── */

(function () {
    const popup = document.getElementById('format-popup');
    const ta    = document.querySelector('.note-body-area textarea');
    if (!popup || !ta) return;

    // Markdown wrappers for each format action
    const FORMATS = {
        bold:          { wrap: ['**', '**'] },
        italic:        { wrap: ['*', '*'] },
        code:          { wrap: ['`', '`'] },
        strikethrough: { wrap: ['~~', '~~'] },
        underline:     { wrap: ['<ins>', '</ins>'] },
    };

    // Show popup above the given (x, y) coordinate
    function showPopup(x, y) {
        popup.classList.add('visible');
        const pw = popup.offsetWidth || 320;
        let left = x - pw / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
        popup.style.left = left + 'px';
        popup.style.top  = (y - popup.offsetHeight - 8) + 'px';
    }

    let activeStyledRuns = new Map();

    function hidePopup() {
        popup.classList.remove('visible');
        activeStyledRuns = new Map();
        popup.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
    }

    function buildTextStyleMap(text) {
        const map = new Array(text.length).fill(null);
        const patterns = [
            { fmt: 'bold',          re: /\*\*([^*]+?)\*\*|__([^_]+?)__/g,                                                                    open: 2, close: 2 },
            { fmt: 'italic',        re: /(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)|(^|(?<=\s))(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)((?=\s)|$)/g, open: 1, close: 1 },
            { fmt: 'strikethrough', re: /~~(.+?)~~/g,                                                                                        open: 2, close: 2 },
            { fmt: 'code',          re: /`([^`]+?)`/g,                                                                                       open: 1, close: 1 },
            { fmt: 'underline',     re: /<ins>([\s\S]+?)<\/ins>/g,                                                                           open: 5, close: 6 },
        ];
        for (const { fmt, re } of patterns) {
            let m;
            re.lastIndex = 0;
            while ((m = re.exec(text)) !== null) {
                const spanStart = m.index;
                const spanEnd   = m.index + m[0].length;
                for (let i = spanStart; i < spanEnd; i++) {
                    if (!map[i]) map[i] = { fmt, spanStart, spanEnd };
                }
            }
        }
        return map;
    }

    // Listen for mouseup on the textarea to detect a selection
    ta.addEventListener('mouseup', function (e) {
        setTimeout(() => {
            const start = ta.selectionStart;
            const end   = ta.selectionEnd;
            if (start === end) { hidePopup(); return; }

            // Build style map and find all runs touched by the selection
            const map = buildTextStyleMap(ta.value);
            activeStyledRuns = new Map();
            for (let i = start; i < end; i++) {
                const entry = map[i];
                if (entry && !activeStyledRuns.has(entry.fmt)) {
                    activeStyledRuns.set(entry.fmt, { spanStart: entry.spanStart, spanEnd: entry.spanEnd });
                }
            }

            // Fire (highlight) buttons whose format is active in the selection
            popup.querySelectorAll('.fmt-btn').forEach(b => {
                b.classList.toggle('active', activeStyledRuns.has(b.dataset.fmt));
            });

            showPopup(e.clientX, e.clientY);
        }, 10);
    });

    // Also hide popup when clicking elsewhere
    document.addEventListener('mousedown', function (e) {
        if (!popup.contains(e.target) && e.target !== ta) {
            hidePopup();
        }
    });

    // Hide popup when user scrolls
    window.addEventListener('scroll', hidePopup, { passive: true });
    ta.addEventListener('scroll', hidePopup, { passive: true });

    // Handle format button clicks
    popup.addEventListener('mousedown', function (e) {
        e.preventDefault(); // don't lose textarea selection
    });

    // Hide popup when user starts typing
    ta.addEventListener('keydown', function (e) {
        if (!e.shiftKey) hidePopup();
    });

    popup.addEventListener('click', function (e) {
        const btn = e.target.closest('.fmt-btn');
        if (!btn) return;

        const fmt    = btn.dataset.fmt;
        const config = FORMATS[fmt];
        if (!config && fmt !== 'plain') return;

        const start = ta.selectionStart;
        const end   = ta.selectionEnd;
        const text  = ta.value;
        const sel   = text.slice(start, end);

        let newText, newStart, newEnd;

        if (fmt === 'plain') {
        const stripped = sel
                .replace(/__([\s\S]+?)__/g, '$1')
                .replace(/\*\*([^*]+?)\*\*/g, '$1')
                .replace(/(?<!_)_(?!_)([^_]+?)(?<!_)_(?!_)/g, '$1')
                .replace(/\*([^*]+?)\*/g, '$1')
                .replace(/~~(.+?)~~/g, '$1')
                .replace(/`([^`]+?)`/g, '$1')
                .replace(/<ins>([\s\S]+?)<\/ins>/g, '$1')
                .replace(/<sub>([\s\S]+?)<\/sub>/g, '$1')
                .replace(/<sup>([\s\S]+?)<\/sup>/g, '$1')
                .replace(/#{1,6}\s?/g, '')
                .replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, '$1 $2')
                .replace(/^>\s?/gm, '')
                .replace(/^(\s*)(\d+\.|-|\*|\+)\s+/gm, '$1')
                .replace(/ {2,}/g, ' ');
            newText  = text.slice(0, start) + stripped + text.slice(end);
            newStart = start;
            newEnd   = start + stripped.length;
            } else if (config.wrap) {
                const [open, close] = config.wrap;
                if (activeStyledRuns.has(fmt)) {
                    // Unwrap: remove the entire styled run's markers
                    const run   = activeStyledRuns.get(fmt);
                    const inner = text.slice(run.spanStart + open.length, run.spanEnd - close.length);
                    newText  = text.slice(0, run.spanStart) + inner + text.slice(run.spanEnd);
                    newStart = run.spanStart;
                    newEnd   = run.spanStart + inner.length;
                } else {
                    // Wrap: apply format to the selection
                    newText  = text.slice(0, start) + open + sel + close + text.slice(end);
                    newStart = start + open.length;
                    newEnd   = end   + open.length;
                }
        } else if (config.linePrefix) {
            const prefix        = config.linePrefix;
            const lineStart     = text.lastIndexOf('\n', start - 1) + 1;
            const lineEnd       = text.indexOf('\n', end) === -1 ? text.length : text.indexOf('\n', end);
            const selectedLines = text.slice(lineStart, lineEnd);
            const lines         = selectedLines.split('\n');
            const prefixed      = lines.filter(l => l.startsWith(prefix)).length;
            const allPrefixed   = prefixed > lines.length / 2;
            const transformed   = lines.map(l =>
                allPrefixed ? l.slice(prefix.length) : prefix + l
            ).join('\n');
            newText  = text.slice(0, lineStart) + transformed + text.slice(lineEnd);
            newStart = lineStart;
            newEnd   = lineStart + transformed.length;
        }

        ta.focus();
        const isUnwrap = config?.wrap && activeStyledRuns.has(fmt);
        const affectedStart = config?.linePrefix
            ? text.lastIndexOf('\n', start - 1) + 1
            : isUnwrap
                ? activeStyledRuns.get(fmt).spanStart
                : start;
        const affectedEnd = config?.linePrefix
            ? (text.indexOf('\n', end) === -1 ? text.length : text.indexOf('\n', end))
            : isUnwrap
                ? activeStyledRuns.get(fmt).spanEnd
                : end;
        const replacement = newText.slice(affectedStart, newText.length - (text.length - affectedEnd));
        ta.setSelectionRange(affectedStart, affectedEnd);
        document.execCommand('insertText', false, replacement);
        ta.setSelectionRange(newStart, newEnd);

        ta.dispatchEvent(new Event('input'));
        hidePopup();
    });
})();