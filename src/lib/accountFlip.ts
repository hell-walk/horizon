// Switching accounts plays the same animation as switching the theme: the page
// for the new account grows out of the card or row that was tapped, in a
// circle (globals.css, data-theme-flip), once that page is on screen. Pixels
// are old or new, never blended. Browser-only: called from click handlers.

type DocWithViewTransition = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => { ready: Promise<void>; finished: Promise<void> };
};

// The new page usually arrives well inside this; after it the switch simply happens.
const WAIT_MS = 2500;
// A state change on the same page is on screen after React's next flush.
const FLUSH_MS = 30;

let waiting: { id: string; resolve: () => void } | null = null;

/** Pages and decks call this with the account they are showing; a pending flip ends when it is the one asked for. */
export function accountShown(id?: string) {
  if (id && waiting?.id === id) {
    waiting.resolve();
    waiting = null;
  }
}

/**
 * Switch to account `id`, the page growing out of `from` (an element, or its
 * rectangle taken earlier). `go` makes the change: a navigation, whose page
 * then reports itself through accountShown, or (`sameScreen`) a change that
 * is on screen at once. Without view transitions, or with reduced motion,
 * the change simply happens.
 */
export function flipToAccount(id: string, from: Element | DOMRect | null | undefined, go: () => void, { sameScreen = false } = {}) {
  const doc = document as DocWithViewTransition;
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduceMotion) {
    go();
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

  waiting?.resolve();
  const settled = new Promise<void>((resolve) => {
    if (sameScreen) {
      window.setTimeout(resolve, FLUSH_MS);
      return;
    }
    waiting = { id, resolve };
    window.setTimeout(resolve, WAIT_MS);
  });

  const transition = doc.startViewTransition(async () => {
    go();
    await settled;
  });
  // A hidden tab skips the animation (the change still applies): not an error.
  transition.ready.catch(() => {});
  transition.finished
    .catch(() => {})
    .finally(() => {
      if (root.dataset.themeFlip === "account") delete root.dataset.themeFlip;
    });
}
