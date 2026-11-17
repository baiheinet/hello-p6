# Home workbench

The home page (`client/pages/home/`) is this application's construction resource workbench. It is not the template's starting page. Its copy is the application's own `home` namespace in `client/locales/en-US.ts` and `zh-CN.ts`, spread after `./system/`, so it overrides the template's `home` copy; the template copy stays in `./system/` for a template upgrade to replace.

## What replaced the template content, and why

The template's home explained how to develop the application by asking a coding agent and listed the Foundation plugin's built-in capabilities. That is developer onboarding, not the day-to-day work of this application, so both were removed from the page:

- the agent introduction, its steps, its sample request and the clipboard button (`use-copy.ts` was deleted);
- the capability guide cards, their icons and the "view all" link built from `createCapabilityCatalog()`.

The Foundation capability guide remains a registered route with its own permission (`CAPABILITY_GUIDE_ACCESS`) and its own tests; only the home-page presentation was removed. Do not reintroduce a capability discovery link on the home page. If a template upgrade brings the old home page back, keep this workbench and merge only genuinely shared improvements.

## What the page shows

- **Overview** — total projects, projects in progress, and the three most recently updated projects. It reads `GET resourceProjects`, the same endpoint and list the projects page shows, so the figures cannot drift from it. "In progress" means `startDate <= today <= endDate` in the viewer's time zone; an empty date never counts. The pure derivation is `overview.ts`, and the loading hook is `use-project-overview.ts`. The collection has no automatic timestamps, so `server/routes/resource-planning.ts` stamps `createdAt` on create and `updatedAt` on every project write; records created before that stamp fall back to `createdAt` and then the name for a stable order, and show no date.
- **Quick actions** — new project, project list, compare projects and trade labor quotas, each a route link.

## Permissions

The route keeps `authz: 'skip'` so every signed-in user has a landing page. Each business section checks the same grant its route enforces:

- projects (list, new, compare): page `resourceProjects`, action `access`;
- trade quotas: settings `resourcePlanning.tradeQuotas`, action `read`.

Overview data is requested only after the projects page grant resolves as allowed. The endpoint still enforces its data permission: a denial shows the "data unavailable" line instead of failing the page. No denied destination is rendered as a link, and a viewer with neither grant sees a "no business modules" empty state. Do not replace these checks with a role name or a shell-wide flag.

The administrator's System settings and the shell are untouched by this page.
