"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { formUrlQuery } from "@/lib/utils";

export const Pagination = ({ page, totalPages }: PaginationProps) => {
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const go = (next: number) => {
    const newUrl = formUrlQuery({ params: searchParams.toString(), key: "page", value: String(next) });
    router.push(newUrl, { scroll: false });
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" className="btn-secondary btn-sm" onClick={() => go(page - 1)} disabled={page <= 1}>
        <ChevronLeft className="size-3.5" /> Prev
      </button>
      <p className="eyebrow">
        Page <span className="text-ink">{String(page).padStart(2, "0")}</span> / {String(totalPages).padStart(2, "0")}
      </p>
      <button type="button" className="btn-secondary btn-sm" onClick={() => go(page + 1)} disabled={page >= totalPages}>
        Next <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
};
