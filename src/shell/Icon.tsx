// Every icon in the product goes through here: Tabler line icons at a size on
// the grid (16, 20 or 24 px; 32 or 40 for a picture), with the stroke scaled so
// the line always renders at 1.5 px whatever the size. One hand draws them all.

import type { TablerIcon } from "@tabler/icons-react";

export type IconGlyph = TablerIcon;

const STROKE_PX = 1.5;

export default function Icon({ icon: Glyph, size = 20, className }: { icon: TablerIcon; size?: 16 | 20 | 24 | 32 | 40; className?: string }) {
  return (
    <Glyph
      className={className ? `icon ${className}` : "icon"}
      size={size}
      stroke={(STROKE_PX * 24) / size}
      aria-hidden="true"
      focusable="false"
    />
  );
}
