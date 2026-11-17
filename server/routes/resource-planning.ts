import {
  ApiError,
  apiErrorResponse,
  apiErrorResponses,
  apiValidator,
  dataResponse,
  defineApiRoutes,
  describeRoute,
  emptyResponse,
  listResponse,
  type AppApiRouteContribution,
} from '@nocobase/app-server';
import {
  authorizationToken,
  type AuthorizationEnv,
} from '@nocobase/app-plugin-authorization/server';
import { authenticationToken } from '@nocobase/app-plugin-authentication';
import { idGeneratorToken } from '@nocobase/app-server/id-generator';
import { databaseManagerToken, type Repository } from '@nocobase/db';
import { type Application } from '@nocobase/app-server';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

import {
  resourcePlanningRepositories,
  evenSchedule,
  rebalance,
  cumulativeSeries,
  laborDemand,
  periodLabel,
  type ResourceProject,
  type LaborTrade,
} from '../services/resource-planning.js';

/** A project's row plus the derived S curve and labor demand the pages show. */
/** The compare endpoint's rows: a project's derived view, without the raw row's fields. */
export interface CompareRow {
  readonly id: string;
  readonly name: string;
  readonly totalQuantity: number;
  readonly periodCount: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly schedule: readonly number[];
  readonly cumulative: readonly number[];
  readonly labor: readonly {
    readonly trade: string;
    readonly periods: readonly number[];
  }[];
}

export const CompareRowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    totalQuantity: z.number(),
    periodCount: z.number(),
    startDate: z.string(),
    endDate: z.string(),
    schedule: z.array(z.number()),
    cumulative: z.array(z.number()),
    labor: z.array(
      z.object({ trade: z.string(), periods: z.array(z.number()) }),
    ),
  })
  .meta({ ref: 'ResourcePlanningCompareRow' });

export const CompareProjectsResponse = z
  .object({
    projects: z.array(CompareRowSchema),
    /** One label per project, in the order of `projects`. */
    labels: z.array(z.string()),
  })
  .meta({ ref: 'ResourcePlanningCompare' });

export const ResourceProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    totalQuantity: z.number(),
    periodCount: z.number(),
    startDate: z.string(),
    endDate: z.string(),
    schedule: z.array(z.number()),
    laborOverrides: z.record(z.string(), z.union([z.number(), z.null()])),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .meta({ ref: 'ResourceProject' });

export type ResourceProjectInput = z.infer<typeof ResourceProjectSchema>;
export type { ResourceProject, LaborTrade };

export const CreateResourceProjectInput = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .meta({ description: 'The project name.' }),
  totalQuantity: z
    .number()
    .nonnegative()
    .meta({ description: 'The total quantity to plan across the periods.' }),
  periodCount: z
    .number()
    .int()
    .min(1)
    .max(1200)
    .meta({ description: 'The number of periods the total is split across.' }),
  startDate: z.iso
    .date()
    .meta({ description: 'The first period, as a calendar date.' }),
  endDate: z.iso
    .date()
    .meta({ description: 'The last period, as a calendar date.' }),
});

export const UpdateResourceProjectInput = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .meta({ description: 'The new project name.' }),
  totalQuantity: z
    .number()
    .nonnegative()
    .optional()
    .meta({ description: 'The new total quantity; the schedule is re-split.' }),
  periodCount: z.number().int().min(1).max(1200).optional().meta({
    description: 'The new number of periods; the schedule is re-split.',
  }),
  startDate: z.iso
    .date()
    .optional()
    .meta({ description: 'The new first-period date.' }),
  endDate: z.iso
    .date()
    .optional()
    .meta({ description: 'The new last-period date.' }),
});

export const ResourceProjectParams = z.object({ projectId: z.string() });

export const AdjustPeriodInput = z.strictObject({
  index: z
    .number()
    .int()
    .min(0)
    .meta({ description: 'The period the value is pinned to, from 0.' }),
  value: z
    .number()
    .nonnegative()
    .meta({ description: 'The quantity to pin that period to.' }),
});

export const OverrideLaborInput = z.strictObject({
  trade: z
    .string()
    .trim()
    .min(1)
    .meta({ description: 'The trade name the override applies to.' }),
  index: z
    .number()
    .int()
    .min(0)
    .meta({ description: 'The period the override applies to, from 0.' }),
  value: z.number().nonnegative().nullable().meta({
    description:
      'The headcount to pin; null clears the override and falls back to the quota.',
  }),
});

export const ResourceProjectViewSchema = ResourceProjectSchema.extend({
  cumulative: z.array(z.number()),
  labor: z.array(
    z.object({
      trade: z.string(),
      periods: z.array(z.number()),
    }),
  ),
}).meta({ ref: 'ResourceProjectView' });

export const CompareProjectsQuery = z.object({
  ids: z
    .string()
    .min(1)
    .max(2000)
    .meta({ description: 'Comma-separated project ids, up to 50 compared.' }),
});

export const LaborTradeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    unitQuota: z.number(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .meta({ ref: 'LaborTrade' });

export const CreateLaborTradeInput = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .meta({ description: 'The trade name.' }),
  unitQuota: z
    .number()
    .nonnegative()
    .meta({ description: 'Workforce per unit of quantity, in people.' }),
});

export const UpdateLaborTradeInput = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .meta({ description: 'The new trade name.' }),
  unitQuota: z
    .number()
    .nonnegative()
    .optional()
    .meta({ description: 'The new quota.' }),
});

export const LaborTradeParams = z.object({ tradeId: z.string() });

/**
 * The resource-planning API: project CRUD, per-period adjustment, the S curve
 * and labor demand, the shared trade quotas, and the multi-project compare.
 * Every route authenticates, then checks its own resource's permission; an
 * identity that is not unrestricted needs the matching grant, so an
 * unprivileged caller gets 403 before any input is validated.
 */
export const resourcePlanningRoutes: AppApiRouteContribution<Application> =
  defineApiRoutes((app) => {
    const router = new Hono();
    const auth = app.container.resolve(authenticationToken);
    const authorization = app.container.resolve(authorizationToken);
    const database = app.container.resolve(databaseManagerToken);
    const idGenerator = app.container.resolve(idGeneratorToken);

    const { projects, trades } = resourcePlanningRepositories(database);

    /**
     * Resolves the project repository the caller's decision allows. A
     * `deny` is 403; a `permit` without conditions is the plain repository;
     * a `conditional` (a data scope, or the unrestricted root's full-row
     * policy) binds a policy whose named operation is open across the
     * decision's rows and whose other operations stay closed, so the rows
     * and the write fields the decision names are the whole of what the
     * caller may touch.
     */
    async function projectFor(
      c: Context<AuthorizationEnv>,
      action: 'read' | 'create' | 'update' | 'delete',
    ): Promise<Repository<ResourceProject>> {
      const ref = {
        type: 'database.collection',
        id: 'resourceProjects',
      } as const;
      const decision = await c
        .get('authz')
        .authorize({ resource: ref, action });
      if (decision.effect === 'deny')
        throw new ApiError({
          status: 'PERMISSION_DENIED',
          reason: 'PROJECT_DENIED',
          domain: 'resourcePlanning',
          message: `The caller may not ${action} a resource project.`,
        });
      if (decision.effect === 'permit') return projects;
      const conditions = (decision.conditions ?? {}) as {
        type?: string;
        scope?: unknown;
        fields?: unknown;
        relations?: unknown;
      };
      if (conditions.type !== 'database')
        throw new ApiError({
          status: 'PERMISSION_DENIED',
          reason: 'PROJECT_DENIED',
          domain: 'resourcePlanning',
          message: `The caller may not ${action} a resource project.`,
        });
      // The decision's conditions carry the operation's row scope (a data
      // scope, or `true` for the unrestricted root). The named operation is
      // open across those rows, and so is a read (the detail and list views
      // of a granted record need it). The write operations stay closed:
      // an action that does not grant them refuses the write, not the
      // record itself.
      const scope = conditions.scope;
      const fields =
        conditions.fields &&
        (Array.isArray(conditions.fields) ||
          typeof conditions.fields === 'string')
          ? conditions.fields
          : undefined;
      // A read node without `fields` (the unrestricted root's policy, or a
      // data-scope check that names only rows) leaves every field
      // readable; one that names fields is an allowlist.
      const readNode: unknown = fields ? { scope, fields } : { scope };
      const node = (nodeFields?: unknown): unknown =>
        nodeFields ? { scope, fields: nodeFields } : { scope };
      const policy = {
        read: readNode,
        create: action === 'create' ? node(fields) : false,
        update: action === 'update' ? node(fields) : false,
        delete: action === 'delete' ? node() : false,
      } as never;
      return projects.withPolicy(
        policy,
      ) as unknown as Repository<ResourceProject>;
    }

    async function projectView(record: ResourceProject) {
      const tradeList = await trades.findMany();
      const laborByTrade = laborDemand(record, tradeList).reduce<
        Record<string, number[]>
      >((acc, row) => {
        (acc[row.trade] ??= []).push(row.value);
        return acc;
      }, {});
      return {
        ...record,
        cumulative: cumulativeSeries(record.schedule ?? []),
        labor: Object.entries(laborByTrade).map(([trade, periods]) => ({
          trade,
          periods,
        })),
      };
    }

    // --- Projects ---

    router.get(
      '/resourceProjects',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'List resource projects',
        operationId: 'listResourceProjects',
        responses: {
          '200': listResponse(ResourceProjectSchema),
          ...apiErrorResponses,
        },
      }),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const repo = await projectFor(c, 'read');
        const rows = await repo.findMany();
        return c.json({ data: rows, meta: { total: rows.length } });
      },
    );

    // --- Multi-project compare ---

    router.get(
      '/resourceProjects/compare',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'Compare several projects side by side',
        operationId: 'compareResourceProjects',
        responses: {
          '200': dataResponse(CompareProjectsResponse),
          ...apiErrorResponses,
        },
      }),
      apiValidator('query', CompareProjectsQuery),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const { ids } = context.req.valid('query');
        const wanted = ids
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (wanted.length === 0 || wanted.length > 50)
          throw new ApiError({
            status: 'INVALID_ARGUMENT',
            reason: 'COMPARE_LIMIT',
            domain: 'resourcePlanning',
            message: 'Compare between 1 and 50 projects by their ids.',
          });
        const repo = await projectFor(c, 'read');
        const records = await Promise.all(
          wanted.map((id) => repo.findOne({ filter: { id } })),
        );
        const found = records.filter(
          (r): r is ResourceProject => r !== undefined,
        );
        const views = await Promise.all(found.map((r) => projectView(r)));
        return c.json({
          data: {
            projects: views,
            labels: found.map((r) => periodLabel(0, r.startDate)),
          },
        });
      },
    );

    // --- Project detail ---

    router.get(
      '/resourceProjects/:projectId',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'Get a resource project',
        operationId: 'getResourceProject',
        responses: {
          '200': dataResponse(ResourceProjectViewSchema),
          '404': apiErrorResponse(404),
          ...apiErrorResponses,
        },
      }),
      apiValidator('param', ResourceProjectParams),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const { projectId } = context.req.valid('param');
        const repo = await projectFor(c, 'read');
        const record = await repo.findOne({ filter: { id: projectId } });
        if (!record)
          throw new ApiError({
            status: 'NOT_FOUND',
            reason: 'PROJECT_NOT_FOUND',
            domain: 'resourcePlanning',
            message: `Project ${projectId} was not found.`,
          });
        const view = await projectView(record);
        return c.json({ data: view });
      },
    );

    router.post(
      '/resourceProjects',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'Create a resource project',
        operationId: 'createResourceProject',
        responses: {
          '201': dataResponse(ResourceProjectSchema),
          ...apiErrorResponses,
        },
      }),
      apiValidator('json', CreateResourceProjectInput),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const input = context.req.valid('json');
        const repo = await projectFor(c, 'create');
        const { totalQuantity, periodCount, startDate, endDate, name } = input;
        const id = idGenerator.generateString();
        const result = await repo.createOne({
          values: {
            id,
            name,
            totalQuantity,
            periodCount,
            startDate,
            endDate,
            schedule: evenSchedule(totalQuantity, periodCount),
          },
        });
        // The record's own `id` travels through the create's return
        // selection (the policy's output scope is the operation's scope),
        // so carry it from the id the write named when it is missing.
        return c.json(
          {
            data: { ...result.record, id: (result.record?.id as string) ?? id },
          },
          201,
        );
      },
    );

    router.patch(
      '/resourceProjects/:projectId',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'Update a resource project',
        operationId: 'updateResourceProject',
        responses: {
          '200': dataResponse(ResourceProjectSchema),
          '404': apiErrorResponse(404),
          ...apiErrorResponses,
        },
      }),
      apiValidator('param', ResourceProjectParams),
      apiValidator('json', UpdateResourceProjectInput),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const { projectId } = context.req.valid('param');
        const input = context.req.valid('json');
        const repo = await projectFor(c, 'update');
        const record = await repo.findOne({ filter: { id: projectId } });
        if (!record)
          throw new ApiError({
            status: 'NOT_FOUND',
            reason: 'PROJECT_NOT_FOUND',
            domain: 'resourcePlanning',
            message: `Project ${projectId} was not found.`,
          });
        const { totalQuantity, periodCount } = {
          totalQuantity: input.totalQuantity ?? record.totalQuantity,
          periodCount: input.periodCount ?? record.periodCount,
        };
        const values: Record<string, unknown> = {};
        if (input.name !== undefined) values.name = input.name;
        if (input.startDate !== undefined) values.startDate = input.startDate;
        if (input.endDate !== undefined) values.endDate = input.endDate;
        if (input.totalQuantity !== undefined)
          values.totalQuantity = totalQuantity;
        if (input.periodCount !== undefined) values.periodCount = periodCount;
        if (
          input.totalQuantity !== undefined ||
          input.periodCount !== undefined
        )
          values.schedule = evenSchedule(totalQuantity, periodCount);
        const result = await repo.updateOne({
          filter: { id: projectId },
          values,
        });
        return c.json({ data: result.record });
      },
    );

    router.delete(
      '/resourceProjects/:projectId',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'Delete a resource project',
        operationId: 'deleteResourceProject',
        responses: {
          '204': emptyResponse(),
          '404': apiErrorResponse(404),
          ...apiErrorResponses,
        },
      }),
      apiValidator('param', ResourceProjectParams),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const { projectId } = context.req.valid('param');
        const repo = await projectFor(c, 'delete');
        await repo.deleteOne({ filter: { id: projectId } });
        return c.body(null, 204);
      },
    );

    router.post(
      '/resourceProjects/:projectId/adjustPeriod',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'Pin one period and rebalance the rest',
        operationId: 'adjustResourceProjectPeriod',
        responses: {
          '200': dataResponse(ResourceProjectSchema),
          '404': apiErrorResponse(404),
          ...apiErrorResponses,
        },
      }),
      apiValidator('param', ResourceProjectParams),
      apiValidator('json', AdjustPeriodInput),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const { projectId } = context.req.valid('param');
        const input = context.req.valid('json');
        const repo = await projectFor(c, 'update');
        const record = await repo.findOne({ filter: { id: projectId } });
        if (!record)
          throw new ApiError({
            status: 'NOT_FOUND',
            reason: 'PROJECT_NOT_FOUND',
            domain: 'resourcePlanning',
            message: `Project ${projectId} was not found.`,
          });
        const schedule = record.schedule ?? [];
        const next = rebalance(schedule, input.index, input.value);
        const result = await repo.updateOne({
          filter: { id: projectId },
          values: { schedule: next },
        });
        return c.json({ data: result.record });
      },
    );

    router.post(
      '/resourceProjects/:projectId/overrideLabor',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'Set or clear a per-period labor override',
        operationId: 'overrideResourceProjectLabor',
        responses: {
          '200': dataResponse(ResourceProjectSchema),
          '404': apiErrorResponse(404),
          ...apiErrorResponses,
        },
      }),
      apiValidator('param', ResourceProjectParams),
      apiValidator('json', OverrideLaborInput),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const { projectId } = context.req.valid('param');
        const input = context.req.valid('json');
        const repo = await projectFor(c, 'update');
        const record = await repo.findOne({ filter: { id: projectId } });
        if (!record)
          throw new ApiError({
            status: 'NOT_FOUND',
            reason: 'PROJECT_NOT_FOUND',
            domain: 'resourcePlanning',
            message: `Project ${projectId} was not found.`,
          });
        if (input.index >= (record.schedule ?? []).length)
          throw new ApiError({
            status: 'INVALID_ARGUMENT',
            reason: 'PERIOD_OUT_OF_RANGE',
            domain: 'resourcePlanning',
            message: `Period ${input.index} is not in the schedule.`,
          });
        const overrides: Record<
          string,
          Record<string, number | null>
        > = record.laborOverrides ?? {};
        overrides[input.trade] = {
          ...(overrides[input.trade] ?? {}),
          [String(input.index)]: input.value,
        };
        const result = await repo.updateOne({
          filter: { id: projectId },
          values: { laborOverrides: overrides },
        });
        return c.json({ data: result.record });
      },
    );

    // --- Trade quotas ---

    const tradeSettings = 'resourcePlanning.tradeQuotas';
    async function tradesFor(
      c: Context<AuthorizationEnv>,
      action: 'read' | 'create' | 'update' | 'delete',
    ) {
      // Reading needs only a signed-in session. The settings item declares
      // `read` and `update`; create and delete both ride on `update`, since
      // the table is a fixed shared catalog maintained through one surface.
      if (action !== 'read')
        await c.get('authz').require({
          resource: { type: 'settings', id: tradeSettings },
          action:
            action === 'create' || action === 'delete' ? 'update' : action,
        });
      return trades;
    }

    router.get(
      '/laborTrades',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'List the shared labor trade quotas',
        operationId: 'listLaborTrades',
        responses: {
          '200': listResponse(LaborTradeSchema),
          ...apiErrorResponses,
        },
      }),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const repo = await tradesFor(c, 'read');
        const rows = await repo.findMany();
        return c.json({ data: rows, meta: { total: rows.length } });
      },
    );

    router.get(
      '/laborTrades/:tradeId',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'Get a labor trade quota',
        operationId: 'getLaborTrade',
        responses: {
          '200': dataResponse(LaborTradeSchema),
          '404': apiErrorResponse(404),
          ...apiErrorResponses,
        },
      }),
      apiValidator('param', LaborTradeParams),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const { tradeId } = context.req.valid('param');
        const repo = await tradesFor(c, 'read');
        const record = await repo.findOne({ filter: { id: tradeId } });
        if (!record)
          throw new ApiError({
            status: 'NOT_FOUND',
            reason: 'TRADE_NOT_FOUND',
            domain: 'resourcePlanning',
            message: `Trade ${tradeId} was not found.`,
          });
        return c.json({ data: record });
      },
    );

    router.post(
      '/laborTrades',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'Create a labor trade quota',
        operationId: 'createLaborTrade',
        responses: {
          '201': dataResponse(LaborTradeSchema),
          ...apiErrorResponses,
        },
      }),
      apiValidator('json', CreateLaborTradeInput),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const input = context.req.valid('json');
        const repo = await tradesFor(c, 'create');
        const existing = await repo.findOne({ filter: { name: input.name } });
        if (existing)
          throw new ApiError({
            status: 'ALREADY_EXISTS',
            reason: 'TRADE_NAME_TAKEN',
            domain: 'resourcePlanning',
            message: `A trade named ${input.name} already exists.`,
          });
        const id = idGenerator.generateString();
        const result = await repo.createOne({
          values: {
            id,
            name: input.name,
            unitQuota: input.unitQuota,
          },
        });
        return c.json(
          {
            data: { ...result.record, id: (result.record?.id as string) ?? id },
          },
          201,
        );
      },
    );

    router.patch(
      '/laborTrades/:tradeId',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'Update a labor trade quota',
        operationId: 'updateLaborTrade',
        responses: {
          '200': dataResponse(LaborTradeSchema),
          '404': apiErrorResponse(404),
          ...apiErrorResponses,
        },
      }),
      apiValidator('param', LaborTradeParams),
      apiValidator('json', UpdateLaborTradeInput),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const { tradeId } = context.req.valid('param');
        const input = context.req.valid('json');
        const repo = await tradesFor(c, 'update');
        const record = await repo.findOne({ filter: { id: tradeId } });
        if (!record)
          throw new ApiError({
            status: 'NOT_FOUND',
            reason: 'TRADE_NOT_FOUND',
            domain: 'resourcePlanning',
            message: `Trade ${tradeId} was not found.`,
          });
        const values: Record<string, unknown> = {};
        if (input.name !== undefined && input.name !== record.name) {
          const taken = await repo.findOne({ filter: { name: input.name } });
          if (taken && taken.id !== record.id)
            throw new ApiError({
              status: 'ALREADY_EXISTS',
              reason: 'TRADE_NAME_TAKEN',
              domain: 'resourcePlanning',
              message: `A trade named ${input.name} already exists.`,
            });
          values.name = input.name;
        }
        if (input.unitQuota !== undefined) values.unitQuota = input.unitQuota;
        const result = await repo.updateOne({
          filter: { id: tradeId },
          values,
        });
        return c.json({ data: result.record });
      },
    );

    router.delete(
      '/laborTrades/:tradeId',
      auth.required(),
      authorization.middleware(),
      describeRoute({
        tags: ['Resource Planning'],
        summary: 'Delete a labor trade quota',
        operationId: 'deleteLaborTrade',
        responses: {
          '204': emptyResponse(),
          '404': apiErrorResponse(404),
          ...apiErrorResponses,
        },
      }),
      apiValidator('param', LaborTradeParams),
      async (context) => {
        const c = context as unknown as Context<AuthorizationEnv>;
        const { tradeId } = context.req.valid('param');
        const repo = await tradesFor(c, 'delete');
        const record = await repo.findOne({ filter: { id: tradeId } });
        if (!record)
          throw new ApiError({
            status: 'NOT_FOUND',
            reason: 'TRADE_NOT_FOUND',
            domain: 'resourcePlanning',
            message: `Trade ${tradeId} was not found.`,
          });
        await repo.deleteOne({ filter: { id: tradeId } });
        return c.body(null, 204);
      },
    );

    return router;
  });

export default resourcePlanningRoutes;
