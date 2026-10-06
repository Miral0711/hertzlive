import { createContext, useCallback, useContext, useState } from 'react';
import { stamp } from './model';

const FieldContext = createContext(null);

export function FieldProvider({ children }) {
  const [read, setRead] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('field-read') || '{}'); } catch { return {}; }
  });
  const [drafts, setDrafts] = useState({});

  const markRead = useCallback((threadId) => {
    setRead((prev) => {
      const next = { ...prev, [threadId]: stamp() };
      sessionStorage.setItem('field-read', JSON.stringify(next));
      return next;
    });
  }, []);

  const setDraft = useCallback((threadId, text) => {
    setDrafts((prev) => ({ ...prev, [threadId]: text }));
  }, []);

  return (
    <FieldContext.Provider value={{ read, markRead, drafts, setDraft }}>
      {children}
    </FieldContext.Provider>
  );
}

export const useField = () => useContext(FieldContext);
