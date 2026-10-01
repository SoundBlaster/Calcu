type Glyph = 'shield' | 'calculator' | 'document' | 'hourglass' | 'play';

const paths: Record<Glyph, string> = {
  shield: 'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7L12 3Zm-4 9 3 3 5-6',
  calculator: 'M6 2h12v20H6V2Zm3 3h6v4H9V5Zm0 8h1m4 0h1m-6 4h1m4 0h1',
  document: 'M6 2h8l5 5v15H6V2Zm8 0v6h5M9 12h7m-7 4h7',
  hourglass: 'M6 2h12M6 22h12M7 2v5l10 10v5M17 2v5L7 17v5M9 6h6M9 19h6',
  play: 'm7 3 15 9-15 9V3Z',
};

export function PanelGlyph({ name }: { name: Glyph }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill={name === 'play' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
