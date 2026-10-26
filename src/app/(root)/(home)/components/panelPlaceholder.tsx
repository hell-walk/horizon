import { cn } from "@/lib/utils";

/**
 * The outline of a panel that is still loading: the same frame, a bar where
 * the heading goes and one where the first line goes. Keeps the page from
 * jumping as streamed panels arrive one after another on a slow connection.
 */
const PanelPlaceholder = ({ className }: { className?: string }) => (
  <section className={cn("panel animate-pulse", className)} aria-hidden>
    <header className="panel-head">
      <span className="h-3 w-32 rounded-full bg-line" />
    </header>
    <div className="panel-body flex flex-col gap-3">
      <span className="h-8 w-24 rounded-md bg-line" />
      <span className="h-3 w-3/4 rounded-full bg-line" />
    </div>
  </section>
);

export default PanelPlaceholder;
