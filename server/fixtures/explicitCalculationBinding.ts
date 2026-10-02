// Private test-only description-to-function experiment, NOT an executor.
// No production module imports this fixture; the trusted test host owns the
// returned callback. Never expose it as an agent tool or admission capability.
import { type JsonDocument, SurfaceSnapshot } from '@0al/agent-surface';
import type { Calculation, CalculationResult } from '../calcu';
import { exact } from '../calcu';
import type { PreparedCalcuSurface } from '../manifest';

export class ExplicitCalculationBinding {
  readonly #surface: PreparedCalcuSurface;
  readonly #selection: JsonDocument;
  readonly #handler: (input: Calculation) => CalculationResult;

  constructor(
    surface: PreparedCalcuSurface,
    selection: JsonDocument,
    handler: (input: Calculation) => CalculationResult,
  ) {
    this.#surface = surface;
    this.#selection = selection;
    this.#handler = handler;
  }

  prepare(): (input: Calculation) => CalculationResult {
    const selection = exact(this.#selection.parse(), [
      'action_id',
      'mode',
      'surface_hash',
    ]);
    const document = this.#surface.document.parse() as {
      actions: Array<{
        id: string;
        side_effect: boolean;
        execution: { mode: string; persisted: boolean };
      }>;
    };
    const action = document.actions[0];
    const surfaceHash = new SurfaceSnapshot(this.#surface.document).hash();
    if (
      document.actions.length !== 1 ||
      action?.id !== selection.action_id ||
      action.id !== this.#surface.manifest.actionId ||
      action.execution.mode !== selection.mode ||
      selection.mode !== 'propose' ||
      action.side_effect !== false ||
      action.execution.persisted !== false ||
      selection.surface_hash !== surfaceHash ||
      this.#surface.manifest.hash() !== surfaceHash ||
      this.#surface.surface.surface_hash !== surfaceHash ||
      typeof this.#handler !== 'function'
    )
      throw new Error('binding_mismatch');
    // Intentionally no second admission, input decoding, clock callback or
    // validation tail between the executor's quota claim and native entry.
    return this.#handler;
  }
}
