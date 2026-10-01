import { randomBytes } from 'node:crypto';
import type { TaskPermissionOffer } from '../src/features/agent-task/permissions';
import { exact } from './calcu';
import type { createCalcuExecutor, GrantRequest } from './executor';
import type { CalcuSurface, PreparedCalcuSurface } from './manifest';

export type ApprovedTaskPermission = Readonly<{
  kind: 'approved_task_permission';
}>;
type Approval = {
  task: string;
  surfaceHash: string;
  expiresAt: number;
  claimed: boolean;
};
const approvals = new WeakMap<ApprovedTaskPermission, Approval>();

export function issuePermittedTaskGrant(
  executor: Pick<ReturnType<typeof createCalcuExecutor>, 'issue'>,
  request: GrantRequest,
  permission: ApprovedTaskPermission,
  task: string,
  surface: CalcuSurface,
  now = Date.now(),
) {
  claimTaskPermission(permission, task, surface, now);
  return executor.issue(request);
}

// Only application-owned instances minted after matching an issued offer are
// accepted here. Browser acknowledgements are not Grant or approval receipts.
export function claimTaskPermission(
  permission: ApprovedTaskPermission,
  task: string,
  surface: CalcuSurface,
  now = Date.now(),
) {
  const record = approvals.get(permission);
  if (
    !record ||
    record.claimed ||
    record.task !== task ||
    record.surfaceHash !== surface.surface_hash ||
    now >= record.expiresAt
  ) {
    throw new Error('permission_invalid');
  }
  record.claimed = true;
}

export function createTaskPermissionBroker(
  prepared: PreparedCalcuSurface,
  now = Date.now,
) {
  const document = prepared.document.parse() as {
    data_classes: TaskPermissionOffer['data_classes'];
    actions: {
      id: string;
      data_exposure: { classes: string[]; retention: { mode: string } };
    }[];
  };
  const action = document.actions.find(
    (item) => item.id === 'calculation.propose',
  );
  if (!action || action.data_exposure.retention.mode !== 'user_managed')
    throw new Error('permission_invalid');
  const classes = action.data_exposure.classes.map((id) => {
    const item = document.data_classes.find((entry) => entry.id === id);
    if (!item) throw new Error('permission_invalid');
    return {
      id: item.id,
      label: item.label,
      classification: item.classification,
    };
  });
  let outstanding: { task: string; offer: TaskPermissionOffer } | undefined;
  return {
    offer(task: string): TaskPermissionOffer {
      const offer: TaskPermissionOffer = {
        offer_id: randomBytes(32).toString('hex'),
        expires_at: now() + 60_000,
        action_id: 'calculation.propose',
        data_classes: structuredClone(classes),
        retention: 'user_managed',
      };
      outstanding = { task, offer: structuredClone(offer) };
      return offer;
    },
    accept(task: string, selection: unknown): ApprovedTaskPermission {
      const record = outstanding;
      let value: Record<string, unknown>;
      try {
        value = exact(selection, ['offer_id', 'actions', 'data_classes']);
      } catch {
        throw new Error('permission_invalid');
      }
      const matches = (actual: unknown, expected: string[]) =>
        Array.isArray(actual) &&
        actual.length === expected.length &&
        actual.every((entry) => typeof entry === 'string') &&
        [...actual].sort().join('\n') === [...expected].sort().join('\n');
      if (
        !record ||
        record.task !== task ||
        now() >= record.offer.expires_at ||
        value.offer_id !== record.offer.offer_id ||
        !matches(value.actions, [record.offer.action_id]) ||
        !matches(
          value.data_classes,
          record.offer.data_classes.map((entry) => entry.id),
        )
      )
        throw new Error('permission_invalid');
      outstanding = undefined;
      const permission: ApprovedTaskPermission = Object.freeze({
        kind: 'approved_task_permission',
      });
      approvals.set(permission, {
        task,
        surfaceHash: prepared.surface.surface_hash,
        expiresAt: record.offer.expires_at,
        claimed: false,
      });
      return permission;
    },
  };
}
