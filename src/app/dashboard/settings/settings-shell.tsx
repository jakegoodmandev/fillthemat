"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SECTIONS, type SectionId, sectionHref } from "./sections";
import { dangerButtonClass, secondaryButtonClass } from "./ui/controls";
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
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <SettingsNav active={activeSection} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </DirtyProvider>
  );
}

function SettingsNav({ active }: { active: SectionId }) {
  const router = useRouter();
  const { dirtyKeys } = useDirtyState();
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    dialogRef.current?.showModal();
  };

  return (
    <>
      <nav
        aria-label="Settings categories"
        className="lg:w-52 lg:shrink-0 lg:self-start"
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
                  className={`block touch-manipulation rounded-lg border px-3 py-2 text-sm transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70 ${
                    isActive
                      ? "border-zinc-700 bg-zinc-900 text-zinc-100"
                      : "border-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium whitespace-nowrap">
                    {section.label}
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
                  <span className="mt-0.5 hidden text-xs text-zinc-500 lg:block">
                    {section.hint}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <dialog
        ref={dialogRef}
        onClose={() => setPendingHref(null)}
        aria-labelledby="settings-unsaved-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] overscroll-contain rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 backdrop:bg-black/60"
      >
        <h2
          id="settings-unsaved-title"
          className="text-base font-semibold text-balance"
        >
          Leave without saving?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400 text-pretty">
          You have changes that have not been saved yet. If you switch
          categories now, those edits are lost and your agent keeps using the
          information it has today.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              setPendingHref(null);
              dialogRef.current?.close();
            }}
          >
            Keep Editing
          </button>
          <button
            type="button"
            className={dangerButtonClass}
            onClick={() => {
              dialogRef.current?.close();
              if (pendingHref) router.push(pendingHref);
              setPendingHref(null);
            }}
          >
            Discard Changes
          </button>
        </div>
      </dialog>
    </>
  );
}
