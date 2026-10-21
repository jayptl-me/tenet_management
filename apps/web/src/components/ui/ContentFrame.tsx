'use client';

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────────

export interface ContentFrameProps {
  /** Page body. */
  children: ReactNode;
  /** Optional right-hand context rail (a narrow column). */
  rail?: ReactNode;
  /** Rail width in px. Defaults to 320. */
  railWidth?: number;
  className?: string;
  /** Opt out of the max width: the band fills the shell instead of capping. */
  fullWidth?: boolean;
}

// ── Constants ──────────────────────────────────────────

/** Default context-rail width in px. */
const DEFAULT_RAIL_WIDTH = 320;

/**
 * The one band width of the admin app. 7xl (1280px) is the frame the repo
 * already defined in `ResponsiveContainer` (max-w-7xl); the shell gutter
 * (px-6) matches the top bar so the breadcrumb and the page title line up.
 */
const BAND_MAX_WIDTH_CLASS = 'max-w-7xl';

// ── Nesting ────────────────────────────────────────────

/**
 * True when a ContentFrame is rendered inside another ContentFrame.
 * The outermost frame owns the band (max width + gutters). A frame nested in
 * a page (a page that wants its own context rail) only contributes the
 * main/rail grid, so the app never stacks two widths on top of each other.
 */
const NestedFrameContext = createContext(false);

// ── Component ──────────────────────────────────────────

/**
 * The single content frame of the admin app: a main column, an optional
 * context rail and the page gutters. The shell mounts it once, so every admin
 * page sits on the same grid and the same width.
 *
 * The rail is a slot, not a per-page grid: a page that needs context next to
 * its body renders `<ContentFrame rail={...}>` inside the shell frame and the
 * rail column is created here.
 */
export function ContentFrame({
  children,
  rail,
  railWidth = DEFAULT_RAIL_WIDTH,
  className,
  fullWidth = false,
}: ContentFrameProps) {
  const nested = useContext(NestedFrameContext);

  const grid = (
    <div
      className={clsx(
        'grid grid-cols-1 items-start gap-6',
        rail ? 'lg:grid-cols-[minmax(0,1fr)_var(--content-rail-width)]' : undefined,
        nested ? className : undefined,
      )}
      style={{ '--content-rail-width': `${railWidth}px` } as CSSProperties}
    >
      <div className="min-w-0" data-content-frame="main">
        {children}
      </div>
      {rail ? (
        <aside className="min-w-0 lg:sticky lg:top-20" data-content-frame="rail">
          {rail}
        </aside>
      ) : null}
    </div>
  );

  if (nested) {
    return <NestedFrameContext.Provider value={true}>{grid}</NestedFrameContext.Provider>;
  }

  return (
    <NestedFrameContext.Provider value={true}>
      <div
        className={clsx(
          'mx-auto w-full px-6',
          fullWidth ? 'max-w-none' : BAND_MAX_WIDTH_CLASS,
          className,
        )}
        data-content-frame="band"
      >
        {grid}
      </div>
    </NestedFrameContext.Provider>
  );
}
