"use client";

import { SettingsNav } from "./settings-nav";
import { UnsavedChangesProvider, useUnsavedChanges } from "./unsaved-changes";

export function SettingsShell({ children }: { children: React.ReactNode }) {
  return (
    <UnsavedChangesProvider>
      <main className="flex w-full max-w-5xl flex-col gap-6">
        <a
          href="#settings-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-20 focus:rounded-md focus:bg-zinc-100 focus:px-3 focus:py-2 focus:text-sm focus:text-zinc-950"
        >
          Skip to settings
        </a>
        <header className="flex flex-col gap-2">
          <h1 className="text-pretty text-2xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="max-w-2xl text-pretty text-sm text-zinc-400">
            Teach your agent about your school and manage the trial-booking
            experience.
          </p>
          <p className="max-w-2xl text-pretty text-sm text-zinc-500">
            Saving updates the live trial-booking experience immediately. There
            is no draft.
          </p>
        </header>
        <SettingsNav />
        <UnsavedNotice />
        <div id="settings-content">{children}</div>
      </main>
    </UnsavedChangesProvider>
  );
}

function UnsavedNotice() {
  const { dirty } = useUnsavedChanges();
  if (!dirty) return null;
  return (
    <p className="text-sm text-zinc-400" aria-live="polite">
      Unsaved changes
    </p>
  );
}
