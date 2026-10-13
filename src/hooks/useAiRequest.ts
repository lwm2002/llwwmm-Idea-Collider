import { useCallback, useEffect, useRef } from 'react';

/** One request per operation; abort on unmount and ignore late results. */
export function useAiRequest() {
  const active = useRef<AbortController | null>(null);
  const start = useCallback(() => {
    if (active.current) return null;
    const controller = new AbortController();
    active.current = controller;
    return controller;
  }, []);
  const finish = useCallback((controller: AbortController) => {
    if (active.current === controller) active.current = null;
  }, []);
  const cancel = useCallback(() => {
    active.current?.abort();
    active.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  return { start, finish, cancel };
}
