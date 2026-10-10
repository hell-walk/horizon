import type { ReactNode } from "react";

// Page title block: mono eyebrow, display title, one-line subtitle, optional actions.
const HeaderBox = ({ type = "title", title, user, subtext, eyebrow, actions }: HeaderBoxProps) => (
  <div className="page-header">
    <div className="flex min-w-0 flex-col gap-2">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="h-display">
        {title}
        {type === "greeting" && user && (
          <span className="text-lime-ink">
            , <span translate="no">{user}</span>
          </span>
        )}
      </h1>
      <p className="max-w-2xl text-14 text-ink-muted">{subtext}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export type { ReactNode };
export default HeaderBox;
