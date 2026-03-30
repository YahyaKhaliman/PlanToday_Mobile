import { useCallback, useRef } from 'react';

type GuardedHandler = () => void | Promise<void>;

export function usePressGuard(defaultDelayMs = 500) {
  const lastPressedAtRef = useRef<Record<string, number>>({});

  return useCallback(
    (key: string, handler: GuardedHandler, delayMs?: number) => {
      const cooldown = typeof delayMs === 'number' ? delayMs : defaultDelayMs;
      const now = Date.now();
      const lastPressedAt = lastPressedAtRef.current[key] || 0;

      if (now - lastPressedAt < cooldown) {
        return;
      }

      lastPressedAtRef.current[key] = now;
      Promise.resolve(handler()).catch(() => {
        // Keep silent to avoid swallowing screen-level error handling/toasts.
      });
    },
    [defaultDelayMs],
  );
}
