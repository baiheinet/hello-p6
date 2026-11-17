import type { Application } from '@nocobase/app-server/application';
import type { AppRouteContribution } from '@nocobase/app-server/router';

import resourcePlanningRoutes from './resource-planning.js';

const routes: readonly AppRouteContribution<Application>[] = [
  resourcePlanningRoutes,
];

export default routes;
