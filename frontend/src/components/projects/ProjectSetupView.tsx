import {
  KanbanBoard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from '@/components/ui/shadcn-io/kanban';
import { statusBoardColors, statusLabels } from '@/utils/status-labels';
import { ProjectSetupWizard } from './ProjectSetupWizard';
import type { Project } from 'shared/types';

interface ProjectSetupViewProps {
  project: Project;
  onCreateTask: () => void;
}

export function ProjectSetupView({
  project,
  onCreateTask,
}: ProjectSetupViewProps) {
  return (
    <div className="flex h-full gap-6">
      {/* Single TODO column */}
      <div className="flex-shrink-0 w-80">
        <KanbanProvider onDragEnd={() => {}}>
          <KanbanBoard id="todo">
            <KanbanHeader
              name={statusLabels.todo}
              color={statusBoardColors.todo}
              onAddTask={onCreateTask}
            />
            <KanbanCards children={null} />
          </KanbanBoard>
        </KanbanProvider>
      </div>
      {/* Setup wizard on the right */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <ProjectSetupWizard project={project} />
      </div>
    </div>
  );
}
