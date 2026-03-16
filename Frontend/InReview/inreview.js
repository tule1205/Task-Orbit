import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabaseUrl = 'https://qucgctvloulttuomdtfl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Y2djdHZsb3VsdHR1b21kdGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MzI2NzYsImV4cCI6MjA4OTEwODY3Nn0.s4XhKkuoyp2hzCnmGsciyEUgm9ayQzH5Qhj0rIX-_bI';
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_FILES = 'task-files';

let selectedSubtaskId = null;
let subtasks = [];
let editMode = false;

function getEl(id) {
  return document.getElementById(id);
}

function showDropdown(show) {
  const dd = getEl('cardMenuDropdown');
  const btn = getEl('cardMenuBtn');
  if (!dd || !btn) return;
  dd.hidden = !show;
  btn.setAttribute('aria-expanded', show ? 'true' : 'false');
}

function closeDropdown() {
  showDropdown(false);
}

function formatTimeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const min = Math.floor((now - d) / 60000);
  if (min < 60) return min + 'min';
  const h = Math.floor(min / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

function isInReviewStatus(status) {
  if (status == null) return false;
  const s = String(status).toLowerCase().replace(/\s+/g, ' ');
  return s === 'in review' || s === 'in_review' || s.includes('review');
}

async function fetchSubtasksInReview() {
  const { data, error } = await supabase
    .from('sub_tasks')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Subtasks fetch:', error.message);
    return [];
  }

  const rows = data || [];
  const visible = rows.filter((s) => isInReviewStatus(s.status));
  return visible.slice().sort((a, b) => {
    const posA = a.position != null ? a.position : 999;
    const posB = b.position != null ? b.position : 999;
    if (posA !== posB) return posA - posB;
    return new Date(a.created_at) - new Date(b.created_at);
  });
}

function renderSubtaskNav(list) {
  const nav = getEl('subtaskNav');
  if (!nav) return;

  nav.innerHTML = '';
  subtasks = list;

  if (list.length === 0) return;

  list.forEach((sub, index) => {
    const li = document.createElement('li');
    li.dataset.id = sub.id;
    li.dataset.index = String(index);
    li.draggable = true;
    if (sub.id === selectedSubtaskId) li.classList.add('active');

    const titleSpan = document.createElement('span');
    titleSpan.className = 'subtask-nav-title';
    titleSpan.textContent = sub.title || 'Untitled';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'subtask-delete-btn';
    deleteBtn.title = 'Delete subtask';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSubtask(sub.id);
    });

    li.appendChild(titleSpan);
    li.appendChild(deleteBtn);

    li.addEventListener('click', (e) => {
      if (e.target === deleteBtn) return;
      selectSubtask(sub);
    });
    li.addEventListener('dragstart', (e) => onSubtaskDragStart(e, sub, index));
    li.addEventListener('dragend', onSubtaskDragEnd);
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedSubtask && draggedSubtask.id !== sub.id) {
        e.currentTarget.classList.add('drag-over');
        dropTargetIndex = index;
      }
    });
    li.addEventListener('dragleave', (e) => {
      e.currentTarget.classList.remove('drag-over');
      if (e.relatedTarget && !nav.contains(e.relatedTarget)) dropTargetIndex = null;
    });
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSubtaskDrop(e, sub, index);
    });

    nav.appendChild(li);
  });
}

function setupSubtaskNavDragDrop(nav) {
  if (!nav || nav._dragDropSetup) return;
  nav._dragDropSetup = true;
  nav.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const lis = nav.querySelectorAll('li');
    const y = e.clientY;
    lis.forEach((el, i) => {
      if (el.classList.contains('dragging')) return;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        el.classList.add('drag-over');
        dropTargetIndex = i;
      } else {
        el.classList.remove('drag-over');
      }
    });
  });
  nav.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dropTargetIndex != null && draggedSubtask != null) {
      onSubtaskDropByIndex(dropTargetIndex);
    }
    nav.querySelectorAll('li').forEach((el) => el.classList.remove('drag-over'));
    dropTargetIndex = null;
  });
}

let draggedSubtask = null;
let draggedIndex = null;
let dropTargetIndex = null;

function onSubtaskDragStart(e, sub, index) {
  if (e.target.closest('.subtask-delete-btn')) {
    e.preventDefault();
    return;
  }
  draggedSubtask = sub;
  draggedIndex = index;
  e.target.closest('li').classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', sub.id);
  const empty = document.createElement('canvas');
  empty.width = 1;
  empty.height = 1;
  e.dataTransfer.setDragImage(empty, 0, 0);
}

function onSubtaskDragEnd(e) {
  e.target.closest('li')?.classList.remove('dragging');
  document.querySelectorAll('.subtask-nav li').forEach((el) => el.classList.remove('drag-over'));
  document.querySelectorAll('.nav-pill.drag-over').forEach((el) => el.classList.remove('drag-over'));
  draggedSubtask = null;
  draggedIndex = null;
  dropTargetIndex = null;
}

function onSubtaskDrop(e, targetSub, targetIndex) {
  e.preventDefault();
  e.stopPropagation();
  const targetLi = e.currentTarget;
  if (targetLi) targetLi.classList.remove('drag-over');
  const to = dropTargetIndex != null ? dropTargetIndex : targetIndex;
  if (!draggedSubtask || draggedSubtask.id === targetSub.id) return;
  if (draggedIndex === to) return;

  const from = draggedIndex;
  const reordered = [...subtasks];
  const [removed] = reordered.splice(from, 1);
  reordered.splice(to, 0, removed);

  subtasks = reordered;
  persistSubtaskOrder(reordered);
  renderSubtaskNav(reordered);
  if (selectedSubtaskId) {
    const stillSelected = reordered.find((s) => s.id === selectedSubtaskId);
    if (stillSelected) selectSubtask(stillSelected);
  }
}

function onSubtaskDropByIndex(toIndex) {
  if (!draggedSubtask || draggedIndex === toIndex) return;
  const from = draggedIndex;
  const reordered = [...subtasks];
  const [removed] = reordered.splice(from, 1);
  reordered.splice(toIndex, 0, removed);

  subtasks = reordered;
  persistSubtaskOrder(reordered);
  renderSubtaskNav(reordered);
  if (selectedSubtaskId) {
    const stillSelected = reordered.find((s) => s.id === selectedSubtaskId);
    if (stillSelected) selectSubtask(stillSelected);
  }
}

async function persistSubtaskOrder(ordered) {
  for (let i = 0; i < ordered.length; i++) {
    const { error } = await supabase
      .from('sub_tasks')
      .update({ position: i })
      .eq('id', ordered[i].id);
    if (error) console.warn('Update order:', error.message);
  }
}

async function deleteSubtask(id) {
  const { error } = await supabase.from('sub_tasks').delete().eq('id', id);
  if (error) {
    console.error('Delete subtask failed:', error.message);
    return;
  }
  if (selectedSubtaskId === id) selectedSubtaskId = null;
  const list = await fetchSubtasksInReview();
  renderSubtaskNav(list);
  if (list.length > 0 && selectedSubtaskId && list.some((s) => s.id === selectedSubtaskId)) {
    selectSubtask(list.find((s) => s.id === selectedSubtaskId));
  } else if (list.length > 0) {
    selectSubtask(list[0]);
  } else {
    getEl('subtaskTitle').textContent = '—';
    getEl('filesList').textContent = 'No subtasks in review. Move subtasks to In Review from the In Progress page.';
  }
}

async function loadSubtaskFiles(subtaskId) {
  const container = getEl('filesList');
  if (!container) return;

  const { data, error } = await supabase
    .from('task_files')
    .select('id, file_url, file_name, file_type')
    .eq('subtask_id', subtaskId)
    .order('id', { ascending: true });

  if (error) {
    console.warn('Files fetch:', error.message);
    container.innerHTML = '<p>Could not load files.</p>';
    return;
  }

  const files = data || [];
  container.innerHTML = '';

  if (files.length === 0) {
    container.innerHTML = '<p>No files added yet. Files are added on the In Progress page.</p>';
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'activity-bullets';
  files.forEach((f) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = f.file_url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'activity-file-link';
    a.textContent = f.file_name || 'File';
    li.appendChild(a);
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

async function selectSubtask(sub) {
  selectedSubtaskId = sub.id;
  document.querySelectorAll('#subtaskNav li').forEach((el) => el.classList.remove('active'));
  const active = document.querySelector(`#subtaskNav li[data-id="${sub.id}"]`);
  if (active) active.classList.add('active');

  getEl('subtaskTitle').textContent = sub.title || '—';

  await loadSubtaskFiles(sub.id);
  await loadActivity(sub.id);
  await loadChat(sub.id);
}

function showMainView() {
  getEl('panelMain')?.classList.add('active');
  getEl('panelActivity')?.classList.remove('active');
}

function showActivityView() {
  getEl('panelMain')?.classList.remove('active');
  getEl('panelActivity')?.classList.add('active');
  if (selectedSubtaskId) loadActivityPage(selectedSubtaskId);
}

function isActivityPanelActive() {
  const panel = getEl('panelActivity');
  return panel?.classList.contains('active') ?? false;
}

async function loadActivityPage(subtaskId) {
  const list = getEl('activityPageList');
  if (!list) return;
  list.innerHTML = '';

  const { data, error } = await supabase
    .from('activities')
    .select('id, action, details, issue_description, link_url, created_at, subtask_id')
    .eq('subtask_id', subtaskId)
    .in('action', ['created an issue', 'added this file'])
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Activity page fetch:', error.message);
    list.textContent = 'Could not load activity.';
    return;
  }
  const items = data || [];
  if (items.length === 0) {
    list.textContent = 'No activity yet. Create an issue or add files from the ⋯ menu.';
    return;
  }

  items.forEach((a) => {
    const timeAgo = formatTimeAgo(a.created_at);
    const isIssue = (a.action || '').toLowerCase().includes('issue');

    const item = document.createElement('div');
    item.className = 'activity-page-item';

    const row = document.createElement('div');
    row.className = 'activity-page-item-row';

    if (isIssue) {
      const title = a.details || 'Untitled issue';
      const desc = a.issue_description || '';
      row.innerHTML = `
        <div class="activity-page-item-content">
          <strong class="activity-page-item-title">${escapeHtml(title)}</strong>
          ${desc ? `<p class="activity-page-item-description">${escapeHtml(desc)}</p>` : ''}
        </div>
        <span class="activity-page-item-time">${timeAgo}</span>
        ${editMode ? `<button type="button" class="activity-page-item-delete" title="Remove">×</button>` : ''}
      `;
    } else {
      const fileLink = a.link_url && a.details
        ? `<a href="${escapeHtml(a.link_url)}" target="_blank" rel="noopener noreferrer" class="activity-file-link">${escapeHtml(a.details)}</a>`
        : (a.details || 'File');
      row.innerHTML = `
        <div class="activity-page-item-content">${fileLink}</div>
        <span class="activity-page-item-time">${timeAgo}</span>
        ${editMode ? `<button type="button" class="activity-page-item-delete" title="Remove">×</button>` : ''}
      `;
    }

    const deleteBtn = row.querySelector('.activity-page-item-delete');
    if (editMode && deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (isIssue) {
          deleteIssue(a.id);
        } else {
          deleteFileForActivity(a);
        }
      });
    }
    item.appendChild(row);
    list.appendChild(item);
  });
}

async function deleteIssue(issueId) {
  const { error } = await supabase.from('activities').delete().eq('id', issueId);
  if (error) {
    console.warn('Delete issue failed:', error.message);
    return;
  }
  if (selectedSubtaskId) {
    await loadActivity(selectedSubtaskId);
    if (isActivityPanelActive()) await loadActivityPage(selectedSubtaskId);
  }
}

async function deleteFileForActivity(activity) {
  if (!activity || !activity.link_url || !activity.subtask_id) return;
  await supabase
    .from('task_files')
    .delete()
    .eq('subtask_id', activity.subtask_id)
    .eq('file_url', activity.link_url);
  const { error } = await supabase.from('activities').delete().eq('id', activity.id);
  if (error) console.warn('Delete activity for file failed:', error.message);
  if (selectedSubtaskId) {
    await loadSubtaskFiles(selectedSubtaskId);
    await loadActivity(selectedSubtaskId);
    if (isActivityPanelActive()) await loadActivityPage(selectedSubtaskId);
  }
}

const MAIN_ACTIVITY_PREVIEW_LIMIT = 3;

async function loadActivity(subtaskId) {
  const list = getEl('activityList');
  if (!list) return;

  list.innerHTML = '';
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('subtask_id', subtaskId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('Activity fetch:', error.message);
    return;
  }
  const items = (data || []).filter((a) => a.action !== 'completed');
  const previewItems = items.slice(0, MAIN_ACTIVITY_PREVIEW_LIMIT);
  previewItems.forEach((a) => {
    const li = document.createElement('li');
    const who = a.user_name || 'Someone';
    const action = a.action || '';
    const label = `${who} ${action}`.trim();
    const timeAgo = formatTimeAgo(a.created_at);
    const timePart = ` · ${timeAgo}`;
    if (a.link_url && a.details) {
      const link = document.createElement('a');
      link.href = a.link_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = a.details;
      link.className = 'activity-file-link';
      li.appendChild(document.createTextNode(label + ': '));
      li.appendChild(link);
      li.appendChild(document.createTextNode(timePart));
    } else if (a.details) {
      li.textContent = `${label}: ${a.details}${timePart}`;
    } else {
      li.textContent = (label || 'Activity') + timePart;
    }
    list.appendChild(li);
  });
  if (items.length > MAIN_ACTIVITY_PREVIEW_LIMIT) {
    const li = document.createElement('li');
    const moreLink = document.createElement('button');
    moreLink.type = 'button';
    moreLink.className = 'activity-show-more';
    moreLink.textContent = `Show more... (${items.length} items)`;
    moreLink.addEventListener('click', () => showActivityView());
    li.appendChild(moreLink);
    list.appendChild(li);
  }
  if (items.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No activity yet.';
    list.appendChild(li);
  }
}

async function loadChat(subtaskId) {
  const container = getEl('chatContainer');
  const entries = getEl('chatEntries');
  if (!container || !entries) return;

  container.classList.remove('hidden');

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('subtask_id', subtaskId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Chat fetch:', error.message);
    entries.innerHTML = '<p class="chat-empty">Could not load chat.</p>';
    return;
  }
  const messages = data || [];
  entries.innerHTML = '';
  if (messages.length === 0) {
    entries.innerHTML = '<p class="chat-empty">No messages yet.</p>';
    return;
  }
  messages.forEach((msg) => {
    const name = msg.user_name || 'Someone';
    const initial = name.charAt(0).toUpperCase();
    const time = formatTimeAgo(msg.created_at);
    const div = document.createElement('div');
    div.className = 'chat-entry';
    div.innerHTML = `
      <div class="chat-header">
        <div class="user-meta">
          <div class="avatar small">${initial}</div>
          <strong>${escapeHtml(name)}</strong>
        </div>
        <span class="time-stamp">${time}</span>
      </div>
      <p class="chat-text">${escapeHtml(msg.message || '')}</p>
    `;
    entries.appendChild(div);
  });
}

async function sendChatMessage() {
  const input = getEl('chatInput');
  const text = input?.value?.trim();
  if (!text || !selectedSubtaskId) return;
  const { error } = await supabase.from('chat_messages').insert({
    subtask_id: selectedSubtaskId,
    user_name: 'You',
    message: text,
  });
  if (error) {
    console.warn('Chat send failed:', error.message);
    return;
  }
  input.value = '';
  await loadChat(selectedSubtaskId);
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function openIssueModal() {
  const modal = getEl('issueModal');
  if (modal) {
    modal.hidden = false;
    getEl('issueTitle').value = '';
    getEl('issueDescription').value = '';
    getEl('issueTitle').focus();
  }
}

function closeIssueModal() {
  const modal = getEl('issueModal');
  if (modal) modal.hidden = true;
}

function setupMenuAndFiles() {
  const btn = getEl('cardMenuBtn');
  const dropdown = getEl('cardMenuDropdown');
  const editBtn = getEl('editModeBtn');
  const addFilesBtn = getEl('addFilesBtn');
  const createIssueBtn = getEl('createIssueBtn');
  const fileInput = getEl('fileInput');

  if (btn) btn.addEventListener('click', (e) => {
    e.stopPropagation();
    showDropdown(dropdown.hidden);
  });
  if (editBtn) editBtn.addEventListener('click', () => {
    closeDropdown();
    toggleEditMode();
  });
  if (addFilesBtn) addFilesBtn.addEventListener('click', () => {
    closeDropdown();
    if (fileInput) fileInput.click();
  });
  if (createIssueBtn) createIssueBtn.addEventListener('click', () => {
    closeDropdown();
    openIssueModal();
  });
  document.addEventListener('click', closeDropdown);

  getEl('issueModalClose')?.addEventListener('click', closeIssueModal);
  getEl('issueModalCancel')?.addEventListener('click', closeIssueModal);
  getEl('issueModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'issueModal') closeIssueModal();
  });
  getEl('issueModalSubmit')?.addEventListener('click', async () => {
    const title = getEl('issueTitle')?.value?.trim();
    if (!title) return;
    if (!selectedSubtaskId) return;
    const description = getEl('issueDescription')?.value?.trim() || null;
    await logActivity(selectedSubtaskId, 'created an issue', title, null, description);
    closeIssueModal();
    await loadActivity(selectedSubtaskId);
    if (isActivityPanelActive()) await loadActivityPage(selectedSubtaskId);
  });

  if (fileInput) fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files?.length || !selectedSubtaskId) return;
    for (const file of files) {
      await uploadFile(file, selectedSubtaskId);
    }
    fileInput.value = '';
  });
}

function toggleEditMode() {
  editMode = !editMode;
  const body = document.body;
  if (editMode) {
    body.classList.add('inprogress-edit-mode');
  } else {
    body.classList.remove('inprogress-edit-mode');
  }
  if (selectedSubtaskId && isActivityPanelActive()) {
    loadActivityPage(selectedSubtaskId);
  }
}

async function logActivity(subtaskId, action, details = null, linkUrl = null, issueDescription = null) {
  const row = {
    subtask_id: subtaskId,
    user_name: 'You',
    action,
    details,
  };
  if (linkUrl) row.link_url = linkUrl;
  if (issueDescription != null) row.issue_description = issueDescription;
  await supabase.from('activities').insert(row);
}

async function uploadFile(file, subtaskId) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const name = `${subtaskId}/${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from(BUCKET_FILES)
    .upload(name, file, { upsert: true });

  if (error) {
    console.error('Upload error:', error.message);
    alert('Could not upload file: ' + error.message + '. Create a Storage bucket named "' + BUCKET_FILES + '" and set it to Public in Supabase.');
    return;
  }
  const { data: urlData } = supabase.storage.from(BUCKET_FILES).getPublicUrl(data.path);
  const fileUrl = urlData?.publicUrl || '';

  const { error: insertError } = await supabase.from('task_files').insert({
    subtask_id: subtaskId,
    file_url: fileUrl,
    file_name: file.name,
    file_type: file.type || ext,
  });
  if (insertError) {
    console.error('task_files insert error:', insertError.message);
  }
  await logActivity(subtaskId, 'added this file', file.name, fileUrl);
  if (selectedSubtaskId && String(selectedSubtaskId) === String(subtaskId)) {
    await loadSubtaskFiles(subtaskId);
    await loadActivity(subtaskId);
    if (isActivityPanelActive()) await loadActivityPage(subtaskId);
  }
}

function setupStatusPillDropZone(pillId, newStatus) {
  const pill = getEl(pillId);
  if (!pill) return;
  pill.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSubtask) pill.classList.add('drag-over');
  });
  pill.addEventListener('dragleave', (e) => {
    if (!pill.contains(e.relatedTarget)) pill.classList.remove('drag-over');
  });
  pill.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    pill.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const { error } = await supabase
      .from('sub_tasks')
      .update({ status: newStatus })
      .eq('id', id);
    if (!error) {
      if (newStatus === 'done') {
        await supabase.from('activities').insert({
          subtask_id: id,
          user_name: 'You',
          action: 'completed',
        });
      }
      const list = await fetchSubtasksInReview();
      renderSubtaskNav(list);
      if (String(selectedSubtaskId) === String(id)) {
        selectedSubtaskId = null;
        getEl('subtaskTitle').textContent = '—';
        getEl('filesList').textContent = 'No subtasks selected.';
        const activityList = getEl('activityList');
        if (activityList) activityList.innerHTML = '';
        const chatEntries = getEl('chatEntries');
        if (chatEntries) chatEntries.innerHTML = '<p class="chat-empty">Select a subtask to view chat.</p>';
      } else if (list.length > 0 && list.some((s) => String(s.id) === String(selectedSubtaskId))) {
        selectSubtask(list.find((s) => String(s.id) === String(selectedSubtaskId)));
      }
    }
  });
}

async function init() {
  setupMenuAndFiles();
  getEl('activityBtn')?.addEventListener('click', showActivityView);
  getEl('activityBackBtn')?.addEventListener('click', showMainView);
  getEl('chatSendBtn')?.addEventListener('click', sendChatMessage);
  getEl('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); }
  });
  setupSubtaskNavDragDrop(getEl('subtaskNav'));
  setupStatusPillDropZone('toDoPill', 'todo');
  setupStatusPillDropZone('inProgressPill', 'in progress');
  setupStatusPillDropZone('donePill', 'done');
  const list = await fetchSubtasksInReview();
  renderSubtaskNav(list);
  if (list.length > 0 && !selectedSubtaskId) {
    selectSubtask(list[0]);
  } else if (list.length === 0) {
    getEl('subtaskTitle').textContent = '—';
    getEl('filesList').textContent = 'No subtasks in review. Move subtasks to In Review from the In Progress page.';
  }
}

document.addEventListener('DOMContentLoaded', init);
