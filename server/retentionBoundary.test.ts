// @vitest-environment node
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { CodexTaskAdapter } from './codexAdapter';

const fakeServer = fileURLToPath(
  new URL('./fixtures/fakeCodexAppServer.mjs', import.meta.url),
);
const marker = 'synthetic-retention-marker-572093';
const result = {
  operator: 'multiply',
  left: 240,
  right: 0.15,
  result: 36,
} as const;

function harness(scenario: string, timeoutMs = 2000) {
  let cwd = '';
  const diagnostics: unknown[] = [];
  const backend = { calculationPropose: vi.fn(async () => result) };
  const adapter = new CodexTaskAdapter({
    command: process.execPath,
    appServerArgs: [fakeServer, scenario],
    verifyVersion: async () => 'codex-cli 0.145.0',
    environment: { PATH: process.env.PATH },
    timeoutMs,
    killGraceMs: 20,
    onDiagnostic: (event) => diagnostics.push(event),
    spawnCodex(command, args, options) {
      cwd = String(options.cwd);
      expect(options.env?.TMPDIR).toBe(cwd);
      // A deliberately persisted synthetic file tests cleanup, not absence of writes.
      writeFileSync(join(cwd, 'synthetic-payload.txt'), marker);
      return spawn(command, args, { ...options, stdio: 'pipe' });
    },
  });
  return { adapter, backend, diagnostics, cwd: () => cwd };
}

describe('Calcu-owned retention boundaries (fake Codex only)', () => {
  it.each([
    'diagnostic_error',
    'diagnostic_method',
    'diagnostic_turn',
  ])('does not forward payloads from %s into diagnostics', async (scenario) => {
    const state = harness(scenario);
    await expect(
      state.adapter.run(
        marker,
        state.backend,
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow('agent_protocol_error');
    expect(state.diagnostics.length).toBeGreaterThan(0);
    expect(JSON.stringify(state.diagnostics)).not.toContain(marker);
    for (const event of state.diagnostics) {
      expect([
        { stage: 'protocol_event' },
        { stage: 'protocol_error', message: 'agent_protocol_error' },
        {
          stage: 'turn_failed',
          status: 'failed',
          message: 'agent_protocol_error',
        },
      ]).toContainEqual(event);
    }
    expect(state.backend.calculationPropose).not.toHaveBeenCalled();
    expect(existsSync(state.cwd())).toBe(false);
  });

  it.each([
    'success',
    'malformed',
    'timeout',
    'cancel',
  ])('removes its temporary directory after %s without deleting application output', async (scenario) => {
    const state = harness(
      scenario === 'cancel' ? 'timeout' : scenario,
      scenario === 'timeout' ? 150 : 2000,
    );
    const controller = new AbortController();
    const run = state.adapter.run(
      marker,
      state.backend,
      controller.signal,
      (event) => {
        if (
          scenario === 'cancel' &&
          event.type === 'progress' &&
          event.phase === 'starting'
        ) {
          controller.abort();
        }
      },
    );
    if (scenario === 'success') {
      const output = await run;
      expect(output.application_result).toEqual(result);
      // Returned app-owned presentation survives adapter/process cleanup.
      expect(output.application_result.result).toBe(36);
    } else {
      await expect(run).rejects.toThrow(
        scenario === 'cancel'
          ? 'cancelled'
          : scenario === 'timeout'
            ? 'agent_timeout'
            : 'agent_protocol_error',
      );
    }
    expect(state.cwd()).not.toBe('');
    expect(existsSync(state.cwd())).toBe(false);
    expect(JSON.stringify(state.diagnostics)).not.toContain(marker);
  });
});
