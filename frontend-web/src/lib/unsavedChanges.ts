import { useEffect, useRef } from 'react';

const pending = new Set<symbol>();

export function confirmLeavingEditor() {
  return pending.size === 0 || window.confirm('Quitter cette page ? Les modifications non enregistrées seront perdues.');
}

export function useUnsavedChanges(dirty: boolean) {
  const id = useRef<symbol>(Symbol('unsaved-editor'));
  useEffect(() => {
    const key = id.current;
    if (dirty) pending.add(key);
    return () => { pending.delete(key); };
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}
