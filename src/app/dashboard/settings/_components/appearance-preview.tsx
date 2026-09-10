"use client";

import { useState } from "react";
import { ghostButtonClassName } from "./styles";

function PreviewLogo({
  logoUrl,
  schoolName,
  accent,
}: {
  logoUrl: string;
  schoolName: string;
  accent: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!logoUrl.startsWith("https://") || failed) {
    return (
      <div
        className="flex h-12 w-12 items-center justify-center rounded-lg text-xs font-medium text-white"
        style={{ backgroundColor: accent }}
        aria-hidden="true"
      >
        Logo
      </div>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: tenant logos are arbitrary HTTPS URLs
    <img
      src={logoUrl}
      alt={`${schoolName || "School"} logo`}
      width={120}
      height={48}
      className="h-12 w-auto max-w-full"
      onError={() => setFailed(true)}
    />
  );
}

export function AppearancePreview({
  schoolName,
  location,
  logoUrl,
  primaryColor,
  welcomeMessage,
  saved,
  className = "",
}: {
  schoolName: string;
  location: string | null;
  logoUrl: string;
  primaryColor: string;
  welcomeMessage: string;
  saved: boolean;
  className?: string;
}) {
  const accent = /^#[0-9A-Fa-f]{6}$/.test(primaryColor)
    ? primaryColor
    : "#111111";

  return (
    <aside className={`flex min-w-0 flex-col gap-3 ${className}`}>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-zinc-200">Preview</h3>
        <p className="text-pretty text-sm text-zinc-400">
          {saved
            ? "This is a representative look at your saved logo, color, and welcome message. It is not a test of what your agent will say."
            : "This preview includes unsaved edits. Parents will not see these values until you save."}
        </p>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-white p-4 text-zinc-950">
        <PreviewLogo
          key={logoUrl}
          logoUrl={logoUrl}
          schoolName={schoolName}
          accent={accent}
        />
        <h4 className="mt-3 text-pretty text-xl font-semibold tracking-tight break-words">
          {schoolName || "Your school"}
        </h4>
        {location ? (
          <p className="break-words text-zinc-600">{location}</p>
        ) : null}
        <div className="mt-4 min-h-36 rounded-2xl border border-zinc-200 p-4 text-sm">
          <p className="whitespace-pre-wrap break-words text-zinc-600">
            {welcomeMessage.trim() ||
              "Your welcome message will appear here when you add one in Agent."}
          </p>
          <div
            className="mt-4 h-9 w-28 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
        </div>
      </div>
    </aside>
  );
}

export function PreviewSwitch({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <div className="mb-3 lg:hidden">
        <button
          type="button"
          className={ghostButtonClassName}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide preview" : "Show preview"}
        </button>
      </div>
      <div className={open ? "block" : "hidden lg:block"}>{children}</div>
    </div>
  );
}
