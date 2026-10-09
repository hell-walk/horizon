// Placeholder blocks shown while the slow parts of a page stream in.

const Block = ({ className }: { className: string }) => <div className={`animate-pulse rounded-md bg-surface-container ${className}`} />;

export const HomeHeaderSkeleton = () => (
  <div className="flex flex-col gap-6" aria-busy="true">
    <div className="flex flex-col gap-2">
      <Block className="h-3 w-32" />
      <Block className="h-8 w-80 max-w-full" />
      <Block className="h-4 w-96 max-w-full" />
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Block key={i} className="h-16" />
      ))}
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <Block className="h-32" />
      <Block className="h-32" />
    </div>
  </div>
);

export const PanelSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <section className="panel" aria-busy="true">
    <header className="panel-head">
      <Block className="h-3 w-28" />
      <Block className="h-3 w-16" />
    </header>
    <div className="panel-body flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Block key={i} className="h-10" />
      ))}
    </div>
  </section>
);

export const ChartPanelSkeleton = () => (
  <section className="panel" aria-busy="true">
    <header className="panel-head">
      <Block className="h-3 w-28" />
      <Block className="h-3 w-16" />
    </header>
    <div className="panel-body grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
      <div className="mx-auto size-[180px] animate-pulse rounded-full border-[14px] border-surface-container" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} className="h-10" />
        ))}
      </div>
    </div>
  </section>
);

export const RecentTransactionsSkeleton = () => <PanelSkeleton rows={6} />;

export const RightSideBarSkeleton = () => (
  <aside className="flex w-full flex-col gap-4 xl:w-[340px] xl:shrink-0" aria-busy="true">
    <Block className="h-[190px] rounded-lg" />
    <PanelSkeleton rows={1} />
    <PanelSkeleton rows={3} />
  </aside>
);
