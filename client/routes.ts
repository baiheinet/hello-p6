import databaseExplorerRoutes from './pages/settings/database-explorer/routes.js';
import { createAppClientConfig } from '@nocobase/app-client';
import { readAppClientRuntimeConfig } from '@nocobase/app-client/runtime';
import { includeNotificationTemplateRoutes } from './pages/settings/notification-routes.js';
import {
  BarChart3Icon,
  HammerIcon,
  Home,
  ListTreeIcon,
  PlusIcon,
  Rows3Icon,
} from 'lucide-react';
import settingsShellRoutes from './pages/settings/shell-routes.js';
import {
  defineAppRoutes,
  type AppClientRouteContribution,
  type AppClientRouteDefinition,
} from '@nocobase/app-client/plugins';

const appRoutes: AppClientRouteContribution = defineAppRoutes([
  {
    // Every signed-in user reaches the landing page. `authz: 'skip'` takes it out of page authorization entirely, so
    // no permission change can leave a user signed in with nowhere to land.
    authz: 'skip',
    auth: 'required',
    componentLoader: () => import('./pages/home/index.js'),
    name: 'home',
    navigation: { title: 'navigation.home', icon: Home },
    path: '/',
  },
  {
    // Declares no navigation, so the application decides where its entry goes (for example a sidebar item with an
    // unread badge). The plugin's API answers each person's own messages only, so the page needs no authorization of
    // its own.
    authz: 'skip',
    auth: 'required',
    componentLoader: () => import('./pages/inbox.js'),
    name: 'inbox',
    path: '/inbox',
  },
  {
    auth: 'guest',
    authz: 'skip',
    componentLoader: () => import('./pages/auth/login.js'),
    name: 'login',
    path: '/login',
  },
  {
    auth: 'guest',
    authz: 'skip',
    componentLoader: () => import('./pages/auth/register.js'),
    name: 'register',
    path: '/register',
  },
  {
    auth: 'guest',
    authz: 'skip',
    componentLoader: () => import('./pages/auth/forgot-password.js'),
    name: 'forgot-password',
    path: '/forgot-password',
  },
  {
    auth: 'guest',
    authz: 'skip',
    componentLoader: () => import('./pages/auth/reset-password.js'),
    name: 'reset-password',
    path: '/reset-password',
  },
  {
    // Where a command line's sign-in sends the person to approve it (`pages/auth/device.tsx`). Optional rather than
    // required so it renders outside the shell, like the sign-in pages; the page sends a guest to sign in and back.
    auth: 'optional',
    authz: 'skip',
    componentLoader: () => import('./pages/auth/device.js'),
    name: 'device',
    path: '/device',
  },
  // The resource-planning module: a business page whose endpoints check a
  // database.collection grant on `resourceProjects`, plus one settings page
  // gated on the trade-quota settings item.
  {
    name: 'resourcePlanning',
    path: '/resource-planning',
    auth: 'required',
    authz: { resource: { type: 'page', id: 'resourcePlanning' }, action: 'access' },
    navigation: { title: 'navigation.resourcePlanning', icon: HammerIcon },
    componentLoader: () => import('./pages/resource-planning/index.js'),
  },
  {
    name: 'resourceProjects',
    path: '/resource-projects',
    auth: 'required',
    authz: { resource: { type: 'page', id: 'resourceProjects' }, action: 'access' },
    navigation: {
      title: 'navigation.resourceProjects',
      description: 'navigation.resourceProjectsDescription',
      icon: ListTreeIcon,
    },
    componentLoader: () => import('./pages/resource-projects/index.js'),
    children: [
      {
        name: 'resourceProjectNew',
        path: 'new',
        authz: { resource: { type: 'page', id: 'resourceProjects' }, action: 'access' },
        presentation: { kind: 'dialog', title: 'resourcePlanning.newProjectTitle' },
        componentLoader: () => import('./pages/resource-projects/new.js'),
      },
      {
        name: 'resourceProjectCompare',
        path: 'compare',
        authz: { resource: { type: 'page', id: 'resourceProjects' }, action: 'access' },
        navigation: { title: 'navigation.resourceCompare', icon: Rows3Icon },
        componentLoader: () => import('./pages/resource-projects/compare.js'),
      },
      {
        name: 'resourceProjectDetail',
        path: ':projectId',
        authz: { resource: { type: 'page', id: 'resourceProjects' }, action: 'access' },
        componentLoader: () => import('./pages/resource-projects/detail.js'),
      },
    ],
  },
  {
    name: 'resourceTradeQuotas',
    path: '/resource-planning/trades',
    auth: 'required',
    authz: {
      resource: { type: 'settings', id: 'resourcePlanning.tradeQuotas' },
      action: 'read',
    },
    navigation: {
      title: 'navigation.resourceTradeQuotas',
      description: 'navigation.resourceTradeQuotasDescription',
      icon: BarChart3Icon,
    },
    componentLoader: () => import('./pages/resource-planning/trades.js'),
  },
]);

// The System settings shell stays registered: it shows only the modules a viewer may open, and none until the
// application or its plugins contribute one. Business administration such as `./pages/settings/routes.js` joins it.
export function createApplicationRoutes(
  rawConfig: unknown = readAppClientRuntimeConfig(),
): readonly AppClientRouteContribution[] {
  const config = createAppClientConfig({ rawConfig });
  return includeNotificationTemplateRoutes(
    [appRoutes, settingsShellRoutes, databaseExplorerRoutes],
    config.get<boolean>('notificationTemplates.invitationConfigured') === true,
  );
}

const routes: readonly AppClientRouteContribution[] = createApplicationRoutes();

export default routes;
