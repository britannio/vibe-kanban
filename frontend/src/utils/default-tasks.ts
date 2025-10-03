import { tasksApi } from '@/lib/api';
import type { CreateTask } from 'shared/types';
import { COMPANION_INSTALL_TASK_TITLE, COMPANION_INSTALL_TASK_DESCRIPTION } from './companion-install-task';

export interface DefaultTaskDefinition {
  title: string;
  description: string;
}

export const DEFAULT_TASKS: DefaultTaskDefinition[] = [
  {
    title: COMPANION_INSTALL_TASK_TITLE,
    description: COMPANION_INSTALL_TASK_DESCRIPTION,
  },
];

export async function createDefaultTasks(projectId: string): Promise<void> {
  try {
    // Create default tasks in parallel
    const createPromises = DEFAULT_TASKS.map(task => {
      const createData: CreateTask = {
        project_id: projectId,
        title: task.title,
        description: task.description,
        parent_task_attempt: null,
        image_ids: null,
      };
      return tasksApi.create(createData);
    });

    await Promise.all(createPromises);
  } catch (error) {
    console.error('Failed to create default tasks:', error);
    // Don't throw here to avoid breaking project creation
    // if default task creation fails
  }
}
