// Placeholder blocks shown while the slow parts of a page stream in.

export const RecentTransactionsSkeleton = () => (
  <section className="recent-transactions animate-pulse" aria-busy="true">
    <header className="flex items-center justify-between">
      <div className="h-7 w-48 rounded bg-gray-200" />
      <div className="h-10 w-24 rounded-lg bg-gray-200" />
    </header>
    <div className="h-12 w-full rounded-lg bg-gray-100" />
    <div className="h-20 w-full rounded-xl bg-blue-25" />
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 w-full rounded bg-gray-100" />
      ))}
    </div>
  </section>
);

export const RightSideBarSkeleton = () => (
  <aside className="right-sidebar animate-pulse" aria-busy="true">
    <section className="flex flex-col pb-8">
      <div className="profile-banner" />
      <div className="profile">
        <div className="profile-img bg-gray-200" />
        <div className="profile-details gap-2">
          <div className="h-6 w-40 rounded bg-gray-200" />
          <div className="h-4 w-52 rounded bg-gray-100" />
        </div>
      </div>
    </section>
    <section className="banks">
      <div className="h-6 w-24 rounded bg-gray-200" />
      <div className="h-[190px] w-full max-w-[320px] rounded-[20px] bg-blue-100" />
      <div className="h-6 w-32 rounded bg-gray-200" />
      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 w-full rounded-xl bg-gray-100" />
        ))}
      </div>
    </section>
  </aside>
);

export const HomeHeaderSkeleton = () => (
  <header className="home-header animate-pulse" aria-busy="true">
    <div className="header-box">
      <div className="h-9 w-72 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100" />
    </div>
    <div className="total-balance">
      <div className="total-balance-chart">
        <div className="size-[100px] rounded-full bg-gray-100" />
      </div>
      <div className="flex flex-col gap-6">
        <div className="h-5 w-40 rounded bg-gray-200" />
        <div className="flex flex-col gap-2">
          <div className="h-4 w-36 rounded bg-gray-100" />
          <div className="h-8 w-28 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  </header>
);
