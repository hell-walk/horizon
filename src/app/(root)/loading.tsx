import {
  HomeHeaderSkeleton,
  RecentTransactionsSkeleton,
  RightSideBarSkeleton,
} from "@/components/skeletons";

// Shown instantly on navigation while the page's data is fetched.
export default function Loading() {
  return (
    <section className="home">
      <div className="home-content">
        <HomeHeaderSkeleton />
        <RecentTransactionsSkeleton />
      </div>
      <RightSideBarSkeleton />
    </section>
  );
}
