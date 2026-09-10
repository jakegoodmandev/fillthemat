"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { SECTIONS, type SectionId, sectionHref } from "./sections";
import { DirtyProvider, useDirtyState } from "./ui/dirty-context";

export function SettingsShell({
  activeSection,
  children,
}: {
  activeSection: SectionId;
  children: React.ReactNode;
}) {
  return (
    <DirtyProvider>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <SettingsNav active={activeSection} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </DirtyProvider>
  );
}

function SettingsNav({ active }: { active: SectionId }) {
  const router = useRouter();
  const { dirtyKeys } = useDirtyState();
  const listRef = useRef<HTMLUListElement>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const hasUnsaved = dirtyKeys.length > 0;

  // On small screens the categories scroll sideways; keep the current one in view.
  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>("a[aria-current='page']");
    if (!list || !current || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft =
      current.offsetLeft - (list.clientWidth - current.clientWidth) / 2;
  }, []);

  const guard = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Let the browser handle modifier clicks so links still open in new tabs.
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    if (!hasUnsaved) return;
    event.preventDefault();
    setPendingHref(href);
  };

  return (
    <>
      <nav
        aria-label="Settings categories"
        className="lg:w-44 lg:shrink-0 lg:self-start"
      >
        <ul
          ref={listRef}
          className="-mx-1 flex gap-1 overflow-x-auto overscroll-x-contain px-1 pb-2 lg:mx-0 lg:flex-col lg:overflow-x-visible lg:px-0 lg:pb-0"
        >
          {SECTIONS.map((section) => {
            const isActive = section.id === active;
            const href = sectionHref(section.id);
            const dirtyHere =
              isActive && dirtyKeys.some((key) => key.startsWith(section.id));
            return (
              <li key={section.id} className="shrink-0 lg:shrink">
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={(event) => guard(event, href)}
                  className={`block touch-manipulation rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2 whitespace-nowrap">
                    <span>{section.label}</span>
                    {dirtyHere ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-amber-400"
                        />
                        <span className="sr-only">Unsaved changes</span>
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <AlertDialog
        open={Boolean(pendingHref)}
        onOpenChange={(open) => {
          if (!open) setPendingHref(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in this category. If you switch
              categories now, your edits will be discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingHref(null)}>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = pendingHref;
                setPendingHref(null);
                if (target) router.push(target);
              }}
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
