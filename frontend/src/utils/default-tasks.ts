import {
  COMPANION_INSTALL_TASK_TITLE,
  COMPANION_INSTALL_TASK_DESCRIPTION,
} from './companion-install-task';

export interface DefaultTask {
  id: string;
  titleKey: string;
  descriptionKey: string;
  title: string;
  description: string;
}

export const DEFAULT_TASKS: DefaultTask[] = [
  {
    id: 'companion-install',
    titleKey: 'setup.defaultTasks.companionInstall.title',
    descriptionKey: 'setup.defaultTasks.companionInstall.description',
    title: COMPANION_INSTALL_TASK_TITLE,
    description: COMPANION_INSTALL_TASK_DESCRIPTION,
  },
  // Future tasks can be added here:
  // {
  //   id: 'setup-tests',
  //   titleKey: 'setup.defaultTasks.setupTests.title',
  //   descriptionKey: 'setup.defaultTasks.setupTests.description',
  //   title: 'Set up testing framework',
  //   description: '...',
  // },
];
