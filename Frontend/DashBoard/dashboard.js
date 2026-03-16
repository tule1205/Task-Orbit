import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabaseUrl = 'https://qucgctvloulttuomdtfl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Y2djdHZsb3VsdHR1b21kdGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MzI2NzYsImV4cCI6MjA4OTEwODY3Nn0.s4XhKkuoyp2hzCnmGsciyEUgm9ayQzH5Qhj0rIX-_bI';
const supabaseClient = createClient(supabaseUrl, supabaseKey);

window._selectedTaskId = null;
let allTasks = [];

function getTaskSearchQuery() {
    const el = document.getElementById('taskSearchInput');
    return (el?.value || '').trim().toLowerCase();
}

function renderFilteredTaskList() {
    const query = getTaskSearchQuery();
    const filtered = query
        ? allTasks.filter((t) => (t.title || '').toLowerCase().includes(query))
        : allTasks;
    renderTaskListNav(filtered);
}

// --- CORE FETCH & RENDER ---
async function fetchTasks() {
    const { data, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true });

    if (!error && data) {
        allTasks = data;
        renderFilteredTaskList();
        if (data.length > 0) {
            const taskToSelect = window._selectedTaskId
                ? data.find(t => t.id === window._selectedTaskId) || data[0]
                : data[0];
            await selectTask(taskToSelect);
        } else {
            showNoTaskState();
        }
    }
}

function showNoTaskState() {
    window._selectedTaskId = null;
    const mainCard = document.getElementById('mainTaskCard');
    const sidebarCard = document.getElementById('sidebarTaskCard');
    if (mainCard) mainCard.hidden = true;
    if (sidebarCard) sidebarCard.hidden = true;
}

function renderTaskListNav(tasks) {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;
    taskList.innerHTML = '';
    
    tasks.forEach((task) => {
        const li = document.createElement('li');
        li.dataset.taskId = task.id;
        if (window._selectedTaskId === task.id) li.classList.add('active');

        // Create a container for the title and the delete button
        li.innerHTML = `
            <span class="task-link-text">${task.title || 'Untitled'}</span>
            <button class="task-delete-btn" title="Delete Task">×</button>
        `;

        // Click on the text to select
        li.querySelector('.task-link-text').addEventListener('click', () => selectTask(task));

        // Click on the X to delete
        li.querySelector('.task-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent selecting the task when deleting
            window.deleteTask(task.id);
        });

        taskList.appendChild(li);
    });
}

async function selectTask(task) {
    window._selectedTaskId = task.id;

    const mainCard = document.getElementById('mainTaskCard');
    const sidebarCard = document.getElementById('sidebarTaskCard');
    if (mainCard) mainCard.hidden = false;
    if (sidebarCard) sidebarCard.hidden = false;

    document.querySelectorAll('#taskList li').forEach(el => el.classList.remove('active'));
    const activeLi = document.querySelector(`#taskList li[data-task-id="${task.id}"]`);
    if (activeLi) activeLi.classList.add('active');

    document.getElementById('displayTitle').textContent = task.title || '';
    document.getElementById('summaryText').textContent = task.overview || 'No overview provided.';
    document.getElementById('descriptionText').textContent = task.description || 'No description provided.';

    const createdDate = new Date(task.created_at).toLocaleString();
    const dueDate = task.due_date ? new Date(task.due_date).toLocaleString() : 'No due date';

    document.getElementById('sideCreatedTime').textContent = createdDate;
    document.getElementById('mainCreatedTime').textContent = createdDate;
    document.getElementById('sideDueTime').textContent = `Due: ${dueDate}`;
    document.getElementById('mainDueTime').textContent = `Due: ${dueDate}`;

    await renderTaskLabelsForTask(task.id);
    await fetchSubTasks(task.id);
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

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

async function loadActivityPageForTask(taskId) {
    const list = document.getElementById('activityPageList');
    if (!list) return;
    list.innerHTML = '';

    const { data: subtasks } = await supabaseClient
        .from('sub_tasks')
        .select('id')
        .eq('task_id', taskId);
    const subtaskIds = (subtasks || []).map(s => s.id);
    if (subtaskIds.length === 0) {
        list.textContent = 'No activity yet. Create issues or add files from the In Progress page.';
        return;
    }

    const { data, error } = await supabaseClient
        .from('activities')
        .select('id, action, details, issue_description, link_url, created_at, subtask_id')
        .in('subtask_id', subtaskIds)
        .in('action', ['created an issue', 'added this file'])
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('Activity page fetch:', error.message);
        list.textContent = 'Could not load activity.';
        return;
    }
    const items = data || [];
    if (items.length === 0) {
        list.textContent = 'No activity yet. Create issues or add files from the In Progress page.';
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
            `;
        } else {
            const fileLink = a.link_url && a.details
                ? `<a href="${escapeHtml(a.link_url)}" target="_blank" rel="noopener noreferrer" class="activity-file-link">${escapeHtml(a.details)}</a>`
                : (a.details || 'File');
            row.innerHTML = `
                <div class="activity-page-item-content">${fileLink}</div>
                <span class="activity-page-item-time">${timeAgo}</span>
            `;
        }
        item.appendChild(row);
        list.appendChild(item);
    });
}

async function fetchTaskLabels(taskId) {
    const { data: taskLabelRows, error: err1 } = await supabaseClient
        .from('task_labels')
        .select('label_id')
        .eq('task_id', taskId);
    if (err1 || !taskLabelRows?.length) return [];
    const ids = taskLabelRows.map(r => r.label_id);
    const { data: labelsData, error: err2 } = await supabaseClient
        .from('labels')
        .select('id, name')
        .in('id', ids);
    return err2 ? [] : (labelsData || []);
}

function renderTaskLabelsForTask(taskId) {
    const container = document.getElementById('taskLabels');
    if (!container) return Promise.resolve();
    container.innerHTML = '';
    const labelColors = [
        { bg: '#e3f2fd', fg: '#1565c0' },
        { bg: '#fce4ec', fg: '#c2185b' },
        { bg: '#e8f5e9', fg: '#2e7d32' },
        { bg: '#fff3e0', fg: '#e65100' },
        { bg: '#f3e5f5', fg: '#7b1fa2' },
        { bg: '#e0f7fa', fg: '#00838f' },
        { bg: '#fff8e1', fg: '#f9a825' },
        { bg: '#eceff1', fg: '#546e7a' },
    ];
    const hash = (s) => [...s].reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    return fetchTaskLabels(taskId).then(labels => {
        labels.forEach(l => {
            const span = document.createElement('span');
            span.className = 'task-label-pill';
            span.textContent = l.name;
            const idx = Math.abs(hash(l.id)) % labelColors.length;
            const { bg, fg } = labelColors[idx];
            span.style.backgroundColor = bg;
            span.style.color = fg;
            container.appendChild(span);
        });
    });
}


async function fetchSubTasks(taskId) {
    const { data, error } = await supabaseClient
        .from('sub_tasks')
        .select('*')
        .eq('task_id', taskId)
        .eq('status', 'todo') 
        .order('created_at', { ascending: true });
    
    renderSubList(!error && data ? data : []);
}

function renderSubList(subTasks) {
    const todoList = document.getElementById('todo-list');
    if (!todoList) return;
    todoList.innerHTML = '';

    subTasks.forEach((sub) => {
        const li = document.createElement('li');
        li.className = 'todo-item-styled';
        li.draggable = true; // Enable dragging

        li.innerHTML = `
            <span>${sub.title}</span>
            <button class="delete-btn" onclick="deleteSubTask('${sub.id}')">×</button>
        `;

        // Start dragging
        li.addEventListener('dragstart', (e) => {
            li.classList.add('dragging');
            e.dataTransfer.setData('text/plain', sub.id);
        });

        li.addEventListener('dragend', () => li.classList.remove('dragging'));
        todoList.appendChild(li);
    });

    setupDropZones();
}

function setupDropZones() {
    // Select the three target buttons (exclude 'To Do' if it's a button you don't want to disappear from)
    const targets = document.querySelectorAll('.status-btn');

    targets.forEach(btn => {
        btn.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            btn.classList.add('drag-over');
        });

        btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));

        btn.addEventListener('drop', async (e) => {
            e.preventDefault();
            btn.classList.remove('drag-over');
            
            const subTaskId = e.dataTransfer.getData('text/plain');
            const targetStatus = btn.textContent.trim().toLowerCase();

            // We only move it if the target is NOT "to do" (as you requested)
            if (targetStatus !== 'to do') {
                await updateSubTaskStatus(subTaskId, targetStatus);
            }
        });
    });
}

async function updateSubTaskStatus(id, newStatus) {
    const { error } = await supabaseClient
        .from('sub_tasks')
        .update({ status: newStatus })
        .eq('id', id);

    if (error) {
        console.error('Update subtask status failed:', error.message);
        alert('Could not move subtask: ' + error.message);
        return;
    }
    if (newStatus === 'done') {
        await supabaseClient.from('activities').insert({
            subtask_id: id,
            user_name: 'You',
            action: 'completed',
        });
    }
    // Refresh the list. Because the sub-task now has a new status,
    // it will be filtered out of the 'To Do' view.
    await fetchSubTasks(window._selectedTaskId);
}

window.deleteSubTask = async (subTaskId) => {
    const { error } = await supabaseClient.from('sub_tasks').delete().eq('id', subTaskId);
    if (!error && window._selectedTaskId) await fetchSubTasks(window._selectedTaskId);
};

// --- MODAL & CREATE TASK ---
window._newTaskLabelIds = [];
window._newTaskLabelNames = {};

function renderNewTaskLabelPills() {
    const container = document.getElementById('newTaskLabelsPills');
    if (!container) return;
    container.innerHTML = '';
    const labelColors = [
        { bg: '#e3f2fd', fg: '#1565c0' }, { bg: '#fce4ec', fg: '#c2185b' }, { bg: '#e8f5e9', fg: '#2e7d32' },
        { bg: '#fff3e0', fg: '#e65100' }, { bg: '#f3e5f5', fg: '#7b1fa2' }, { bg: '#e0f7fa', fg: '#00838f' },
        { bg: '#fff8e1', fg: '#f9a825' }, { bg: '#eceff1', fg: '#546e7a' },
    ];
    const hash = (s) => [...s].reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    window._newTaskLabelIds.forEach(id => {
        const name = window._newTaskLabelNames[id] || id;
        const span = document.createElement('span');
        span.className = 'edit-label-pill';
        const idx = Math.abs(hash(id)) % labelColors.length;
        span.style.backgroundColor = labelColors[idx].bg;
        span.style.color = labelColors[idx].fg;
        span.innerHTML = `${name} <button type="button" class="edit-label-remove" aria-label="Remove label">×</button>`;
        span.querySelector('.edit-label-remove').addEventListener('click', () => {
            window._newTaskLabelIds = window._newTaskLabelIds.filter(lid => lid !== id);
            renderNewTaskLabelPills();
        });
        container.appendChild(span);
    });
}

window.openModal = () => {
    window._newTaskLabelIds = [];
    window._newTaskLabelNames = {};
    document.getElementById('newTaskLabelInput').value = '';
    renderNewTaskLabelPills();
    const errEl = document.getElementById('newTaskError');
    if (errEl) errEl.textContent = '';
    document.querySelectorAll('#taskModal .input-group').forEach((g) => g.classList.remove('input-error'));
    document.getElementById('taskModal').style.display = 'flex';
};
window.closeModal = () => {
    document.getElementById('taskModal').style.display = 'none';
};

window.addLabelToNewTaskForm = async () => {
    const input = document.getElementById('newTaskLabelInput');
    const name = input?.value?.trim();
    if (!name) return;
    const { data: existing } = await supabaseClient.from('labels').select('id, name').ilike('name', name).maybeSingle();
    let labelId, labelName;
    if (existing) {
        labelId = existing.id;
        labelName = existing.name;
    } else {
        const { data: inserted, error } = await supabaseClient.from('labels').insert([{ name }]).select('id, name').single();
        if (error) {
            if (error.code === '23505') {
                const { data: found } = await supabaseClient.from('labels').select('id, name').ilike('name', name).maybeSingle();
                if (found) { labelId = found.id; labelName = found.name; }
            }
            if (!labelId) { console.error('Label error:', error.message); return; }
        } else {
            labelId = inserted.id;
            labelName = inserted.name;
        }
    }
    if (window._newTaskLabelIds.includes(labelId)) {
        input.value = '';
        return;
    }
    window._newTaskLabelIds.push(labelId);
    window._newTaskLabelNames[labelId] = labelName;
    renderNewTaskLabelPills();
    input.value = '';
};

window.openLabelModal = () => {
    document.getElementById('labelModal').style.display = 'flex';
    document.getElementById('modalLabelName').value = '';
};
window.closeLabelModal = () => document.getElementById('labelModal').style.display = 'none';

function closeCardDropdown() {
    const dd = document.getElementById('cardDropdown');
    if (dd) dd.hidden = true;
}

window._editModalLabelIds = [];
window._editModalLabelNames = {};

function renderEditModalPills() {
    const container = document.getElementById('editModalLabelsPills');
    if (!container) return;
    container.innerHTML = '';
    const labelColors = [
        { bg: '#e3f2fd', fg: '#1565c0' }, { bg: '#fce4ec', fg: '#c2185b' }, { bg: '#e8f5e9', fg: '#2e7d32' },
        { bg: '#fff3e0', fg: '#e65100' }, { bg: '#f3e5f5', fg: '#7b1fa2' }, { bg: '#e0f7fa', fg: '#00838f' },
        { bg: '#fff8e1', fg: '#f9a825' }, { bg: '#eceff1', fg: '#546e7a' },
    ];
    const hash = (s) => [...s].reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    window._editModalLabelIds.forEach(id => {
        const name = window._editModalLabelNames[id] || id;
        const span = document.createElement('span');
        span.className = 'edit-label-pill';
        const idx = Math.abs(hash(id)) % labelColors.length;
        span.style.backgroundColor = labelColors[idx].bg;
        span.style.color = labelColors[idx].fg;
        span.innerHTML = `${name} <button type="button" class="edit-label-remove" data-label-id="${id}" aria-label="Remove label">×</button>`;
        span.querySelector('.edit-label-remove').addEventListener('click', () => {
            window._editModalLabelIds = window._editModalLabelIds.filter(lid => lid !== id);
            renderEditModalPills();
        });
        container.appendChild(span);
    });
}

window.openEditModal = async () => {
    closeCardDropdown();
    const taskId = window._selectedTaskId;
    if (!taskId) return;
    const { data: task, error: taskErr } = await supabaseClient.from('tasks').select('*').eq('id', taskId).single();
    if (taskErr || !task) return;
    document.getElementById('editModalTitle').value = task.title || '';
    document.getElementById('editModalOverview').value = task.overview || '';
    document.getElementById('editModalDescription').value = task.description || '';
    const labels = await fetchTaskLabels(taskId);
    window._editModalLabelIds = labels.map(l => l.id);
    window._editModalLabelNames = labels.reduce((acc, l) => { acc[l.id] = l.name; return acc; }, {});
    renderEditModalPills();
    document.getElementById('editTaskModal').style.display = 'flex';
};

window.closeEditModal = () => document.getElementById('editTaskModal').style.display = 'none';

window.submitEditTask = async () => {
    const taskId = window._selectedTaskId;
    if (!taskId) return;
    const title = document.getElementById('editModalTitle').value.trim();
    const overview = document.getElementById('editModalOverview').value;
    const description = document.getElementById('editModalDescription').value;
    const { error: updateErr } = await supabaseClient.from('tasks').update({ title, overview, description }).eq('id', taskId);
    if (updateErr) {
        console.error('Update task error:', updateErr.message);
        alert('Could not save: ' + updateErr.message);
        return;
    }
    await supabaseClient.from('task_labels').delete().eq('task_id', taskId);
    if (window._editModalLabelIds.length) {
        await supabaseClient.from('task_labels').insert(
            window._editModalLabelIds.map(label_id => ({ task_id: taskId, label_id }))
        );
    }
    window.closeEditModal();
    const { data: task } = await supabaseClient.from('tasks').select('*').eq('id', taskId).single();
    if (task) await selectTask(task);
};

window.submitNewTask = async () => {
    const titleInput = document.getElementById('modalTitle');
    const overviewInput = document.getElementById('modalOverview');
    const dueDateInput = document.getElementById('modalDueDate');
    const title = titleInput?.value?.trim() ?? '';
    const overview = (overviewInput?.value ?? '').trim();
    const description = (document.getElementById('modalDescription')?.value ?? '').trim();
    const dueDate = dueDateInput?.value ?? '';

    const errEl = document.getElementById('newTaskError');
    const errors = [];
    if (!title) errors.push('Title is required.');
    if (!overview) errors.push('Overview is required.');
    if (!dueDate) errors.push('Due date is required.');

    document.querySelectorAll('#taskModal .input-group').forEach((g) => g.classList.remove('input-error'));
    if (errors.length > 0) {
        if (errEl) errEl.textContent = errors.join(' ');
        const titleGroup = titleInput?.closest('.input-group');
        const overviewGroup = overviewInput?.closest('.input-group');
        const dueGroup = dueDateInput?.closest('.input-group');
        if (!title && titleGroup) titleGroup.classList.add('input-error');
        if (!overview && overviewGroup) overviewGroup.classList.add('input-error');
        if (!dueDate && dueGroup) dueGroup.classList.add('input-error');
        return;
    }
    if (errEl) errEl.textContent = '';

    const { data: { user } } = await supabaseClient.auth.getUser();

    const { data, error } = await supabaseClient
        .from('tasks')
        .insert([{ 
            title, 
            overview, 
            description, 
            due_date: dueDate,
            user_id: user?.id, 
            status: 'todo' 
        }])
        .select();

    if (!error) {
        const newTaskId = data?.[0]?.id;
        if (newTaskId && window._newTaskLabelIds?.length) {
            await supabaseClient.from('task_labels').insert(
                window._newTaskLabelIds.map(label_id => ({ task_id: newTaskId, label_id }))
            );
        }
        window.closeModal();
        // Reset form fields
        document.getElementById('modalTitle').value = '';
        document.getElementById('modalOverview').value = '';
        document.getElementById('modalDescription').value = '';
        document.getElementById('modalDueDate').value = '';
        window._newTaskLabelIds = [];
        window._newTaskLabelNames = {};
        document.getElementById('newTaskLabelInput').value = '';
        renderNewTaskLabelPills();

        await fetchTasks();
        if (data) selectTask(data[0]);
    } else {
        console.error("Create Task Error:", error.message);
        const errEl = document.getElementById('newTaskError');
        if (errEl) errEl.textContent = 'Could not create task: ' + (error.message || 'Please try again.');
    }
};

window.submitNewLabel = async () => {
    const name = document.getElementById('modalLabelName').value.trim();
    if (!name) return alert('Label name is required');
    const { data: inserted, error } = await supabaseClient.from('labels').insert([{ name }]).select('id').single();
    if (error) {
        console.error('Create Label Error:', error.message);
        if (error.code === '23505') alert('A label with this name already exists.');
        else alert('Could not create label: ' + error.message);
        return;
    }
    window.closeLabelModal();
    document.getElementById('modalLabelName').value = '';
    if (inserted?.id && window._selectedTaskId) {
        await supabaseClient.from('task_labels').insert([{ task_id: window._selectedTaskId, label_id: inserted.id }]);
    }
    if (window._selectedTaskId) await renderTaskLabelsForTask(window._selectedTaskId);
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Sign In
    const { data: { user } } = await supabaseClient.auth.signInAnonymously();

    // 2. Attach Listeners for Task Creation
    document.getElementById('openModalBtn')?.addEventListener('click', window.openModal);
    document.getElementById('closeModalBtn')?.addEventListener('click', window.closeModal);
    document.getElementById('submitNewTaskBtn')?.addEventListener('click', window.submitNewTask);
    document.getElementById('newTaskLabelInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); window.addLabelToNewTaskForm(); }
    });
    document.getElementById('labelTab')?.addEventListener('click', window.openLabelModal);
    document.getElementById('closeLabelModalBtn')?.addEventListener('click', window.closeLabelModal);
    document.getElementById('submitNewLabelBtn')?.addEventListener('click', window.submitNewLabel);

    document.getElementById('cardMenuBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const dd = document.getElementById('cardDropdown');
        dd.hidden = !dd.hidden;
    });
    document.getElementById('cardEditBtn')?.addEventListener('click', () => window.openEditModal());
    document.addEventListener('click', (e) => {
        if (!document.querySelector('.card-menu-wrap')?.contains(e.target)) closeCardDropdown();
    });
    document.getElementById('closeEditModalBtn')?.addEventListener('click', window.closeEditModal);
    document.getElementById('submitEditTaskBtn')?.addEventListener('click', window.submitEditTask);

    document.getElementById('overviewTab')?.addEventListener('click', () => {
        document.getElementById('overviewPanel').hidden = false;
        document.getElementById('activityPanel').hidden = true;
        document.getElementById('overviewTab')?.classList.add('active');
        document.getElementById('activityTab')?.classList.remove('active');
    });
    document.getElementById('activityTab')?.addEventListener('click', () => {
        document.getElementById('activityPanel').hidden = false;
        document.getElementById('overviewPanel').hidden = true;
        document.getElementById('activityTab')?.classList.add('active');
        document.getElementById('overviewTab')?.classList.remove('active');
        if (window._selectedTaskId) loadActivityPageForTask(window._selectedTaskId);
    });

    // 3. Attach Sub-task Logic
    const todoInput = document.getElementById('todo-input');
    const addTodoBtn = document.getElementById('add-todo-btn');

    window.addTodoItem = async function() {
        const text = todoInput.value.trim();
        const taskId = window._selectedTaskId;

        if (!taskId) return alert("Please select a task from the sidebar first.");
        if (!text) return;

        const { error } = await supabaseClient
            .from('sub_tasks')
            .insert([{ 
                task_id: taskId, 
                title: text, 
                user_id: user?.id,
                status: 'todo'
            }]);

        if (!error) {
            todoInput.value = '';
            await fetchSubTasks(taskId);
        } else {
            console.error("Sub-task Error:", error.message);
        }
    };

    addTodoBtn?.addEventListener('click', window.addTodoItem);
    todoInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.addTodoItem();
    });

    document.getElementById('inProgressBtn')?.addEventListener('click', () => {
        window.location.href = '/inprogress';
    });
    document.getElementById('inReviewBtn')?.addEventListener('click', () => {
        window.location.href = '/inreview';
    });
    document.getElementById('doneBtn')?.addEventListener('click', () => {
        window.location.href = '/done';
    });

    fetchTasks();

    const taskSearchInput = document.getElementById('taskSearchInput');
    if (taskSearchInput) {
        taskSearchInput.addEventListener('input', renderFilteredTaskList);
    }
});

window.deleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task and all its sub-tasks?")) return;

    const { error } = await supabaseClient
        .from('tasks')
        .delete()
        .eq('id', taskId);

    if (error) {
        console.error("Error deleting task:", error.message);
        alert("Delete failed: " + error.message);
    } else {
        // If we deleted the currently selected task, reset the view
        if (window._selectedTaskId === taskId) {
            showNoTaskState();
            document.getElementById('todo-list').innerHTML = '';
        }
        await fetchTasks();
    }
};