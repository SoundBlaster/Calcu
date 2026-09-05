// Fixed synthetic provider response. This never represents a real model decision.
export const permittedRuntimeTools = [
  'calculation_propose',
  'skills__list',
  'skills__read',
  'update_plan',
];
export const forbiddenTools = ['exec_command', 'view_image', 'apply_patch'];

export function syntheticResponse(nonce) {
  const script = `
const inventory = Object.keys(tools).sort();
const denied = {};
for (const name of ${JSON.stringify(forbiddenTools)}) {
  if (typeof tools[name] !== "undefined") { denied[name] = "exposed"; continue; }
  try { await tools[name]({}); denied[name] = "unexpected_success"; }
  catch (error) { denied[name] = error instanceof TypeError ? "unavailable" : "unexpected_error"; }
}
const result = await tools.calculation_propose({operator:"multiply",left:240,right:0.15});
text({nonce:${JSON.stringify(nonce)},inventory,denied,result,
  globals:{process:typeof process,require:typeof require,fetch:typeof fetch}});
`;
  const item = {
    type: 'custom_tool_call',
    id: `ct_${nonce}`,
    call_id: nonce,
    name: 'exec',
    input: script,
  };
  const base = {
    id: `resp_${nonce}`,
    object: 'response',
    model: 'gpt-5.6-luna',
    output: [],
  };
  const events = [
    { type: 'response.created', response: { ...base, status: 'in_progress' } },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { ...item, input: '' },
    },
    {
      type: 'response.custom_tool_call_input.delta',
      item_id: item.id,
      output_index: 0,
      delta: script,
    },
    { type: 'response.output_item.done', output_index: 0, item },
    {
      type: 'response.completed',
      response: {
        ...base,
        status: 'completed',
        output: [item],
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      },
    },
  ];
  return events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join('');
}

export function judgeDynamicProbe({
  assessment,
  followingAssessment,
  followingRequest,
  nonce,
  calls,
  rejectedCalls = 0,
  requestCount = 2,
}) {
  const outputs =
    followingRequest?.input?.filter(
      (item) =>
        item.type === 'custom_tool_call_output' && item.call_id === nonce,
    ) ?? [];
  const reports = outputs
    .flatMap((item) => (Array.isArray(item.output) ? item.output : []))
    .flatMap((part) => {
      try {
        const value = JSON.parse(part.text);
        return value?.nonce === nonce ? [value] : [];
      } catch {
        return [];
      }
    });
  const evidence = reports.length === 1 ? reports[0] : null;
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const expected = { operator: 'multiply', left: 240, right: 0.15, result: 36 };
  // Dynamic tool text content is returned by Code Mode as a JSON string.
  let returnedResult = evidence?.result;
  if (typeof returnedResult === 'string') {
    try {
      returnedResult = JSON.parse(returnedResult);
    } catch {
      returnedResult = null;
    }
  }
  const canonicalResult = (value) =>
    value &&
    Object.keys(value).length === 4 &&
    value.operator === expected.operator &&
    value.left === expected.left &&
    value.right === expected.right &&
    value.result === expected.result;
  const runtimeInventoryMatches =
    Array.isArray(evidence?.inventory) &&
    same([...evidence.inventory].sort(), [...permittedRuntimeTools].sort());
  const forbiddenUnavailable = forbiddenTools.every(
    (name) => evidence?.denied?.[name] === 'unavailable',
  );
  const hostGlobalsUnavailable = ['process', 'require', 'fetch'].every(
    (name) => evidence?.globals?.[name] === 'undefined',
  );
  const mediatedResultVerified =
    calls.length === 1 &&
    canonicalResult(calls[0]) &&
    canonicalResult(returnedResult);
  const unexpectedRuntimeTools = Array.isArray(evidence?.inventory)
    ? evidence.inventory.filter((name) => !permittedRuntimeTools.includes(name))
    : [];
  const capabilityProbePassed =
    assessment.wrapperCandidate &&
    followingAssessment?.wrapperCandidate &&
    runtimeInventoryMatches &&
    forbiddenUnavailable &&
    hostGlobalsUnavailable &&
    mediatedResultVerified &&
    rejectedCalls === 0 &&
    requestCount === 2;
  return {
    capabilityProbePassed: Boolean(capabilityProbePassed),
    runtimeInventoryMatches,
    forbiddenUnavailable,
    hostGlobalsUnavailable,
    mediatedResultVerified,
    unexpectedRuntimeTools,
    evidence,
    liveModelTested: false,
    toolIsolationProven: false,
    aspConformance: false,
  };
}
