// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createCalcuExecutor } from './executor';
import {
  createTestIdentityFixture,
  createTestIdentityVerifier,
} from './identity';
import { createLocalBackend } from './localBackend';
import { prepareCalcuSurface } from './manifest';
import {
  claimTaskPermission,
  createTaskPermissionBroker,
  issuePermittedTaskGrant,
} from './taskPermissions';

const start = Date.parse('2026-10-01T00:00:00Z');
const task = 'What is 15% of 240?';
function fixture() {
  let time = start;
  const prepared = prepareCalcuSurface();
  const broker = createTaskPermissionBroker(prepared, () => time);
  const offer = broker.offer(task);
  const selection = {
    offer_id: offer.offer_id,
    actions: [offer.action_id],
    data_classes: offer.data_classes.map((entry) => entry.id),
  };
  return {
    prepared,
    broker,
    offer,
    selection,
    advance: () => {
      time += 60_000;
    },
  };
}

describe('trusted one-task permission selection', () => {
  it('does not reach issuance for a forged selection and executes only after valid selection', async () => {
    const current = fixture();
    const identity = createTestIdentityFixture(start);
    const executor = createCalcuExecutor({
      now: () => start,
      identityVerifier: createTestIdentityVerifier(identity),
    });
    const issue = vi.spyOn(executor, 'issue');
    const request = {
      subject: { user: 'calcu-user-local' },
      delegate: {
        runtime: 'calcu-runtime-local',
        agent: identity.evidence.subject,
      },
      identity: {
        evidence: identity.evidence,
        artifactBytes: identity.artifactBytes,
      },
      audience: current.prepared.surface.credential_audience,
      expires_at: start + 60_000,
    };
    expect(() =>
      issuePermittedTaskGrant(
        executor,
        request,
        { kind: 'approved_task_permission' },
        task,
        current.prepared.surface,
        start,
      ),
    ).toThrow('permission_invalid');
    expect(issue).not.toHaveBeenCalled();
    expect(executor.engineCalls).toBe(0);
    const permission = current.broker.accept(task, current.selection);
    const access = issuePermittedTaskGrant(
      executor,
      request,
      permission,
      task,
      current.prepared.surface,
      start,
    );
    const backend = createLocalBackend(access, executor.invoke, () => start);
    expect(
      (
        await backend.calculationPropose({
          operator: 'multiply',
          left: 240,
          right: 0.15,
        })
      ).result,
    ).toBe(36);
    expect(issue).toHaveBeenCalledTimes(1);
    expect(executor.engineCalls).toBe(1);
    executor.revoke(access.binding.grant_id);
    await expect(
      backend.calculationPropose({
        operator: 'multiply',
        left: 240,
        right: 0.15,
      }),
    ).rejects.toThrow();
    expect(executor.engineCalls).toBe(1);
  });
  it('binds exact action/data selection to the task and surface before issuance', () => {
    const { broker, selection, prepared, offer } = fixture();
    expect(offer.retention).toBe('user_managed');
    const permission = broker.accept(task, selection);
    expect(() =>
      claimTaskPermission(permission, task, prepared.surface, start),
    ).not.toThrow();
    expect(() =>
      claimTaskPermission(permission, task, prepared.surface, start),
    ).toThrow('permission_invalid');
    expect(JSON.stringify(permission)).not.toMatch(
      /credential|grant_hash|identity/,
    );
  });

  it.each([
    'missing',
    'extra',
    'wrong-offer',
    'wrong-action',
    'missing-class',
    'duplicate-class',
    'extra-class',
    'wrong-task',
    'expired',
    'replaced',
  ])('rejects %s selection without creating an issuance permit', (kind) => {
    const current = fixture();
    const selection: Record<string, unknown> = structuredClone(
      current.selection,
    );
    if (kind === 'missing') delete selection.data_classes;
    if (kind === 'extra') selection.credential = 'SECRET';
    if (kind === 'wrong-offer') selection.offer_id = 'b'.repeat(64);
    if (kind === 'wrong-action') selection.actions = ['calculation.delete'];
    if (kind === 'missing-class')
      selection.data_classes = ['calculation.status'];
    if (kind === 'duplicate-class')
      selection.data_classes = [
        'calculation.content',
        'calculation.content',
        'calculation.status',
      ];
    if (kind === 'extra-class')
      selection.data_classes = [
        ...current.selection.data_classes,
        'application.database',
      ];
    if (kind === 'expired') current.advance();
    if (kind === 'replaced') current.broker.offer(task);
    expect(() =>
      current.broker.accept(
        kind === 'wrong-task' ? 'Another task' : task,
        selection,
      ),
    ).toThrow('permission_invalid');
  });

  it('rejects replay, forged permits and drift at the issuance boundary', () => {
    const { broker, prepared, selection } = fixture();
    const permission = broker.accept(task, selection);
    expect(() => broker.accept(task, selection)).toThrow('permission_invalid');
    expect(() =>
      claimTaskPermission(
        { kind: 'approved_task_permission' },
        task,
        prepared.surface,
        start,
      ),
    ).toThrow('permission_invalid');
    expect(() =>
      claimTaskPermission(permission, 'changed task', prepared.surface, start),
    ).toThrow('permission_invalid');
    expect(() =>
      claimTaskPermission(
        permission,
        task,
        { ...prepared.surface, surface_hash: 'changed' },
        start,
      ),
    ).toThrow('permission_invalid');
    expect(() =>
      claimTaskPermission(permission, task, prepared.surface, start + 60_000),
    ).toThrow('permission_invalid');
  });
});
