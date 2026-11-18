import { useRouteAccess, useRouteTree } from '../../routing/route-context.js';
import { routeKey } from '../../routing/route-navigation.js';

/**
 * Whether the "Compare projects" entry may show on the pages that host it (the list and a project's detail). The
 * compare route is registered under the `resourceProjects` page, so it carries the same access as the list and
 * detail pages that host the entry. A viewer who may not open the module page sees no entry, and no dead link.
 * While the permission check is still running the entry is hidden rather than risked as a dead link.
 */
export function useCompareEntryVisible(): boolean {
  const { denied, loading } = useRouteAccess();
  const routes = useRouteTree();
  if (loading) return false;
  const compare = routes
    .find((route) => route.name === 'resourceProjects')
    ?.children?.find((child) => child.name === 'resourceProjectCompare');
  if (!compare) return false;
  return !denied.has(routeKey(compare));
}
