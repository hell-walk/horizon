import { ProgressDoughnut } from "@/components/ui/loaders";

// Shown at once, on the first visit and on every move between pages, while the
// page's data is fetched: the segmented ring fills until the page arrives.
export default function Loading() {
  return (
    <section className="page" aria-busy="true">
      <div className="flex flex-1 items-center justify-center py-16">
        <ProgressDoughnut />
      </div>
    </section>
  );
}
