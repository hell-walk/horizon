// Shown while the slow parts of a page stream in. Each keeps the size of what
// will replace it, so nothing jumps when it arrives; inside, bars rise and fall
// (components/ui/loaders.tsx) where the content is coming.

import { BarsLoader } from "./loaders";

const Line = ({ className }: { className: string }) => <div className={`rounded-md bg-surface-container ${className}`} />;

export const HomeHeaderSkeleton = () => (
  <div className="flex flex-col gap-6" aria-busy="true">
    <div className="flex flex-col gap-2">
      <Line className="h-3 w-32" />
      <Line className="h-8 w-80 max-w-full" />
      <Line className="h-4 w-96 max-w-full" />
    </div>
    <BarsLoader className="h-40" />
  </div>
);

export const PanelSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <section className="panel" aria-busy="true">
    <header className="panel-head">
      <Line className="h-3 w-28" />
      <Line className="h-3 w-16" />
    </header>
    <div className="panel-body">
      {/* About the height the rows will take (each ~52 px). */}
      <BarsLoader className={rows <= 1 ? "h-12" : rows <= 3 ? "h-36" : "h-72"} />
    </div>
  </section>
);

export const ChartPanelSkeleton = () => (
  <section className="panel" aria-busy="true">
    <header className="panel-head">
      <Line className="h-3 w-28" />
      <Line className="h-3 w-16" />
    </header>
    <div className="panel-body">
      <BarsLoader className="h-[204px]" />
    </div>
  </section>
);

export const RecentTransactionsSkeleton = () => <PanelSkeleton rows={6} />;

export const RightSideBarSkeleton = () => (
  <aside className="flex w-full flex-col gap-4 xl:w-[340px] xl:shrink-0" aria-busy="true">
    <div className="panel">
      <BarsLoader className="h-[190px]" />
    </div>
    <PanelSkeleton rows={1} />
    <PanelSkeleton rows={3} />
  </aside>
);
