import fileUi from '../extensions/nocobase-file-component-ui/locales/en-US.js';
import type { LocaleResource } from '@nocobase/i18n';

import systemEnUS from './system/en-US.js';

const enUS = {
  // The template's own copy: the shell, the sign-in pages, shared components and the homepage. Keep it in
  // `./system/` so a template upgrade can replace it without touching the application's copy below.
  ...systemEnUS,
  ...fileUi,
  navigation: {
    ...systemEnUS.navigation,
    resourcePlanning: 'Resource planning',
    resourceProjects: 'Projects',
    resourceProjectsDescription: 'Output plan, S curve and labor demand.',
    resourceCompare: 'Compare projects',
    resourceTradeQuotas: 'Trade labor quotas',
    resourceTradeQuotasDescription: 'Shared workforce per unit of quantity.',
  },
  resourcePlanning: {
    title: 'Resource planning',
    description:
      'Plan the quantity per period, the cumulative S curve and the labor demand for each construction project.',
    projectsEntry:
      'Create and edit construction projects and their output plan.',
    newProject: 'New project',
    newProjectTitle: 'New project',
    newProjectDescription:
      'The total quantity is split evenly across the periods when the project is created.',
    create: 'Create',
    saving: 'Saving…',
    cancel: 'Cancel',
    save: 'Save',
    projectName: 'Name',
    totalQuantity: 'Total quantity',
    periodCount: 'Periods',
    startDate: 'Start',
    endDate: 'End',
    period: 'Period',
    planned: 'Planned output',
    cumulative: 'Cumulative',
    sCurve: 'S curve',
    schedule: 'Output per period',
    labor: 'Labor demand',
    trade: 'Trade',
    quota: 'Workforce per unit',
    adjust: 'Adjust',
    apply: 'Apply',
    compare: 'Compare projects',
    compareDescription:
      'Pick several projects to compare their output, S curve and labor demand in one view.',
    compareNeedsSelection:
      'Select at least one project to compare; the output and S curve are drawn per project.',
    outputComparison: 'Output per period',
    tables: 'Tables',
    tradeQuotas: 'Trade labor quotas',
    tradeQuotasDescription:
      'The shared workforce per unit of quantity. A project’s labor demand is its per-period output times this table.',
    addTrade: 'Add trade',
    manageQuotas: 'Manage quotas',
    loading: 'Loading…',
    noTrades:
      'No trades yet. Add a trade and its quota to see labor demand per period.',
    emptyProjects: 'No projects yet. Create one to plan its output and labor.',
    project: 'Project',
    projectDescription: '{{total}} across {{periods}} periods',
    projectCount_one: '{{count}} project',
    projectCount_other: '{{count}} projects',
    actionsFor: 'Actions for {{name}}',
    actionOpen: 'Open',
    actionScurve: 'S curve',
    actionLabor: 'Labor demand',
    form: {
      name: 'Project name',
      nameRequired: 'A project needs a name.',
      totalQuantity: 'Total quantity',
      quantityRequired: 'The total quantity must be zero or more.',
      periodCount: 'Periods',
      periodsRequired: 'The project needs at least one period.',
      datesRequired: 'Pick the start and the end of the schedule.',
      endDateBeforeStart: 'The end date comes before the start.',
      newTrade: 'Trade',
    },
    error: {
      load: 'The data could not be loaded. Check the connection and try again.',
    },
  },
};

/**
 * The shape every locale of this application follows, derived from the English wording above.
 *
 * Anything a plugin does not translate falls back to this namespace, so a term defined here is reused everywhere
 * without each plugin repeating it.
 */
export type AppResource = LocaleResource<typeof enUS>;

export default enUS;
