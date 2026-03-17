A beautiful, fully-featured Kanban-style task board where users can create tasks, drag them across board sections, and manage work visually.

## Solution overview & design decisions

- **Architecture:** Static frontend (HTML, CSS, JavaScript) with no build step. Backend is [Supabase](https://supabase.com) (Postgres + Auth + Storage), called directly from the browser via the Supabase JS client. This keeps the stack simple and deployable as a static site.

- **Kanban flow:** Tasks have sub-tasks that move through four stages: **To Do** → **In Progress** → **In Review** → **Done**. Each stage has its own page (Dashboard for To Do, plus InProgress, InReview, Done). Navigation and status updates use clean URLs (`/`, `/inprogress`, `/inreview`, `/done`) via Vercel rewrites.

- **Data model:** Tasks (title, overview, description, due date) and sub-tasks (per-task items with status). Labels, activities (audit log), file attachments, and chat-style comments are stored in Supabase and linked to tasks/sub-tasks. File uploads use Supabase Storage (e.g. a public `task-files` bucket).

- **Frontend structure:** One folder per section (`DashBoard`, `InProgress`, `InReview`, `Done`), each with its own `.html`, `.css`, and `.js`. Shared styles are reused via CSS imports (e.g. Done/InReview import InProgress CSS). Assets and API calls use root-relative paths so the app works when served from a subpath or with rewrites.

- **Responsive design:** Layout adapts to different screen sizes with breakpoints at 1280px, 1024px, and 768px. On smaller laptops the sidebar and cards tighten; at 768px the sidebar becomes a horizontal bar and content stacks vertically so the app is usable on tablets and small screens.

- **Hosting:** Designed to run on [Vercel](https://vercel.com) with the **Frontend** folder as the root. `vercel.json` defines rewrites so `/` and `/inprogress`, `/inreview`, `/done` serve the right HTML without exposing `.html` in the URL.

## Advanced features (and how they work)

### 4. Local Setup Instructions

- **Clone the repo:** `git clone`
- **Run locally:**
  - Download zip files
  - Go to “Frontend/DashBoard/dashboard.html” 
  - Open with Live Server

### 5. Advanced Features

- **File uploads:** In Progress, In Review, and Done pages support “Add files” per sub-task. Files are uploaded to Supabase Storage (e.g. `task-files` bucket), public URLs are stored in `task_files`, and an activity row is inserted so the feed shows “added this file” with a link to the file.
- **Activity feed:** Every meaningful action (file added and issue created) is written to an `activities` table with `subtask_id`, `action`, `details`, optional `link_url` and `issue_description`. The UI shows a chronological list so users can see what happened on a sub-task.
- **Per-subtask chat:** Each sub-task has a chat thread stored in `chat_messages` (`subtask_id`, user identifier, `message`, `created_at`). Messages are loaded when a sub-task is selected and new messages are inserted via Supabase. The app uses anonymous auth so “You” is shown for the current user without requiring sign-up.
- **Labels:** Tasks can have multiple labels (stored in `labels` and `task_labels`). Labels are shown as colored pills; color is derived from a hash of the label id so it stays consistent. Labels can be added/removed when creating or editing a task.
- **Due date indicators:** Tasks have a `due_date`; it’s shown on the task card (sidebar and main card) as “Due: <date>”. We do not highlight “due soon” or “overdue” with a colored badge or icon; that would require comparing `due_date` to today and applying a CSS class or icon.
- **Task search:** The Dashboard sidebar has a search field that filters the task list by title (client-side) so users can quickly find a task without scrolling.
- **Responsive layout:** CSS media queries at **1280px**, **1024px**, and **768px** adjust sidebar width, card sizes, and modal widths; at 768px the sidebar becomes a horizontal bar so the app works on smaller laptops.
- **Basic XSS mitigation:** User-generated text (titles, descriptions, activity details, chat messages) is escaped with an `escapeHtml` helper before being inserted into the DOM to reduce risk of script injection.

### 6. Tradeoffs & Future Improvements

- **No real-time updates:** Data is fetched on load and after mutations; there are no Supabase real-time subscriptions. With more time we’d add `channel().on('postgres_changes', ...)` for tasks, `sub_tasks`, and `chat_messages` so multiple tabs or users see changes immediately.
- **Supabase URL/key in frontend:** The Supabase project URL and anon key are in the JS files. The anon key is intended to be public and is restricted by Row Level Security (RLS), but the project is tied to one backend. With more time we’d move config into environment variables and inject them at build time or via a small config endpoint.
- **Duplicated logic across pages:** InProgress, InReview, and Done each have their own JS with similar patterns (fetch subtasks, activity, chat, file upload, drag-and-drop). We’d refactor shared logic into a common module (e.g. `supabase-client.js`, `activity.js`, `chat.js`) and have each page import it to reduce bugs and ease maintenance.
- **No automated tests:** There are no unit or E2E tests. We’d add tests for critical paths (create task, move sub-task, send chat message, file upload) and basic accessibility checks.
- **Anonymous-only auth:** The app uses `signInAnonymously()` so anyone can use it without an account. We’d add optional email/password or OAuth so users can have a stable identity, sync across devices, and (if desired) restrict access.
- **Error and offline handling:** Errors are mostly surfaced via `console.error` or `alert`. We’d add user-facing toasts or inline messages and, if needed, retry/offline handling for Supabase calls.

### 7. How to use Task Orbit

1. **Open the app** — Start on the **Dashboard** (To Do). You’ll see a sidebar with **My Task**, a search box, and an **+ Add Task** button.
2. **Create a task** — Click **+ Add Task**, fill in title, overview, description, due date, and optional labels, then click **Create Task**.
3. **Work with a task** — Click a task in the sidebar. The main card shows its details. In the sidebar card, use **Add a sub-task...** and the **+** button to add sub-tasks. Use the status buttons at the bottom (**In Progress**, **In Review**, **Done**) or **drag a sub-task** onto a status button to move it to that stage.
4. **Move between stages** — Use the footer links (**To Do**, **In Progress**, **In Review**, **Done**) to open each board. On **In Progress**, **In Review**, and **Done** you’ll see sub-tasks in that stage; select one to see its description, **Activity**, **Chat**, and **Add files**. You can drag sub-tasks onto the footer pills to change their status.
5. **Search** — On the Dashboard, type in the **Search task...** field to filter the task list by title.
6. **Labels** — When creating or editing a task, type a label name and press Enter to add it. Labels appear as colored pills on the task card.
7. **Activity & chat** — On In Progress / In Review / Done, select a sub-task to see its **Activity** timeline (files added, issues created, status changes) and **Chat**. Use the chat input to send messages; they’re stored per sub-task.
8. **Files & issues** — From the sub-task card menu (**⋯**), use **Add files** to upload attachments or **Create issue** to log an issue; both appear in the Activity feed.
