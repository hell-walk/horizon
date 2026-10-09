import { ChartPanelSkeleton, HomeHeaderSkeleton, RecentTransactionsSkeleton, RightSideBarSkeleton } from "@/components/skeletons";

// Shown instantly on navigation while the page's data is fetched.
export default function Loading() {
  return (
    <section className="page">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <HomeHeaderSkeleton />
          <ChartPanelSkeleton />
          <RecentTransactionsSkeleton />
        </div>
        <RightSideBarSkeleton />
      </div>
    </section>
  );
}
