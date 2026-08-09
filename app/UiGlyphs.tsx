import type { ReactNode } from "react";

type GlyphProps = {
  className?: string;
};

function Glyph({
  className,
  children,
}: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function AddIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M12 5v14M5 12h14" />
    </Glyph>
  );
}

export function ImportIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
    </Glyph>
  );
}

export function ChevronRightIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="m9 5 7 7-7 7" />
    </Glyph>
  );
}

export function CheckIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="m5 12 4 4L19 6" />
    </Glyph>
  );
}

export function MoreHorizontalIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
