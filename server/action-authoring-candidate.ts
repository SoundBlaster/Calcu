// Offline experiment only: never imported by the demo host or executor.

import { JsonDocument } from '@0al/agent-surface';
import {
  OfflineActionCatalog,
  OfflineActionDefinition,
} from '@0al/offline-action-authoring-prototype';
import { type Static, Type } from '@sinclair/typebox';
import { calculationDataClasses, calculationDataExposure } from './exposure';

const fields = {
  operator: Type.Union([
    Type.Literal('add'),
    Type.Literal('subtract'),
    Type.Literal('multiply'),
    Type.Literal('divide'),
  ]),
  left: Type.Number(),
  right: Type.Number(),
};
const input = Type.Object(fields, { additionalProperties: false });
const output = Type.Object(
  { ...fields, result: Type.Number() },
  { additionalProperties: false },
);

export type CandidateInput = Static<typeof input>;
export type CandidateOutput = Static<typeof output>;

export function prepareCalcuActionCandidate(
  handler: (input: CandidateInput) => CandidateOutput,
  issuer = 'https://calcu.local',
) {
  const definition = new OfflineActionDefinition({
    action: {
      id: 'calculation.propose',
      scope: 'calculation.propose',
      risk: 'propose',
      side_effect: false,
      approval: 'none',
      execution: {
        mode: 'propose',
        operation_id: 'calculation.propose.operation',
        persisted: false,
      },
      data_exposure: calculationDataExposure(),
    },
    input,
    output,
    handler,
  });
  return new OfflineActionCatalog(
    new JsonDocument(JSON.stringify(calculationDataClasses())),
    [definition],
  ).prepare(`${issuer}/schemas/`);
}
