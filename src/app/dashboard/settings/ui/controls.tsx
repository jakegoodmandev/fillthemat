"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export const invalidInputClass = "border-destructive hover:border-destructive";

export const buttonBase =
  "inline-flex h-9 touch-manipulation items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer";

export const primaryButtonClass = `${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90`;
export const secondaryButtonClass = `${buttonBase} border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80`;
export const dangerButtonClass = `${buttonBase} bg-destructive text-destructive-foreground hover:bg-destructive/90`;
export const quietButtonClass = `${buttonBase} text-muted-foreground hover:text-foreground underline underline-offset-4 px-2`;

type BaseFieldProps = {
  label: string;
  name: string;
  helper?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** Shown next to the label, e.g. "Locked after publishing". */
  badge?: string;
};

function describedBy(
  helperId: string,
  helper: string | undefined,
  errorId: string,
  error: string | undefined,
): string | undefined {
  const ids = [helper ? helperId : null, error ? errorId : null].filter(
    Boolean,
  );
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function useFieldIds(name: string) {
  const uid = useId();
  return {
    controlId: `${uid}-${name}`,
    helperId: `${uid}-${name}-helper`,
    errorId: `${uid}-${name}-error`,
  };
}

function FieldShell({
  label,
  controlId,
  helperId,
  errorId,
  helper,
  error,
  required,
  badge,
  count,
  children,
}: {
  label: string;
  controlId: string;
  helperId: string;
  errorId: string;
  helper?: string;
  error?: string;
  required?: boolean;
  badge?: string;
  count?: { value: number; max: number };
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label
          htmlFor={controlId}
          className="text-sm font-medium text-foreground"
        >
          {label}
          {required ? (
            <span className="ml-1 text-muted-foreground" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {badge ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground bg-muted/30">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
      {helper || count ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          {helper ? (
            <p
              id={helperId}
              className="text-xs leading-relaxed text-muted-foreground"
            >
              {helper}
            </p>
          ) : null}
          {count ? (
            <p
              className={`text-xs tabular-nums ${
                count.value > count.max
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {count.value.toLocaleString("en-US")} /{" "}
              {count.max.toLocaleString("en-US")}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  helper,
  error,
  required,
  disabled,
  badge,
  value,
  onValueChange,
  type = "text",
  placeholder,
  maxLength,
  autoComplete = "off",
  spellCheck,
  inputMode,
  showCount = false,
  min,
  max,
  step,
  className,
}: BaseFieldProps & {
  value: string;
  onValueChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "url" | "number" | "time";
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
  spellCheck?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email" | "url";
  showCount?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const { controlId, helperId, errorId } = useFieldIds(name);
  return (
    <FieldShell
      label={label}
      controlId={controlId}
      helperId={helperId}
      errorId={errorId}
      helper={helper}
      error={error}
      required={required}
      badge={badge}
      count={
        showCount && maxLength
          ? { value: value.length, max: maxLength }
          : undefined
      }
    >
      <input
        id={controlId}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        inputMode={inputMode}
        min={min}
        max={max}
        step={step}
        aria-describedby={describedBy(helperId, helper, errorId, error)}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        className={cn(inputClass, error && invalidInputClass, className)}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  name,
  helper,
  error,
  required,
  disabled,
  badge,
  value,
  onValueChange,
  placeholder,
  maxLength,
  rows = 4,
  showCount = true,
}: BaseFieldProps & {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  showCount?: boolean;
}) {
  const { controlId, helperId, errorId } = useFieldIds(name);
  return (
    <FieldShell
      label={label}
      controlId={controlId}
      helperId={helperId}
      errorId={errorId}
      helper={helper}
      error={error}
      required={required}
      badge={badge}
      count={
        showCount && maxLength
          ? { value: value.length, max: maxLength }
          : undefined
      }
    >
      <textarea
        id={controlId}
        name={name}
        rows={rows}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-describedby={describedBy(helperId, helper, errorId, error)}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        className={cn(inputClass, "resize-y", error && invalidInputClass)}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  helper,
  error,
  required,
  disabled,
  badge,
  value,
  onValueChange,
  options,
}: BaseFieldProps & {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  const { controlId, helperId, errorId } = useFieldIds(name);
  return (
    <FieldShell
      label={label}
      controlId={controlId}
      helperId={helperId}
      errorId={errorId}
      helper={helper}
      error={error}
      required={required}
      badge={badge}
    >
      <select
        id={controlId}
        name={name}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        aria-describedby={describedBy(helperId, helper, errorId, error)}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        className={cn(
          inputClass,
          "bg-background text-foreground",
          error && invalidInputClass,
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-4 sm:p-5">
      <legend className="px-1 text-sm font-semibold text-foreground">
        {title}
      </legend>
      {description ? (
        <p className="-mt-2 text-xs leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      ) : null}
      {children}
    </fieldset>
  );
}

export function Callout({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "locked" | "warning";
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-border bg-card text-muted-foreground",
    locked: "border-border bg-muted/40 text-muted-foreground",
    warning: "border-amber-800/40 bg-amber-950/20 text-amber-200",
  } as const;
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed text-pretty",
        tones[tone],
      )}
    >
      {title ? <p className="font-medium text-foreground">{title}</p> : null}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "muted" | "active" | "warning";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-border text-foreground bg-muted/40",
    muted: "border-border text-muted-foreground bg-muted/20",
    active: "border-emerald-800/40 bg-emerald-950/60 text-emerald-300",
    warning: "border-amber-800/40 bg-amber-950/60 text-amber-300",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border px-4 py-6 sm:px-6">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
        {children}
      </p>
      {action}
    </div>
  );
}
