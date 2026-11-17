import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import type { Application } from '@nocobase/app-server/application';
import { ServiceProvider } from '@nocobase/service-provider';

/**
 * Registers the application's resource-planning permissions: the two data
 * collections and the trade-quota settings item. The item's checks happen in
 * the routes that edit the shared quota table; the pages and the CRUD of
 * projects and trade names follow their own grants.
 */
export default class ResourcePlanningProvider extends ServiceProvider<Application> {
  readonly name = 'app/resource-planning';
  override boot(): Promise<void> {
    const authz = this.app.container.resolve(authorizationToken);
    authz.database.collections.add({
      name: 'resourceProjects',
      title: 'Resource projects',
    });
    authz.database.collections.add({
      name: 'laborTrades',
      title: 'Labor trades',
    });
    authz.settings.add({
      id: 'resourcePlanning.tradeQuotas',
      title: 'Trade labor quotas',
      actions: [
        { name: 'read', title: 'Read' },
        { name: 'update', title: 'Update' },
      ],
    });
    authz.ui.sections.add({
      name: 'resource-planning',
      title: 'Resource planning',
      parent: 'administration',
    });
    authz.ui.place(
      { type: 'settings', id: 'resourcePlanning.tradeQuotas' },
      { section: 'resource-planning' },
    );
    return Promise.resolve();
  }
}
