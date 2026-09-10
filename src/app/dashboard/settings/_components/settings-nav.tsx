"use client";

import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import {
  isSettingsCategorySlug,
  SETTINGS_CATEGORIES,
  settingsCategoryHref,
} from "../categories";
import { inputClassName } from "./styles";
import { useUnsavedChanges } from "./unsaved-changes";

export function SettingsNav() {
  const segment = useSelectedLayoutSegment();
  const current = segment ?? "profile";
  const router = useRouter();
  const { confirmNavigation } = useUnsavedChanges();

  return (
    <nav aria-label="Settings categories" className="flex flex-col gap-3">
      <div className="md:hidden">
        <label htmlFor="settings-category" className="sr-only">
          Settings category
        </label>
        <select
          id="settings-category"
          className={inputClassName}
          value={current}
          onChange={(event) => {
            const next = event.target.value;
            if (next === current || !isSettingsCategorySlug(next)) return;
            if (!confirmNavigation()) {
              event.target.value = current;
              return;
            }
            router.push(settingsCategoryHref(next));
          }}
        >
          {SETTINGS_CATEGORIES.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.label}
            </option>
          ))}
        </select>
      </div>
      <ul className="hidden flex-wrap gap-1 md:flex">
        {SETTINGS_CATEGORIES.map((category) => {
          const active = category.slug === current;
          return (
            <li key={category.slug}>
              <Link
                href={settingsCategoryHref(category.slug)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 touch-manipulation items-center rounded-full px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-100/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                  active
                    ? "bg-zinc-100 text-zinc-950"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                {category.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
