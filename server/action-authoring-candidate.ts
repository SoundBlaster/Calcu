// Offline experiment only: never imported by the demo host or executor.

import { JsonDocument } from '@0al/agent-surface';
import {
  type ActionDeclaration,
  type ActionInput,
  type ActionOutput,
  OfflineActionInventory,
} from '@0al/agent-surface/authoring';
import { Type } from '@sinclair/typebox';
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

type CandidateDeclaration = ActionDeclaration<typeof input, typeof output>;
export type CandidateInput = ActionInput<CandidateDeclaration>;
export type CandidateOutput = ActionOutput<CandidateDeclaration>;

export function prepareCalcuActionCandidate(issuer = 'https://calcu.local') {
  const declaration = {
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
  } satisfies CandidateDeclaration;
  return new OfflineActionInventory(
    new JsonDocument(JSON.stringify(calculationDataClasses())),
    [declaration],
  ).prepare(`${issuer}/schemas/`);
}
