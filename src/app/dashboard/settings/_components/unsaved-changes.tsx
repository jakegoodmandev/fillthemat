"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type UnsavedChangesValue = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  confirmNavigation: () => boolean;
};

const UnsavedChangesContext = createContext<UnsavedChangesValue | null>(null);

const LEAVE_MESSAGE =
  "You have unsaved changes. Discard them and leave this section?";

export function UnsavedChangesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const confirmNavigation = useCallback(() => {
    if (!dirty) return true;
    const allowed = window.confirm(LEAVE_MESSAGE);
    if (allowed) setDirty(false);
    return allowed;
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = (event.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      if (target.target && target.target !== "_self") return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const next = new URL(href, window.location.href);
      if (
        next.pathname === window.location.pathname &&
        next.search === window.location.search
      ) {
        return;
      }
      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      setDirty(false);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  const value = useMemo(
    () => ({ dirty, setDirty, confirmNavigation }),
    [dirty, confirmNavigation],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const value = useContext(UnsavedChangesContext);
  if (!value) {
    throw new Error(
      "useUnsavedChanges must be used within UnsavedChangesProvider",
    );
  }
  return value;
}

export function useSectionDirty() {
  const { setDirty } = useUnsavedChanges();
  useEffect(() => () => setDirty(false), [setDirty]);
  return {
    markDirty: () => setDirty(true),
    markClean: () => setDirty(false),
  };
}
