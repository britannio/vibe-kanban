# Implementation Plan: New Project Setup Flow

## Overview
Create an embedded setup wizard that appears when a new project has no tasks, guiding users through configuring project settings and optionally creating default tasks from templates.

## Requirements
1. Show setup wizard when project has no tasks
2. Guide user through configuring:
   - Setup script
   - Dev server script  
   - Cleanup script
   - Copy files
3. Allow user to select from task templates (global + project-specific)
4. Reminder about "C" keyboard shortcut to create tasks
5. Allow skipping the setup
6. Follow existing design patterns

## Component Architecture

### 1. ProjectSetupWizard Component
**Location:** `frontend/src/components/projects/ProjectSetupWizard.tsx`

**Props:**
```typescript
interface ProjectSetupWizardProps {
  project: Project;
  onComplete: () => void;
  onSkip: () => void;
}
```

**State Management:**
- Multi-step wizard (3 steps)
- Form state for scripts and copy files
- Selected templates state
- Loading/error states

**Steps:**
1. **Welcome & Scripts Configuration**
   - Welcome message
   - Configure setup_script, dev_script, cleanup_script, copy_files
   - Reuse form components from project-form-fields.tsx
   
2. **Task Templates Selection**
   - Fetch global + project templates
   - Display templates as selectable cards
   - Allow multiple selection
   - Show template details (title, description)
   
3. **Completion**
   - Summary of what was configured
   - Keyboard shortcut reminder (Press "C" to create tasks)
   - "Finish Setup" button

### 2. Integration with ProjectTasks Page
**Location:** `frontend/src/pages/project-tasks.tsx`

**Changes:**
- Add state to track if setup is complete
- Modify empty state logic (line 503):
  ```typescript
  const shouldShowSetup = tasks.length === 0 && !isSetupComplete;
  ```
- Render `ProjectSetupWizard` instead of empty state card when `shouldShowSetup` is true
- Store setup completion in localStorage or project metadata

### 3. Helper Components

**TemplateSelectionCard Component**
- Display template name, title, description
- Checkbox for selection
- Visual styling matching project-form-fields cards

**SetupStepIndicator Component**
- Show current step (1/3, 2/3, 3/3)
- Progress indicator

## Data Flow

### 1. Fetching Data
- Project data: Already available via useProject() context
- Templates: Use templatesApi.listGlobal() and templatesApi.listByProject(projectId)

### 2. Updating Project Settings
- Use updateProject mutation from useProjectMutations
- Update all scripts and copy_files in one API call

### 3. Creating Tasks from Templates
- For each selected template, call tasksApi.create()
- Use template's title and description
- Set status to 'todo'
- Show loading state during creation

### 4. Completion Tracking
- Store in localStorage: `project-setup-complete-${projectId}`
- Or add flag to project metadata (if backend supports it)

## Implementation Steps

### Phase 1: Core Wizard Component
1. Create ProjectSetupWizard.tsx with basic structure
2. Implement step navigation (Next, Back, Skip buttons)
3. Add step indicator component

### Phase 2: Step 1 - Scripts Configuration
1. Extract/reuse script input components from project-form-fields
2. Add form validation
3. Wire up to project update mutation

### Phase 3: Step 2 - Template Selection
1. Create TemplateSelectionCard component
2. Fetch and display templates
3. Implement multi-select functionality
4. Show empty state if no templates exist

### Phase 4: Step 3 - Completion
1. Create completion screen with summary
2. Add keyboard shortcut reminder with visual emphasis
3. Implement "Finish" button that creates tasks and completes setup

### Phase 5: Integration
1. Modify project-tasks.tsx to detect empty + unconfigured state
2. Show wizard instead of simple empty state
3. Handle completion callback to show Kanban board
4. Add skip functionality

### Phase 6: Polish
1. Add loading states
2. Add error handling
3. Add animations/transitions between steps
4. Test keyboard navigation
5. Ensure responsive design

## UI/UX Considerations

### Design Consistency
- Use Card components for main container
- Match button styles from existing dialogs
- Use same color scheme as project-form-fields
- Follow spacing/padding patterns from existing forms

### User Guidance
- Clear step titles and descriptions
- Helper text for each script type
- Template preview/details
- Visual feedback for selections

### Accessibility
- Keyboard navigation between steps
- Focus management
- ARIA labels
- Screen reader friendly

### Responsive Design
- Mobile-friendly layout
- Scrollable template list
- Collapsible sections if needed

## Edge Cases

1. **No templates available**: Show message, allow proceeding to step 3
2. **API errors during setup**: Show error, allow retry or skip
3. **User navigates away mid-setup**: Save progress in localStorage
4. **Project already has scripts but no tasks**: Don't show wizard (skip script config)
5. **Templates fail to create**: Show which ones failed, allow retry

## Testing Checklist

- [ ] Wizard appears on new project with no tasks
- [ ] Scripts can be configured and saved
- [ ] Templates load correctly
- [ ] Multiple templates can be selected
- [ ] Tasks created from selected templates
- [ ] Skip button works and doesn't show wizard again
- [ ] Completion shows Kanban board
- [ ] Keyboard shortcut reminder is visible
- [ ] Error states display correctly
- [ ] Responsive on mobile/tablet
- [ ] Keyboard navigation works
- [ ] Works with empty template list
