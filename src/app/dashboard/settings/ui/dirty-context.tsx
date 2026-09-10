"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DirtyContextValue = {
  setDirty: (key: string, dirty: boolean) => void;
  dirtyKeys: readonly string[];
};

const DirtyContext = createContext<DirtyContextValue>({
  setDirty: () => {},
  dirtyKeys: [],
});

function isModifiedClick(event: MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * Tracks which settings forms hold unsaved edits. While any form is dirty it
 * warns on three exit paths: the browser tab/route unload (`beforeunload`),
 * settings category navigation, and app-owned links that leave the settings
 * route entirely (e.g. the dashboard header's Overview/Bookings/Leads).

 * Browser Back/Forward is deliberately not intercepted — the Next.js App Router
 * owns history and a popstate cannot be prevented per-navigation; see
 * `docs/settings-ux-first-pass.md`.
 */
export function DirtyProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [dirtyKeys, setDirtyKeys] = useState<string[]>([]);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const hasUnsaved = dirtyKeys.length > 0;

  const setDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyKeys((previous) => {
      const has = previous.includes(key);
      if (dirty === has) return previous;
      return dirty ? [...previous, key] : previous.filter((k) => k !== key);
    });
  }, []);

  useEffect(() => {
    if (!hasUnsaved) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const anchor = (event.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      const href = anchor?.getAttribute("href");
      if (!href?.startsWith("/") || href.startsWith("#")) return;
      event.preventDefault();
      setPendingHref(href);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, [hasUnsaved]);

  const value = useMemo(() => ({ setDirty, dirtyKeys }), [setDirty, dirtyKeys]);

  return (
    <DirtyContext value={value}>
      {children}
      <AlertDialog
        open={pendingHref !== null}
        onOpenChange={(open) => {
          if (!open) setPendingHref(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have changes that have not been saved yet. If you leave now,
              those edits are lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const href = pendingHref;
                setPendingHref(null);
                if (href) router.push(href);
              }}
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DirtyContext>
  );
}

export function useDirtyState() {
  return useContext(DirtyContext);
}

/** Report this form's unsaved state to the shell. */
export function useDirtyRegistration(key: string, dirty: boolean) {
  const { setDirty } = useDirtyState();
  useEffect(() => {
    setDirty(key, dirty);
    return () => setDirty(key, false);
  }, [key, dirty, setDirty]);
}
