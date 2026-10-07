import React, { createContext, useCallback, useContext, useState } from 'react';
import { stamp } from '../store';

type Field = {
  read: Record<string, string>;
  markRead: (threadId: string) => void;
  drafts: Record<string, string>;
  setDraft: (threadId: string, text: string) => void;
};
const FieldContext = createContext<Field>(null as unknown as Field);

export function FieldProvider({ children }: { children: React.ReactNode }) {
  const [read, setRead] = useState<Record<string, string>>(() => {
    try { return JSON.parse(sessionStorage.getItem('field-read') || '{}'); } catch { return {}; }
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const markRead = useCallback((threadId: string) => {
    setRead((prev) => {
      const next = { ...prev, [threadId]: stamp() };
      sessionStorage.setItem('field-read', JSON.stringify(next));
      return next;
    });
  }, []);
  const setDraft = useCallback((threadId: string, text: string) => {
    setDrafts((prev) => ({ ...prev, [threadId]: text }));
  }, []);

  return <FieldContext.Provider value={{ read, markRead, drafts, setDraft }}>{children}</FieldContext.Provider>;
}

export const useField = () => useContext(FieldContext);
