const STORAGE_KEY = "gamelyd.help.v1";

export type HelpStep = {
  target?: string;
  title: string;
  body: string;
};

export type HelpTour = {
  id: string;
  steps: HelpStep[];
};

export function helpTarget(id: string) {
  return { "data-help": id } as const;
}

export function helpSelector(id: string): string {
  return `[data-help="${CSS.escape(id)}"]`;
}

type Store = { seen: Record<string, boolean> };

function readStore(): Store {
  if (typeof window === "undefined") return { seen: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { seen: {} };
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || typeof parsed !== "object" || !parsed.seen) {
      return { seen: {} };
    }
    return { seen: parsed.seen };
  } catch {
    return { seen: {} };
  }
}

function writeStore(store: Store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private mode or quota — skip persistence.
  }
}

export function hasSeenHelp(id: string): boolean {
  return Boolean(readStore().seen[id]);
}

export function markHelpSeen(id: string) {
  const store = readStore();
  store.seen[id] = true;
  writeStore(store);
}

export function isHelpTargetVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
}

export function findHelpTarget(id: string): HTMLElement | null {
  const nodes = document.querySelectorAll(helpSelector(id));
  for (const node of nodes) {
    if (node instanceof HTMLElement && isHelpTargetVisible(node)) {
      return node;
    }
  }
  return null;
}

export function visibleHelpSteps(steps: HelpStep[]): HelpStep[] {
  return steps.filter((step) => {
    if (!step.target) return true;
    return Boolean(findHelpTarget(step.target));
  });
}
