import { createContext, useContext } from 'react';
import type { AppData, Concept } from '../types';
export interface Store {
  data: AppData;
  concepts: Concept[];
  conceptMap: Record<string, Concept>;
  update: (fn: (old: AppData) => AppData) => void;
  toggleFavorite: (kind: keyof AppData['favorites'], id: string) => void;
  notify: (message: string) => void;
}
export const StoreContext = createContext<Store | null>(null);
export function useStore(): Store {
  const value = useContext(StoreContext);
  if (!value) throw new Error('Missing workspace');
  return value;
}
