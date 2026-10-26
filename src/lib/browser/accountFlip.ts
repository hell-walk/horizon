// Switching accounts plays the same animation as switching the theme: the page
// grows out of the card or row that was tapped, in a circle, while the old page
// recedes around it (globals.css, data-theme-flip="account"). It plays the
// moment the tap happens: the deck swaps on the spot inside the sweep, and the
// rest of the page catches up when the server answers. Browser-only.

type DocWithViewTransition = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => { ready: Promise<void>; finished: Promise<void> };
};

// The change made in `go` is on screen after React's next flush.
const FLUSH_MS = 30;

/**
 * Switch accounts with the page growing out of `from` (an element, or its
 * rectangle taken earlier). `go` makes the change seen at once (the deck,
 * the highlight), inside the sweep. `then` runs once the sweep has finished:
 * the navigation, whose page lands with no further animation, so its work
 * never steals frames from the sweep. Without view transitions, or with
 * reduced motion, both simply happen.
 */
export function flipToAccount(from: Element | DOMRect | null | undefined, go: () => void, then?: () => void) {
  const doc = document as DocWithViewTransition;
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduceMotion) {
    go();
    then?.();
    return;
  }

  const rect = from instanceof DOMRect ? from : from?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  root.style.setProperty("--theme-x", `${x}px`);
  root.style.setProperty("--theme-y", `${y}px`);
  root.style.setProperty("--theme-r", `${r}px`);
  root.dataset.themeFlip = "account";

  const transition = doc.startViewTransition(async () => {
    go();
    await new Promise((resolve) => window.setTimeout(resolve, FLUSH_MS));
  });
  // A hidden tab skips the animation (the change still applies): not an error.
  transition.ready.catch(() => {});
  // The navigation only after the sweep: a page landing mid-sweep starves it of frames.
  transition.finished
    .catch(() => {})
    .finally(() => {
      if (root.dataset.themeFlip === "account") delete root.dataset.themeFlip;
      then?.();
    });
}
