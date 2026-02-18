import { RefObject, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hasAttribute("disabled")) {
      return false;
    }
    const tabIndex = element.getAttribute("tabindex");
    if (tabIndex === "-1") {
      return false;
    }
    return true;
  });
}

export function useFocusTrap(containerRef: RefObject<HTMLElement>, active: boolean): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusables = getFocusableElements(container);
    const first = focusables[0] ?? container;
    const last = focusables[focusables.length - 1] ?? container;

    const raf = window.requestAnimationFrame(() => {
      first.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const currentFocusables = getFocusableElements(container);
      const currentFirst = currentFocusables[0] ?? container;
      const currentLast = currentFocusables[currentFocusables.length - 1] ?? container;
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === currentFirst || activeElement === container) {
          event.preventDefault();
          currentLast.focus();
        }
        return;
      }

      if (activeElement === currentLast) {
        event.preventDefault();
        currentFirst.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(raf);
      container.removeEventListener("keydown", onKeyDown);
      const previousFocus = previousFocusRef.current;
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [active, containerRef]);
}
