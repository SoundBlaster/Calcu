import { describe, expect, it } from 'vitest';
import { layoutTokens, viewportModeContracts } from './layoutTokens';

describe('layoutTokens', () => {
  it('defines portrait and landscape viewport contracts', () => {
    expect(viewportModeContracts.map((contract) => contract.mode)).toEqual([
      'portrait',
      'landscape',
    ]);
    expect(layoutTokens.breakpoints.landscapeMinAspectRatio).toBe(1);
    expect(layoutTokens.breakpoints.wideStageMinWidth).toBe(900);
  });

  it('preserves stable button geometry and color roles', () => {
    expect(layoutTokens.button.radius).toBe('999px');
    expect(layoutTokens.button.zeroColumnSpan).toBe(2);
    expect(layoutTokens.button.contentPaddingInlinePortrait).toBe('12px');
    expect(layoutTokens.button.contentPaddingInlineLandscape).toBe('10px');
    expect(layoutTokens.colors.system.background).toBe('#d4d4d8');
    expect(layoutTokens.colors.operator.background).toBe('#ff9f0a');
  });
});
