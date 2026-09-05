// @vitest-environment node
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CODEX_EFFORT,
  CODEX_MODEL,
  CodexTaskAdapter,
  type CodexTaskEvent,
} from './codexAdapter';
import { createDevelopmentTlsMaterial } from './developmentTls';
import { createCalcuExecutor, surface } from './executor';
import { createActionHttpsServer } from './httpsActionServer';
import {
  createDevelopmentIdentityVerifier,
  createEphemeralDevelopmentIdentity,
} from './identity';
import { createLocalBackend } from './localBackend';
import { createAuthenticatedHttpsTransport } from './transport';

const fakeServer = fileURLToPath(
  new URL('./fixtures/fakeCodexAppServer.mjs', import.meta.url),
);
const input = { operator: 'multiply', left: 240, right: 0.15 } as const;
const result = { ...input, result: 36 };
const openServers: Array<ReturnType<typeof createActionHttpsServer>['server']> =
  [];
const tlsFixtures: Array<
  Awaited<ReturnType<typeof createDevelopmentTlsMaterial>>
> = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          if (!server.listening) resolve();
          else server.close(() => resolve());
        }),
    ),
  );
  await Promise.all(tlsFixtures.splice(0).map((tls) => tls.dispose()));
});

function adapter(scenario: string, timeoutMs = 2_000) {
  return new CodexTaskAdapter({
    command: process.execPath,
    appServerArgs: [fakeServer, scenario],
    verifyVersion: async () => 'codex-cli 0.145.0',
    timeoutMs,
    killGraceMs: 20,
    environment: { PATH: process.env.PATH, HOME: process.env.HOME },
  });
}

function backend() {
  return {
    calculationPropose: vi.fn(async (value: unknown) => {
      expect(value).toEqual(input);
      return result;
    }),
  };
}

describe('CodexTaskAdapter', () => {
  it('uses one dynamic tool result as the sole success authority', async () => {
    const events: CodexTaskEvent[] = [];
    const localBackend = backend();
    const output = await adapter('fabricated_prose').run(
      'Сколько будет 15% от 240?',
      localBackend,
      new AbortController().signal,
      (event) => events.push(event),
    );
    expect(output.application_result).toEqual(result);
    expect(output.agent_message).toBe('I calculated 999.');
    expect(output.trace).toEqual({
      model: CODEX_MODEL,
      effort: CODEX_EFFORT,
      tool_name: 'calculation_propose',
      call_id: 'call-calcu-1',
      operands: input,
    });
    expect(localBackend.calculationPropose).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.type === 'tool_result')).toBe(true);
  });

  it('admits a schema-valid action without claiming semantic task equivalence', async () => {
    const semanticInput = {
      operator: 'multiply',
      left: 111,
      right: 2,
    } as const;
    const semanticResult = { ...semanticInput, result: 222 };
    const localBackend = {
      calculationPropose: vi.fn(async (value: unknown) => {
        expect(value).toEqual(semanticInput);
        return semanticResult;
      }),
    };

    const output = await adapter('semantic_subset').run(
      'Сколько будет корень из 111 умноженный на 2?',
      localBackend,
      new AbortController().signal,
      () => {},
    );

    expect(localBackend.calculationPropose).toHaveBeenCalledTimes(1);
    expect(output.application_result).toEqual(semanticResult);
    expect(output.trace.operands).toEqual(semanticInput);
  });

  it.each([
    ['malformed', 'agent_protocol_error'],
    ['truncated', 'agent_protocol_error'],
    ['oversized_line', 'agent_protocol_error'],
    ['unknown_request', 'agent_protocol_error'],
    ['wrong_thread', 'tool_call_rejected'],
    ['wrong_turn', 'tool_call_rejected'],
    ['invalid_call', 'agent_protocol_error'],
    ['wrong_tool', 'tool_call_rejected'],
    ['no_tool', 'tool_not_called'],
    ['auth_error', 'codex_auth_required'],
    ['model_error', 'model_unavailable'],
    ['double_tool', 'multiple_tool_calls'],
    ['nonzero', 'agent_process_exited'],
  ])('fails closed for %s fixture', async (scenario, code) => {
    const localBackend = backend();
    await expect(
      adapter(scenario).run(
        'calculate',
        localBackend,
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow(code);
    expect(localBackend.calculationPropose).toHaveBeenCalledTimes(
      scenario === 'double_tool' ? 1 : 0,
    );
  });

  it('rejects unsupported CLI versions before starting a task', async () => {
    const localBackend = backend();
    const runner = new CodexTaskAdapter({
      verifyVersion: async () => 'codex-cli 0.146.0',
    });
    await expect(
      runner.run(
        'calculate',
        localBackend,
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow('codex_version_unsupported');
    expect(localBackend.calculationPropose).not.toHaveBeenCalled();
  });

  it('times out and cancels an isolated process task', async () => {
    const localBackend = backend();
    await expect(
      adapter('timeout', 40).run(
        'calculate',
        localBackend,
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow('agent_timeout');

    const controller = new AbortController();
    const running = adapter('timeout').run(
      'calculate',
      localBackend,
      controller.signal,
      () => {},
    );
    setTimeout(() => controller.abort(), 20);
    await expect(running).rejects.toThrow('cancelled');
    expect(localBackend.calculationPropose).not.toHaveBeenCalled();
  });

  it('runs fake Codex through the real HTTPS ASP executor and Calcu engine', async () => {
    const tls = await createDevelopmentTlsMaterial();
    tlsFixtures.push(tls);
    const identity = createEphemeralDevelopmentIdentity();
    const executor = createCalcuExecutor({
      identityVerifier: createDevelopmentIdentityVerifier(identity),
    });
    const access = executor.issue({
      subject: { user: 'integration-user' },
      delegate: {
        runtime: 'integration-host',
        agent: identity.evidence.subject,
      },
      identity: {
        evidence: identity.evidence,
        artifactBytes: identity.artifactBytes,
      },
      audience: surface.credential_audience,
      expires_at: Date.now() + 60_000,
    });
    const actionHost = createActionHttpsServer(executor, {
      key: tls.key,
      cert: tls.cert,
    });
    await actionHost.listen();
    openServers.push(actionHost.server);
    const address = actionHost.server.address() as AddressInfo;
    const localBackend = createLocalBackend(
      access,
      createAuthenticatedHttpsTransport({
        endpoint: `https://127.0.0.1:${address.port}/agent-actions`,
        ca: tls.cert,
      }),
    );

    const output = await adapter('success').run(
      'Сколько будет 15% от 240?',
      localBackend,
      new AbortController().signal,
      () => {},
    );
    expect(output.application_result).toEqual(result);
    expect(executor.engineCalls).toBe(1);
    executor.revoke(access.binding.grant_id);
    await expect(localBackend.calculationPropose(input)).rejects.toThrow(
      'unauthorized',
    );
  });
});
