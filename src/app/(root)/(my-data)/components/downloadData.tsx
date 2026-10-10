"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/i18nProvider";
import { exportMyData } from "@/lib/actions/privacy.action";

/** Builds the export on the server and hands it to the browser as a file. */
const DownloadData = () => {
  const t = useT();
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setState("working");
    setError(null);
    try {
      const result = await exportMyData();
      if (!result.ok) {
        setError(result.error);
        setState("idle");
        return;
      }
      const url = URL.createObjectURL(new Blob([result.json], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `horizon-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setState("done");
    } catch {
      setError(t("common.notReachable"));
      setState("idle");
    }
  };

  return (
    <section className="panel" aria-labelledby="download-title">
      <div className="panel-body flex flex-col gap-3">
        <h2 id="download-title" className="font-display text-18 font-semibold text-ink">
          {t("data.downloadTitle")}
        </h2>
        <p className="text-14 text-ink-muted">{t("data.downloadBody")}</p>
        <button type="button" onClick={download} disabled={state === "working"} className="btn-secondary w-fit">
          {state === "working" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {state === "working" ? t("data.downloadWorking") : t("data.downloadButton")}
        </button>
        <p role="status" className="text-13 text-success">
          {state === "done" ? t("data.downloadDone") : ""}
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
};

export default DownloadData;
