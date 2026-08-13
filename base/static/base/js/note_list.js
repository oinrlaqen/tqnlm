const PILL_COLORS = [
        'pill-purple','pill-teal','pill-coral','pill-blue','pill-amber',
        'pill-pink','pill-green','pill-indigo','pill-rose','pill-cyan',
        'pill-lime','pill-emerald','pill-violet','pill-fuchsia','pill-sky',
        'pill-orange','pill-red','pill-yellow','pill-slate','pill-gray',
        'pill-zinc','pill-neutral','pill-stone','pill-brown','pill-gold'
    ];
// Color is keyed by tag ID (stable number), not name — so renames never shift colors
const tagColorById = {};

function pillClassById(tagId) {
    const key = String(tagId);
    if (!tagColorById[key]) {
        // Hash the numeric ID into a color slot so order doesn't matter
        const hash = parseInt(key, 25) || 0;
        tagColorById[key] = PILL_COLORS[hash % PILL_COLORS.length];
    }
    return tagColorById[key];
}

// Pre-seed all known tag IDs on load
ALL_TAGS_DATA.forEach(t => pillClassById(t.id));

// Strip HTML tags and decode entities to get plain text for body search
function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').toLowerCase();
}

// Pre-compute plain-text body for each note once on load
const NOTES_DATA_PLAIN = NOTES_DATA.map(n => ({
    ...n,
    bodyPlain: stripHtml(n.body)
}));

// Multi-tag selection: use a Set of string IDs
let selectedTagIds = new Set(INITIAL_TAG_FILTER ? [String(INITIAL_TAG_FILTER)] : []);
let tagFilterMode = 'or'; // 'or' = match any tag, 'and' = match all tags
let allTags = [...ALL_TAGS_DATA];
let notes = NOTES_DATA_PLAIN.map(n => ({...n, tags: [...n.tags]}));

// ── Sort state ─────────────────────────────────────────────────────────────

let sortField = 'updatedAt';
let sortDir = 'desc';

function toggleSortPanel(e) {
    e.stopPropagation();
    const panel = document.getElementById('sortPanel');
    const opening = !panel.classList.contains('open');
    if (opening) document.getElementById('tagPanel').classList.remove('open');
    panel.classList.toggle('open', opening);
    renderSortPanel();
}

function renderSortPanel() {
    const createdBtn  = document.getElementById('sortCreatedBtn');
    const updatedBtn  = document.getElementById('sortUpdatedBtn');
    const createdText = document.getElementById('sortCreatedText');
    const updatedText = document.getElementById('sortUpdatedText');
    createdBtn.classList.toggle('active',  sortField === 'created');
    updatedBtn.classList.toggle('active',  sortField === 'updatedAt');
    createdBtn.classList.toggle('flipped', sortField === 'created'   && sortDir === 'asc');
    updatedBtn.classList.toggle('flipped', sortField === 'updatedAt' && sortDir === 'asc');
    createdText.textContent = (sortField === 'created'   && sortDir === 'asc') ? 'Old first' : 'New first';
    updatedText.textContent = (sortField === 'updatedAt' && sortDir === 'asc') ? 'Old first' : 'New first';
}

function setSortDir(field, e) {
    e.stopPropagation();
    if (sortField === field) {
        sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    } else {
        sortField = field;
        sortDir = 'desc';
    }
    renderSortPanel();
    renderNotes();
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.sort-dropdown-wrap')) {
        document.getElementById('sortPanel').classList.remove('open');
    }
    if (!e.target.closest('.tag-dropdown-wrap')) {
        document.getElementById('tagPanel').classList.remove('open');
    }
});

// ── Tag panel ──────────────────────────────────────────────────────────────

function renderTagPanel() {
    const panel = document.getElementById('tagPanel');
    if (!allTags.length) {
        panel.innerHTML = '<div class="tag-panel-empty">No tags here</div>';
        return;
    }
    const modeBar = `
        <div class="tag-panel-mode" onclick="event.stopPropagation()">
            <span class="tag-panel-mode-label">Match Type</span>
            <div class="tag-mode-toggle">
                <button type="button"
                        class="tag-mode-btn ${tagFilterMode === 'or' ? 'active' : ''}"
                        onclick="setTagFilterMode('or', event)">Any</button>
                <button type="button"
                        class="tag-mode-btn ${tagFilterMode === 'and' ? 'active' : ''}"
                        onclick="setTagFilterMode('and', event)">All</button>
            </div>
        </div>`;
    panel.innerHTML = modeBar + allTags.map(tag => `
        <div class="tag-panel-item ${selectedTagIds.has(String(tag.id)) ? 'selected' : ''}"
                data-tag-id="${escAttr(String(tag.id))}"
                onclick="selectTag(this.dataset.tagId, event)">
            <span class="pill ${pillClassById(tag.id)}">${escHtml(tag.name)}</span>
            <div class="tag-item-actions">
                <button class="tag-action-btn tag-rename-btn"
                        data-tag-id="${escAttr(String(tag.id))}"
                        data-tag-name="${escAttr(tag.name)}"
                        data-rename-url="${escAttr(tag.urlRename)}"
                        onclick="openRenameModal(this.dataset.tagId, this.dataset.tagName, this.dataset.renameUrl, event)"
                        title="Rename tag" type="button">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7">
                        <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z"/>
                    </svg>
                </button>
                <button class="tag-del-btn"
                        data-tag-id="${escAttr(String(tag.id))}"
                        data-delete-url="${escAttr(tag.urlDelete)}"
                        onclick="deleteTag(this.dataset.tagId, this.dataset.deleteUrl, event)"
                        title="Delete tag" type="button">✕</button>
            </div>
        </div>
    `).join('');
}

function toggleTagPanel(e) {
    e.stopPropagation();
    const panel = document.getElementById('tagPanel');
    const isOpen = panel.classList.contains('open');
    if (!isOpen) {
        document.getElementById('sortPanel').classList.remove('open');
        renderTagPanel();
    }
    panel.classList.toggle('open', !isOpen);
}


function selectTag(tagId, e) {
    e.stopPropagation();
    const id = String(tagId);
    if (selectedTagIds.has(id)) {
        selectedTagIds.delete(id);
    } else {
        selectedTagIds.add(id);
    }
    updateTagBtnLabel();
    renderTagPanel();
    renderNotes();
}

function setTagFilterMode(mode, e) {
    e.stopPropagation();
    tagFilterMode = mode;
    renderTagPanel();
    renderNotes();
}

function updateTagBtnLabel() {
    document.getElementById('tagBtnLabel').textContent = 'Tags';
}

let _pendingDelete = null;

function deleteTag(tagId, deleteUrl, e) {
    e.stopPropagation();

    const tag = allTags.find(t => String(t.id) === String(tagId));
    document.getElementById('deleteTagModalName').textContent = tag ? tag.name : 'this tag';

    const modal = document.getElementById('deleteTagModal');
    modal.style.display = 'flex';

    _pendingDelete = { tagId, deleteUrl };

    document.getElementById('deleteTagConfirmBtn').onclick = confirmDeleteTag;
}

function confirmDeleteTag() {
    if (!_pendingDelete) return;
    const { tagId, deleteUrl } = _pendingDelete;
    closeDeleteModal();

    allTags = allTags.filter(t => t.id != tagId);
    notes = notes.map(n => ({ ...n, tags: n.tags.filter(t => t.id != tagId) }));
    selectedTagIds.delete(String(tagId));
    updateTagBtnLabel();
    renderTagPanel();
    renderNotes();

    fetch(deleteUrl, {
        method: 'POST',
        headers: { 'X-CSRFToken': CSRF_TOKEN, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'csrfmiddlewaretoken=' + encodeURIComponent(CSRF_TOKEN)
    }).catch(() => { window.location.reload(); });
}

function closeDeleteModal() {
    document.getElementById('deleteTagModal').style.display = 'none';
    _pendingDelete = null;
}

// ── Rename tag ─────────────────────────────────────────────────────────────

let _pendingRename = null;

function openRenameModal(tagId, tagName, renameUrl, e) {
    e.stopPropagation();
    document.getElementById('renameTagModalName').textContent = tagName;
    const input = document.getElementById('renameTagInput');
    input.value = tagName;
    document.getElementById('renameTagModal').style.display = 'flex';
    _pendingRename = { tagId, renameUrl };
    setTimeout(() => { input.focus(); input.select(); }, 50);
}

function showToast(msg, isError = false, isSuccess = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show' + (isError ? ' toast-error' : isSuccess ? ' toast-success' : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = ''; }, 3000);
}

function resendVerification() {
    const banner = document.getElementById('verifyBanner');
    const email = banner?.dataset.email;
    if (!email) return;

    fetch(RESEND_VERIFICATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF_TOKEN },
        body: JSON.stringify({ email }),
    })
        .then(res => res.json())
        .then(data => showToast(data.message || 'Check your inbox for a new link', false, true))
        .catch(() => showToast('Something went wrong. Try again.', true));
}

function dismissVerifyBanner() {
    const banner = document.getElementById('verifyBanner');
    if (!banner) return;
    banner.style.display = 'none';
}

function confirmRenameTag() {
    if (!_pendingRename) return;
    const { tagId, renameUrl } = _pendingRename;
    const newName = document.getElementById('renameTagInput').value.trim();
    if (!newName) return;

    const originalTag = allTags.find(t => String(t.id) === String(tagId));
    const oldName = originalTag?.name;

    // No-op if unchanged
    if (oldName && oldName.toLowerCase() === newName.toLowerCase()) {
        closeRenameModal();
        return;
    }

    // Check for duplicate before doing anything
    const duplicate = allTags.find(t =>
        String(t.id) !== String(tagId) &&
        t.name.toLowerCase() === newName.toLowerCase()
    );
    if (duplicate) {
        showToast('This tag already exists', true);
        return; // modal stays open, nothing changes
    }

    closeRenameModal();

    // Safe to update — no duplicate possible
    allTags = allTags.map(t => String(t.id) === String(tagId) ? { ...t, name: newName } : t);
    notes = notes.map(n => ({
        ...n,
        tags: n.tags.map(t => String(t.id) === String(tagId) ? { ...t, name: newName } : t)
    }));
    updateTagBtnLabel();
    renderTagPanel();
    renderNotes();

    fetch(renameUrl, {
        method: 'POST',
        headers: { 'X-CSRFToken': CSRF_TOKEN, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'csrfmiddlewaretoken=' + encodeURIComponent(CSRF_TOKEN) + '&name=' + encodeURIComponent(newName)
    })
    .then(res => res.json())
    .then(data => {
        // Should never happen given client validation, but just in case
        if (!data.ok) {
            allTags = allTags.map(t => String(t.id) === String(tagId) ? { ...t, name: oldName } : t);
            notes = notes.map(n => ({
                ...n,
                tags: n.tags.map(t => String(t.id) === String(tagId) ? { ...t, name: oldName } : t)
            }));
            updateTagBtnLabel();
            renderTagPanel();
            renderNotes();
            showToast(data.error || 'Could not rename tag.', true);
        }
    })
    .catch(() => { window.location.reload(); });
}

function closeRenameModal() {
    document.getElementById('renameTagModal').style.display = 'none';
    _pendingRename = null;
}


document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDeleteModal(); closeRenameModal(); closeDownloadModal(); closeUploadModal(); }
});

// ── Change Password modal ──────────────────────────────────────────────────

function openChangePasswordModal() {
    document.getElementById('cpCurrentPassword').value = '';
    document.getElementById('cpNewPassword').value = '';
    document.getElementById('cpConfirmPassword').value = '';
    document.getElementById('cpError').style.display = 'none';
    // Reset eye icons
    document.querySelectorAll('#changePasswordModal input[type]').forEach(inp => {
        inp.type = 'password';
    });
    document.querySelectorAll('#changePasswordModal .eye-icon').forEach(el => el.style.display = '');
    document.querySelectorAll('#changePasswordModal .eye-off-icon').forEach(el => el.style.display = 'none');
    document.getElementById('changePasswordModal').style.display = 'flex';
    setTimeout(() => document.getElementById('cpCurrentPassword').focus(), 50);
}

function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'none';
}

function toggleCpVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.querySelector('.eye-icon').style.display = isHidden ? 'none' : '';
    btn.querySelector('.eye-off-icon').style.display = isHidden ? '' : 'none';
}

function setCpError(msg) {
    const el = document.getElementById('cpError');
    el.textContent = msg;
    el.style.display = msg ? '' : 'none';
}

async function confirmChangePassword() {
    const current = document.getElementById('cpCurrentPassword').value;
    const newPw   = document.getElementById('cpNewPassword').value;
    const confirm = document.getElementById('cpConfirmPassword').value;

    if (!current) { setCpError('Please enter your current password'); return; }
    if (!newPw)   { setCpError('Please enter a new password'); return; }
    if (newPw !== confirm) { setCpError('New passwords do not match'); return; }
    if (newPw.length < 8) { setCpError('Password must be at least 8 characters'); return; }
    setCpError('');

    try {
        const res = await fetch(CHANGE_PASSWORD_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF_TOKEN },
            body: JSON.stringify({ current_password: current, new_password: newPw })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
            setCpError(data.error || 'Could not change password.');
            return;
        }
        closeChangePasswordModal();
        showToast('Password successfully changed', false, true);
    } catch {
        setCpError('An error occurred. Please try again.');
    }
}

function confirmRenameTag() {
    if (!_pendingRename) return;
    const { tagId, renameUrl } = _pendingRename;
    const newName = document.getElementById('renameTagInput').value.trim();
    if (!newName) return;

    const originalTag = allTags.find(t => String(t.id) === String(tagId));
    const oldName = originalTag?.name;

    // No-op if unchanged
    if (oldName && oldName.toLowerCase() === newName.toLowerCase()) {
        closeRenameModal();
        return;
    }

    // Check for duplicate before doing anything
    const duplicate = allTags.find(t =>
        String(t.id) !== String(tagId) &&
        t.name.toLowerCase() === newName.toLowerCase()
    );
    if (duplicate) {
        showToast('This tag already exists', true);
        return; // modal stays open, nothing changes
    }

    closeRenameModal();

    // Safe to update — no duplicate possible
    allTags = allTags.map(t => String(t.id) === String(tagId) ? { ...t, name: newName } : t);
    notes = notes.map(n => ({
        ...n,
        tags: n.tags.map(t => String(t.id) === String(tagId) ? { ...t, name: newName } : t)
    }));
    updateTagBtnLabel();
    renderTagPanel();
    renderNotes();

    fetch(renameUrl, {
        method: 'POST',
        headers: { 'X-CSRFToken': CSRF_TOKEN, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'csrfmiddlewaretoken=' + encodeURIComponent(CSRF_TOKEN) + '&name=' + encodeURIComponent(newName)
    })
    .then(res => res.json())
    .then(data => {
        // Should never happen given client validation, but just in case
        if (!data.ok) {
            allTags = allTags.map(t => String(t.id) === String(tagId) ? { ...t, name: oldName } : t);
            notes = notes.map(n => ({
                ...n,
                tags: n.tags.map(t => String(t.id) === String(tagId) ? { ...t, name: oldName } : t)
            }));
            updateTagBtnLabel();
            renderTagPanel();
            renderNotes();
            showToast(data.error || 'Could not rename tag.', true);
        }
    })
    .catch(() => { window.location.reload(); });
}

function closeRenameModal() {
    document.getElementById('renameTagModal').style.display = 'none';
    _pendingRename = null;
}


document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDeleteModal(); closeRenameModal(); closeDownloadModal(); closeUploadModal(); }
});

// ── Notes rendering ────────────────────────────────────────────────────────

const iconView = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <ellipse cx="8" cy="8" rx="5.5" ry="3.5"/>
    <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none"/>
</svg>`;

const iconEdit = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z"/>
</svg>`;

const iconDelete = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <polyline points="3,5 13,5"/>
    <path d="M6 5V3h4v2"/>
    <path d="M4.5 5l.75 8h5.5l.75-8"/>
</svg>`;

// Debounce timer for search input
let debounceTimer;
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('verified')) {
        showToast('Email verified. Happy scribing!', false, true);
        params.delete('verified');
        history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params : ''}`);
    } else if (params.has('verify_error')) {
        showToast('Verification link expired. Request a new one', true);
        params.delete('verify_error');
        history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params : ''}`);
    }
    document.getElementById('searchInput').addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderNotes, 150);
    });
});

let searchMode = 'title';

function setSearchMode(mode) {
    searchMode = mode;
    document.getElementById('toggleTitle').classList.toggle('active', mode === 'title');
    document.getElementById('toggleBody').classList.toggle('active', mode === 'body');
    renderNotes();
}

function renderNotes() {
    const grid = document.getElementById('notesGrid');
    const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();

    let filtered = notes.filter(n => {
        const matchSearch = !q || (
            searchMode === 'body'
                ? n.bodyPlain.includes(q)
                : n.title.toLowerCase().includes(q)
        );
        const matchTag = selectedTagIds.size === 0 || (
            tagFilterMode === 'and'
                ? [...selectedTagIds].every(id => n.tags.some(t => String(t.id) === id))
                : [...selectedTagIds].some(id => n.tags.some(t => String(t.id) === id))
        );
        return matchSearch && matchTag;
    });

    if (sortField) {
        filtered = [...filtered].sort((a, b) => {
            const da = new Date(a[sortField] || 0);
            const db = new Date(b[sortField] || 0);
            return sortDir === 'asc' ? da - db : db - da;
        });
    }

    if (!filtered.length) {
        grid.innerHTML = '<div class="no-notes">No notes here yet</div>';
        return;
    }

    grid.innerHTML = filtered.map(n => `
        <div class="note-card">
            <div class="note-body">
                <div class="note-title">${escHtml(n.title)}</div>
                <div class="note-tags">
                    ${n.tags.length
                        ? n.tags.map(t => `<span class="pill ${pillClassById(t.id)}">${escHtml(t.name)}</span>`).join('')
                        : '<span style="font-size:12px;color:var(--text-hint)">No tags here</span>'
                    }
                </div>
            </div>
            <div class="note-actions">
                <a href="${n.urlView}"   class="icon-btn"     title="View">${iconView}</a>
                <a href="${n.urlEdit}"   class="icon-btn"     title="Edit">${iconEdit}</a>
                <a href="${n.urlDelete}" class="icon-btn del" title="Delete">${iconDelete}</a>
            </div>
        </div>
    `).join('');
}

// ── Settings dropdown toggle ──────────────────────────────────────────────

document.addEventListener('click', function(e) {
    const btn = document.getElementById('settingsBtn');
    const dropdown = document.getElementById('settingsDropdown');
    if (!dropdown) return;
    if (btn && btn.contains(e.target)) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
    } else {
        dropdown.style.display = 'none';
    }
});

// ── Download modal ────────────────────────────────────────────────────────

let downloadSelected = new Set();

function openDownloadModal() {
    downloadSelected = new Set();
    allSelected = false;      
    const filterInput = document.getElementById('dlFilterInput');
    if (filterInput) filterInput.value = '';                              
    const btn = document.getElementById('selectAllBtn');
    if (btn) { btn.textContent = 'Select All'; btn.style.background = '#EEEDFE'; btn.style.color = 'var(--accent)'; }
    renderDownloadList();
    document.getElementById('downloadModal').style.display = 'flex';
}

function closeDownloadModal() {
    document.getElementById('downloadModal').style.display = 'none';
}

function renderDownloadList() {
    const list = document.getElementById('downloadNoteList');
    if (!notes.length) {
        list.innerHTML = '<div style="font-size:13px;color:var(--text-hint);text-align:center;padding:150px 0;">No notes to export</div>';
        return;
    }
    const q = (document.getElementById('dlFilterInput')?.value || '').toLowerCase().trim();
    const filtered = q ? notes.filter(n => n.title.toLowerCase().includes(q)) : notes;
    if (!filtered.length) {
        list.innerHTML = '<div style="font-size:13px;color:var(--text-hint);text-align:center;padding:150px 0;">No notes matched</div>';
        return;
    }
    list.innerHTML = filtered.map(n => `
        <div onclick="toggleDownloadNote(${n.id})" id="dl-row-${n.id}" class="dl-row${downloadSelected.has(n.id) ? ' selected' : ''}"
            style="display:flex; align-items:center; padding:8px 10px; border-radius:var(--radius-md); cursor:pointer; border:0.5px solid var(--border);">
            <span style="font-size:13px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(n.title)}</span>
        </div>
    `).join('');
    const btn = document.getElementById('selectAllBtn');
    if (btn) {
        const q2 = (document.getElementById('dlFilterInput')?.value || '').toLowerCase().trim();
        const visibleNotes = q2 ? notes.filter(n => n.title.toLowerCase().includes(q2)) : notes;
        const allVisibleSelected = visibleNotes.length > 0 && visibleNotes.every(n => downloadSelected.has(n.id));
        btn.style.background = allVisibleSelected ? 'var(--accent)' : '#EEEDFE';
        btn.style.color = allVisibleSelected ? '#fff' : 'var(--accent)';
    }
}

function toggleDownloadNote(id) {
    const row = document.getElementById(`dl-row-${id}`);
    if (downloadSelected.has(id)) {
        downloadSelected.delete(id);
        row.classList.remove('selected');
    } else {
        downloadSelected.add(id);
        row.classList.add('selected');
    }
    const q = (document.getElementById('dlFilterInput')?.value || '').toLowerCase().trim();
    const visibleNotes = q ? notes.filter(n => n.title.toLowerCase().includes(q)) : notes;
    const allVisibleSelected = visibleNotes.length > 0 && visibleNotes.every(n => downloadSelected.has(n.id));
    allSelected = downloadSelected.size === notes.length;
    const btn = document.getElementById('selectAllBtn');
    if (btn) {
        btn.style.background = allVisibleSelected ? 'var(--accent)' : '#EEEDFE';
        btn.style.color = allVisibleSelected ? '#fff' : 'var(--accent)';
    }
}

let allSelected = false;

function toggleSelectAll() {
    const btn = document.getElementById('selectAllBtn');
    const q = (document.getElementById('dlFilterInput')?.value || '').toLowerCase().trim();
    const visibleNotes = q ? notes.filter(n => n.title.toLowerCase().includes(q)) : notes;
    const allVisibleSelected = visibleNotes.length > 0
        ? visibleNotes.every(n => downloadSelected.has(n.id))
        : btn.style.background === 'var(--accent)';
    if (allVisibleSelected) {
        visibleNotes.forEach(n => {
            downloadSelected.delete(n.id);
            const row = document.getElementById(`dl-row-${n.id}`);
            if (row) row.classList.remove('selected');
        });
        btn.style.background = '#EEEDFE';
        btn.style.color = 'var(--accent)';
    } else {
        visibleNotes.forEach(n => {
            downloadSelected.add(n.id);
            const row = document.getElementById(`dl-row-${n.id}`);
            if (row) row.classList.add('selected');
        });
        btn.style.background = 'var(--accent)';
        btn.style.color = '#fff';
    }
    allSelected = downloadSelected.size === notes.length;
}

async function confirmDownload() {
    if (!downloadSelected.size) { showToast('No notes selected', true); return; }
    try {
        const res = await fetch(EXPORT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify({ ids: [...downloadSelected] })
        });
        if (!res.ok) { showToast('Download failed', true); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scriba_notes.zip';
        a.click();
        URL.revokeObjectURL(url);
        closeDownloadModal();
    } catch {
        showToast('Download failed', true);
    }
}

// ── Upload modal ──────────────────────────────────────────────────────────

let uploadFiles = [];

function openUploadModal() {
    uploadFiles = [];
    document.getElementById('uploadFileList').innerHTML = '<div style="font-size:13px;color:var(--text-hint);text-align:center;padding:80px 0;">No notes to upload</div>';
    document.getElementById('uploadFileInput').value = '';
    document.getElementById('uploadModal').style.display = 'flex';
}

function closeUploadModal() {
    document.getElementById('uploadModal').style.display = 'none';
}

function handleUploadDrop(e) {
    e.preventDefault();
    const zone = document.getElementById('uploadDropZone');
    zone.style.borderColor = '';
    zone.style.background = '';
    handleUploadFiles(e.dataTransfer.files);
}

function handleUploadFiles(fileList) {
    const allowed = ['.md', '.txt'];
    const MAX_SIZE = 5 * 1024 * 1024;
    for (const file of fileList) {
        const dotIndex = file.name.lastIndexOf('.');
        const ext = dotIndex !== -1 ? file.name.slice(dotIndex).toLowerCase() : '';
        if (!allowed.includes(ext)) {
            showToast(`"${escHtml(file.name)}" — only .md and .txt files are allowed`, true);
            continue;
        }
        if (file.size > MAX_SIZE) {
            showToast(`"${escHtml(file.name)}" exceeds the 5 MB limit`, true);
            continue;
        }
        if (!uploadFiles.find(f => f.name === file.name && f.size === file.size)) {
            uploadFiles.push(file);
        }
    }
    renderUploadFileList();
}

function renderUploadFileList() {
    const list = document.getElementById('uploadFileList');
    if (!uploadFiles.length) { list.innerHTML = '<div style="font-size:13px;color:var(--text-hint);text-align:center;padding:80px 0;">No notes to upload</div>'; return; }
    list.innerHTML = uploadFiles.map((f, i) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; border-radius:var(--radius-md); border:0.5px solid var(--border); font-size:13px; color:var(--text-primary);">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${escHtml(f.name)}</span>
            <button onclick="removeUploadFile(${i})" style="flex-shrink:0; margin-left:8px; background:none; border:none; cursor:pointer; color:var(--text-hint); font-size:15px; line-height:1; padding:0 2px;">×</button>
        </div>
    `).join('');
}

function removeUploadFile(index) {
    uploadFiles.splice(index, 1);
    renderUploadFileList();
}

async function confirmUpload() {
    if (!uploadFiles.length) { showToast('No files selected', true); return; }
    const formData = new FormData();
    uploadFiles.forEach(f => formData.append('files', f));
    try {
        const res = await fetch(IMPORT_URL, {
            method: 'POST',
            headers: { 'X-CSRFToken': CSRF_TOKEN },
            body: formData
        });
        const data = await res.json();
        if (!res.ok || !data.ok) { showToast('Upload failed', true); return; }
        closeUploadModal();
        showToast(`${data.created} note${data.created !== 1 ? 's' : ''} uploaded`, false, true);
        setTimeout(() => window.location.reload(), 1200);
    } catch {
        showToast('Upload failed', true);
    }
}

// ── Utilities ──────────────────────────────────────────────────────────────

function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) { return String(str).replace(/"/g,'&quot;'); }

// ── Init ──────────────────────────────────────────────────────────────────

updateTagBtnLabel();
renderNotes();