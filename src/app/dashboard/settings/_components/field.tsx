import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { inputClassName, textareaClassName } from "./styles";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ id, label, hint, error, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-200">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-pretty text-sm text-zinc-400">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p
          id={errorId}
          className="text-pretty text-sm text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "name" | "className"
> & {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({
  id,
  name,
  label,
  hint,
  error,
  ...inputProps
}: InputProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={inputClassName}
        {...inputProps}
      />
    </Field>
  );
}

type AreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "name" | "className"
> & {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  maxLength?: number;
};

export function TextAreaField({
  id,
  name,
  label,
  hint,
  error,
  maxLength,
  defaultValue,
  onInput,
  ...areaProps
}: AreaProps) {
  const describedBy = [
    error ? `${id}-error` : null,
    hint ? `${id}-hint` : null,
    maxLength ? `${id}-count` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={textareaClassName}
        onInput={onInput}
        {...areaProps}
      />
    </Field>
  );
}

type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id" | "name" | "className"
> & {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function SelectField({
  id,
  name,
  label,
  hint,
  error,
  children,
  ...selectProps
}: SelectProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={inputClassName}
        {...selectProps}
      >
        {children}
      </select>
    </Field>
  );
}

export function CharacterCount({
  id,
  count,
  max,
}: {
  id: string;
  count: number;
  max: number;
}) {
  return (
    <p id={id} className="text-xs tabular-nums text-zinc-500">
      {count.toLocaleString()} / {max.toLocaleString()}
    </p>
  );
}
