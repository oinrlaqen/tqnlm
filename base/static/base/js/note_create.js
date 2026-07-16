/* ── Preview toggle ───────────────────────────────────────── */
let isPreview = false;

function togglePreview() {
    isPreview = !isPreview;
    const editArea   = document.getElementById('edit-area');
    const previewArea = document.getElementById('preview-area');
    const tagToolbar  = document.getElementById('tag-toolbar');
    const pendingWrap = document.getElementById('pending-tags-wrap');
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
        tagToolbar.style.display  = 'none';
        pendingWrap.style.display = 'none';
        document.getElementById('all-notes-btn').style.display = 'none';
        btn.classList.add('preview-active');
        btn.innerHTML = 'Edit';
    } else {
        editArea.classList.remove('hidden-edit');
        previewArea.classList.remove('active');
        tagToolbar.style.display  = '';
        pendingWrap.style.display = '';
        document.getElementById('all-notes-btn').style.display = '';
        btn.classList.remove('preview-active');
        btn.innerHTML = 'Preview';
    }
}

/* ── Tag color system (mirrors note_list) ─────────────────── */
const PILL_COLORS = [
    'pill-purple','pill-teal','pill-coral','pill-blue','pill-amber',
    'pill-pink','pill-green','pill-indigo','pill-rose','pill-cyan',
    'pill-lime','pill-emerald','pill-violet','pill-fuchsia','pill-sky',
    'pill-orange','pill-red','pill-yellow','pill-slate','pill-gray',
    'pill-zinc','pill-neutral','pill-stone','pill-brown','pill-gold'
];
const _tagColorCache = {};
function pillClassByName(name) {
    const s = name.toLowerCase();
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return PILL_COLORS[hash % PILL_COLORS.length];
}

/* ── Apply pill colors to select panel on load ────────────── */
document.querySelectorAll('#selectTagPanelCreate .select-tag-item').forEach(function (item) {
    const name = item.dataset.tagName || item.textContent.trim();
    item.innerHTML = '<span class="pill ' + pillClassByName(name) + '">' + item.textContent + '</span>';
});

document.addEventListener('click', function () {
    const p2 = document.getElementById('selectTagPanelCreate');
    if (p2) p2.classList.remove('open');
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
        scroll.classList.toggle('not-overflowing', !overflowing);
    }

    scroll.addEventListener('scroll', update, { passive: true });
    requestAnimationFrame(update);
    return update;
}

/* ── New-note pending-tag helpers ────────────────────────── */
const pendingTagsDisplay = {};
const pendingTags = new Set();

/* Hide items already added from the Select panel */
function syncSelectPanelCreate() {
    const items = document.querySelectorAll('#selectTagPanelCreate .select-tag-item');
    let allHidden = true;
    items.forEach(function (item) {
        const name = item.dataset.tagName || '';
        const hidden = pendingTags.has(name.toLowerCase());
        item.classList.toggle('hidden', hidden);
        if (!hidden) allHidden = false;
    });
    const msg = document.getElementById('no-tags-msg-create');
    if (msg) msg.style.display = allHidden ? 'block' : 'none';
}

function addPendingTag() {
    const input = document.getElementById('new-tag-name-create');
    if (!input) return;
    const name = input.value.trim();
    if (name) {
        addPendingTagByName(name);
        input.value = '';
        input.focus();
    }
}

function addPendingTagByName(name) {
    const normalised = name.trim();
    if (!normalised || pendingTags.has(normalised.toLowerCase())) return;
    const key = normalised.toLowerCase();
    pendingTags.add(key);
    pendingTagsDisplay[key] = normalised;
    renderPendingTags();
    syncSelectPanelCreate();
    const p2 = document.getElementById('selectTagPanelCreate');
    if (p2) p2.classList.remove('open');
}

function removePendingTag(key) {
    pendingTags.delete(key);
    delete pendingTagsDisplay[key];
    renderPendingTags();
    syncSelectPanelCreate();
}

function renderPendingTags() {
    const row = document.getElementById('pending-tags-row');
    const inputsDiv = document.getElementById('pending-tags-inputs');
    if (!row || !inputsDiv) return;

    row.innerHTML = '';
    inputsDiv.innerHTML = '';

    pendingTags.forEach(function (key) {
        const displayName = pendingTagsDisplay[key] || key;

        const span = document.createElement('span');
        span.className = 'pill ' + pillClassByName(displayName);
        span.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:3px 8px 3px 10px;flex-shrink:0;';

        const textNode = document.createTextNode(displayName + ' ');
        span.appendChild(textNode);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'Remove tag';
        btn.style.cssText = 'background:none;border:none;cursor:pointer;padding:0;line-height:1;display:flex;align-items:center;opacity:.6;';
        btn.innerHTML = '<svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 2l6 6M8 2l-6 6"/></svg>';
        btn.addEventListener('click', function () { removePendingTag(key); });
        span.appendChild(btn);
        row.appendChild(span);

        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'new_tags';
        hidden.value = displayName;
        inputsDiv.appendChild(hidden);
    });

    requestAnimationFrame(function () {
        initCarousel('pending-tags-wrap', 'pending-tags-row', 'pending-arrow-left', 'pending-arrow-right');
    });
}

const createTagInput = document.getElementById('new-tag-name-create');
if (createTagInput) {
    createTagInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addPendingTag();
        }
    });
}

function toggleSelectPanelCreate(e) {
    e.stopPropagation();
    document.getElementById('selectTagPanelCreate').classList.toggle('open');
}

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

syncSelectPanelCreate();

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