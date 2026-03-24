export const layoutTokens = {
  breakpoints: {
    portraitRule: 'width < height',
    landscapeRule: 'width >= height',
    landscapeMinAspectRatio: 1,
    wideStageMinWidth: 900,
  },
  spacing: {
    pagePaddingPortrait: 'clamp(18px, 4vw, 40px)',
    pagePaddingLandscape: 'clamp(20px, 3vw, 36px)',
    stageGapPortrait: 'clamp(18px, 3vw, 28px)',
    stageGapLandscape: 'clamp(16px, 2.6vw, 24px)',
    keyGapPortrait: '12px',
    keyGapLandscape: '14px',
  },
  display: {
    minHeightPortrait: 'clamp(136px, 24vh, 176px)',
    minHeightLandscape: 'clamp(120px, 22vh, 150px)',
    paddingInlinePortrait: '12px',
    paddingInlineLandscape: '10px',
    fontSizePortrait: 'clamp(4.25rem, 14vw, 7rem)',
    fontSizeLandscape: 'clamp(4.5rem, 10vw, 6.5rem)',
    letterSpacing: '-0.08em',
  },
  button: {
    radius: '999px',
    sizePortrait: 'clamp(72px, 12vw, 92px)',
    sizeLandscape: 'clamp(68px, 8vw, 88px)',
    fontSizePortrait: 'clamp(1.7rem, 4vw, 2.15rem)',
    fontSizeLandscape: 'clamp(1.5rem, 2.8vw, 1.95rem)',
    contentPaddingInlinePortrait: '12px',
    contentPaddingInlineLandscape: '10px',
    zeroColumnSpan: 2,
  },
  colors: {
    canvas: '#000000',
    textPrimary: '#f5f5f7',
    textMuted: 'rgba(245, 245, 247, 0.62)',
    accentSoft: 'rgba(255, 159, 10, 0.88)',
    input: {
      background: '#2c2c2e',
      text: '#f5f5f7',
    },
    system: {
      background: '#d4d4d8',
      text: '#111111',
    },
    operator: {
      background: '#ff9f0a',
      text: '#f5f5f7',
    },
  },
  shell: {
    maxWidthPortrait: '520px',
    maxWidthLandscape: '1180px',
  },
} as const;

export type CalculatorViewportMode = 'portrait' | 'landscape';

export const viewportModeContracts = [
  {
    mode: 'portrait',
    title: 'Portrait',
    rule: layoutTokens.breakpoints.portraitRule,
    emphasis: 'Thumb-led standard layout',
  },
  {
    mode: 'landscape',
    title: 'Landscape',
    rule: layoutTokens.breakpoints.landscapeRule,
    emphasis: 'Scientific density without weak buttons',
  },
] as const satisfies ReadonlyArray<{
  emphasis: string;
  mode: CalculatorViewportMode;
  rule: string;
  title: string;
}>;
