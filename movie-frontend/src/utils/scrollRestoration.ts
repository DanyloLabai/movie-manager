const PREFIX = "movieListScroll:";

interface ScrollState {
  scrollY: number;
  itemCount: number | null;
}

export function saveScrollState(key: string, itemCount: number | null = null) {
  sessionStorage.setItem(
    `${PREFIX}${key}`,
    JSON.stringify({ scrollY: window.scrollY, itemCount }),
  );
}

export function consumeScrollState(key: string): ScrollState | null {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    sessionStorage.removeItem(`${PREFIX}${key}`);
    return JSON.parse(raw) as ScrollState;
  } catch {
    return null;
  }
}
