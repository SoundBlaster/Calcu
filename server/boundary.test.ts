// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createCalcuExecutor, type Transport } from './executor';
import { createLocalBackend } from './localBackend';

const input = { operator: 'multiply', left: 240, right: 0.15 };
function setup() {
  let time = 1000;
  const app = createCalcuExecutor(() => time);
  const access = app.issue();
  let captured = '';
  const backend = createLocalBackend(access, (credential, body) => {
    captured = body;
    return app.invoke(credential, body);
  });
  return {
    app,
    access,
    backend,
    capture() {
      backend.calculationPropose(input);
      return JSON.parse(captured);
    },
    advance() {
      time += 60_000;
    },
  };
}

describe('LocalBackend → independent Calcu executor', () => {
  it('returns actual Calcu output without exposing authority', () => {
    const { app, backend, access } = setup();
    const output = backend.calculationPropose(input);
    expect(output).toEqual({ ...input, result: 36 });
    expect(app.engineCalls).toBe(1);
    expect(Object.keys(backend)).toEqual(['calculationPropose']);
    expect(JSON.stringify(output)).not.toContain(access.credential);
    expect(JSON.stringify(output)).not.toContain(access.binding.grant_id);
  });

  it.each([
    'missing',
    'identifier',
    'other-grant',
    'revoked',
    'expired',
    'session',
  ])('rejects %s authority before the engine', (kind) => {
    const state = setup();
    const request = state.capture();
    let credential = state.access.credential;
    if (kind === 'missing') credential = '';
    if (kind === 'identifier') credential = state.access.binding.grant_id;
    if (kind === 'other-grant') credential = state.app.issue().credential;
    if (kind === 'revoked') state.app.revoke(credential);
    if (kind === 'expired') state.advance();
    if (kind === 'session') state.app.rotateSession(credential);
    expect(() =>
      state.app.invoke(credential, JSON.stringify(request)),
    ).toThrow();
    expect(state.app.engineCalls).toBe(1);
  });

  it.each([
    'session_id',
    'session_generation',
    'grant_id',
    'grant_hash',
    'surface_hash',
    'action_id',
    'trace_id',
    'span_id',
  ])('rejects altered %s even when bypassing LocalBackend', (key) => {
    const state = setup();
    const request = state.capture();
    request.payload[key] = 'substituted';
    expect(() =>
      state.app.invoke(state.access.credential, JSON.stringify(request)),
    ).toThrow();
    expect(state.app.engineCalls).toBe(1);
  });

  it.each([
    null,
    {},
    [],
    { ...input, credential: 'agent-supplied' },
    { ...input, operator: 'eval' },
    { ...input, left: '240' },
    { ...input, right: null },
  ])('rejects invalid application input independently: %j', (bad) => {
    const state = setup();
    const request = state.capture();
    request.payload.input = bad;
    expect(() =>
      state.app.invoke(state.access.credential, JSON.stringify(request)),
    ).toThrow();
    expect(state.app.engineCalls).toBe(1);
  });

  it('rejects non-finite tool arguments and result overflow', () => {
    const { backend, app } = setup();
    expect(() =>
      backend.calculationPropose({ ...input, left: Infinity }),
    ).toThrow();
    expect(app.engineCalls).toBe(0);
    expect(() =>
      backend.calculationPropose({
        ...input,
        left: Number.MAX_VALUE,
        right: 2,
      }),
    ).toThrow('invalid_result');
    expect(() =>
      backend.calculationPropose({ operator: 'divide', left: 1, right: 0 }),
    ).toThrow('invalid_result');
  });

  it('rejects changed mode, extra envelope fields, malformed/oversized JSON', () => {
    const state = setup();
    const request = state.capture();
    for (const body of [
      '{',
      ' '.repeat(8193),
      JSON.stringify({ ...request, credential: 'extra' }),
      JSON.stringify({
        ...request,
        payload: { ...request.payload, execution: { mode: 'commit' } },
      }),
    ])
      expect(() => state.app.invoke(state.access.credential, body)).toThrow();
    expect(state.app.engineCalls).toBe(1);
  });

  it('bounds calls in app-owned state across multiple backend instances', () => {
    const state = setup();
    for (let i = 0; i < 3; i++) state.backend.calculationPropose(input);
    const second = createLocalBackend(state.access, state.app.invoke);
    expect(() => second.calculationPropose(input)).toThrow('quota_exceeded');
    expect(state.app.engineCalls).toBe(3);
  });

  it('does not share mutable authority with the mediator', () => {
    const state = setup();
    state.access.binding.session_generation = 999;
    expect(state.backend.calculationPropose(input).result).toBe(36);
    const changed = createLocalBackend(state.access, state.app.invoke);
    expect(() => changed.calculationPropose(input)).toThrow('binding_mismatch');
  });

  it.each([
    'correlation',
    'output',
    'extra',
    'type',
    'malformed',
    'late',
  ])('does not accept %s response as current app result', (kind) => {
    const state = setup();
    let previous = '';
    const transport: Transport = (credential, body) => {
      const raw = state.app.invoke(credential, body);
      const result = JSON.parse(raw);
      if (kind === 'correlation') result.payload.session_generation++;
      if (kind === 'output') result.payload.output.left = 18;
      if (kind === 'extra') result.payload.output.credential = credential;
      if (kind === 'type') result.type = 'model.answer';
      if (kind === 'malformed') return '{';
      if (kind === 'late') {
        const response = previous || raw;
        previous = raw;
        return response;
      }
      return JSON.stringify(result);
    };
    const backend = createLocalBackend(state.access, transport);
    if (kind === 'late') backend.calculationPropose(input);
    expect(() => backend.calculationPropose(input)).toThrow();
  });
});
