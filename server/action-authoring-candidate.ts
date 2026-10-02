// Historical offline experiment: keep its unversioned schema namespace fixed.
import { calculationActionInventory } from './calculation-declaration';

export type {
  CalculationActionInput as CandidateInput,
  CalculationActionOutput as CandidateOutput,
} from './calculation-declaration';

export function prepareCalcuActionCandidate(issuer = 'https://calcu.local') {
  return calculationActionInventory().prepare(`${issuer}/schemas/`);
}
