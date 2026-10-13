import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { StoreContext } from '../hooks/store';
import type { AppData } from '../types';
import { readData, writeData } from '../services/storage';
import { X } from 'lucide-react';
import { createCatalog } from '../utils/catalog';
export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(readData);
  const [data, setData] = useState(loaded.data);
  const ref = useRef(data);
  const catalog = useMemo(() => createCatalog(data.customConcepts), [data.customConcepts]);
  const [toast, notify] = useState('');
  const [warning, setWarning] = useState(loaded.warning);
  const update = useCallback((fn: (old: AppData) => AppData) => {
    const next = fn(ref.current);
    ref.current = next;
    setData(next);
    setWarning(writeData(next));
  }, []);
  const toggleFavorite = useCallback(
    (kind: keyof AppData['favorites'], id: string) => {
      update((old) => ({
        ...old,
        favorites: {
          ...old.favorites,
          [kind]: old.favorites[kind].includes(id)
            ? old.favorites[kind].filter((v) => v !== id)
            : [...old.favorites[kind], id],
        },
      }));
    },
    [update],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => notify(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <StoreContext.Provider value={{ data, ...catalog, update, toggleFavorite, notify }}>
      {warning && (
        <div className="storage-warning" role="alert">
          {warning}
          <button onClick={() => setWarning('')} aria-label="关闭提示">
            <X size={16} />
          </button>
        </div>
      )}
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button onClick={() => notify('')} aria-label="关闭提示">
            <X size={16} />
          </button>
        </div>
      )}
    </StoreContext.Provider>
  );
}
