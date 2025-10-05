# Research: New Project Setup Flow

## Current State

### Kanban Board (project-tasks.tsx)
- Shows empty state when `tasks.length === 0` (line 503)
- Displays a simple Card with "No tasks" message and "Create First Task" button
- Uses filtered/grouped tasks for display and search

### Project Settings
- Stored in Project model: `setup_script`, `dev_script`, `cleanup_script`, `copy_files`
- Configured via ProjectFormDialog (create/edit mode)
- Scripts run at specific lifecycle points:
  - Setup: After worktree creation, before coding agent
  - Dev: Can be run from task attempts
  - Cleanup: After agent execution (only if changes made)

### Task Templates
- Already implemented in TaskTemplateManager.tsx
- Can be global (project_id = null) or project-specific
- Stored with: id, project_id, title, description, template_name
- API endpoints: listGlobal(), listByProject(projectId)
- Used in ProjectFormDialog under "Task Templates" tab (edit mode only)

### Design Patterns
- Uses shadcn/ui components (Card, Button, Input, Label, etc.)
- Nice Modal React for dialogs (@ebay/nice-modal-react)
- Form fields reuse components from project-form-fields.tsx
- Two-stage flows: selection cards → detailed forms

## Implementation Plan

### Component Structure
1. **ProjectSetupWizard.tsx** - Main wizard component
   - Step 1: Configure scripts (setup, dev, cleanup, copy files)
   - Step 2: Select default tasks from templates
   - Step 3: Complete setup and show board

2. **Integration Points**
   - Modify project-tasks.tsx to show wizard when:
     - `tasks.length === 0` AND 
     - Project scripts not configured (all null/empty)
   - Once setup complete, redirect to normal Kanban view

### UI Flow
1. **Empty Project Detection**
   - Check if project has no tasks
   - Check if project scripts are not configured
   
2. **Setup Wizard Steps**
   - Welcome message explaining the setup
   - Script configuration (reuse components from project-form-fields)
   - Task template selection (show available templates, allow multiple selection)
   - Completion with reminder about "C" keyboard shortcut

3. **Skip Option**
   - Allow users to skip setup and go straight to empty board
   - Store preference to not show wizard again for this project

### API Considerations
- Update project settings via existing updateProject mutation
- Create tasks from templates using tasksApi.create()
- Fetch available templates using templatesApi.listGlobal() and listByProject()

## Key Design Decisions
1. Show wizard only when BOTH conditions are met (no tasks + no scripts)
2. Allow skipping to maintain flexibility
3. Embed wizard in main page, not a modal (better UX for first-time setup)
4. Reuse existing form components for consistency
5. Show keyboard shortcut reminder at completion
