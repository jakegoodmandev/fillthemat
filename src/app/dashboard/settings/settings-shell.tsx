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
import { cn } from "@/lib/utils";
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
      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
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

  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>("a[aria-current='page']");
    if (!list || !current || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft =
      current.offsetLeft - (list.clientWidth - current.clientWidth) / 2;
  }, []);

  const guard = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
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
          className="-mx-1 flex gap-1 overflow-x-auto overscroll-x-contain px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-x-visible lg:px-0 lg:pb-0"
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
                  className={cn(
                    "block touch-manipulation rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/70",
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    {section.label}
                    {dirtyHere ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-warning"
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
        open={pendingHref !== null}
        onOpenChange={(open) => {
          if (!open) setPendingHref(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have changes that have not been saved yet. If you switch
              categories now, those edits are lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingHref) router.push(pendingHref);
                setPendingHref(null);
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
