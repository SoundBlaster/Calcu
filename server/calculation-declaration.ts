// Server-only application declaration. No business handler or authority capture.

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

type CalculationDeclaration = ActionDeclaration<typeof input, typeof output>;
export type CalculationActionInput = ActionInput<CalculationDeclaration>;
export type CalculationActionOutput = ActionOutput<CalculationDeclaration>;

export function calculationActionInventory(): OfflineActionInventory {
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
  } satisfies CalculationDeclaration;
  return new OfflineActionInventory(
    new JsonDocument(JSON.stringify(calculationDataClasses())),
    [declaration],
  );
}
