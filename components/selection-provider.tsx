"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  addItem,
  readSelection,
  removeItem,
  writeSelection,
  type SelectedItem,
} from "@/lib/selection";

type SelectionContextValue = {
  items: SelectedItem[];
  add: (item: SelectedItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SelectedItem[]>([]);

  useEffect(() => {
    // Hydrate from localStorage after mount (unavailable during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readSelection());
  }, []);

  const add = useCallback((item: SelectedItem) => {
    setItems((curr) => {
      const next = addItem(curr, item);
      writeSelection(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((curr) => {
      const next = removeItem(curr, id);
      writeSelection(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    writeSelection([]);
    setItems([]);
  }, []);

  const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  return (
    <SelectionContext.Provider value={{ items, add, remove, clear, has }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within a SelectionProvider");
  return ctx;
}
