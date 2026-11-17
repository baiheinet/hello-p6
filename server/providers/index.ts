import NotificationManagementProvider from './notification-management.js';
import ResourcePlanningProvider from './resource-planning.js';
import SubmissionProvider from './submission.js';
import type { ApplicationServiceProviderConstructor } from '@nocobase/app-server/application';

const serviceProviders: readonly ApplicationServiceProviderConstructor[] = [
  SubmissionProvider,
  NotificationManagementProvider,
  ResourcePlanningProvider,
];

export default serviceProviders;
