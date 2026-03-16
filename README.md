# TaskOrbit
A beautiful, fully-featured Kanban-style task board where users can create tasks, drag them across board sections, and manage work visually.

## Supabase Storage (Add files)

Bucket **task-files** is created and public. If uploads fail, add Storage policies: in Supabase go to **SQL Editor**, run the **Storage policies** block at the bottom of `supabase_schema.sql` (the `CREATE POLICY` lines for `storage.objects` and `task-files`). That allows the app to upload and read files.
