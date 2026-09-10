"use client";

import Image, { type ImageLoaderProps } from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createFaqAction,
  createOfferingAction,
  createWindowAction,
  deactivateWindowAction,
  deleteFaqAction,
  deleteWindowAction,
  type SettingsActionState,
  toggleOfferingAction,
  updateAgentAction,
  updateBrandingAction,
  updatePricingAction,
  updateProfileAction,
  updateWindowCapacityAction,
} from "./actions";
import { SETTINGS_SECTIONS, type SettingsSection } from "./settings-sections";

type SchoolSettings = {
  name: string;
  slug: string;
  timezone: string;
  published: boolean;
  notificationEmail: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string;
  parkingNotes: string | null;
  accessNotes: string | null;
  trialGuidance: string | null;
  pricing: string | null;
  welcomeMessage: string | null;
  agentInstructions: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
};

type Offering = {
  id: string;
  name: string;
  description: string | null;
  minimumAge: number | null;
  maximumAge: number | null;
  attire: string | null;
  active: boolean;
};

type ScheduleWindow = {
  id: string;
  trialOfferingId: string;
  offeringName: string;
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  capacity: number;
  label: string | null;
  active: boolean;
  hasOccurrence: boolean;
  maxFutureBooked: number;
};

type Faq = { id: string; question: string; answer: string };

type SettingsWorkspaceProps = {
  activeSection: SettingsSection;
  timezones: string[];
  school: SchoolSettings;
  offerings: Offering[];
  windows: ScheduleWindow[];
  faqs: Faq[];
};

type SettingsAction = (
  previousState: SettingsActionState,
  formData: FormData,
) => Promise<SettingsActionState>;

type ManagedFormProps = {
  id: string;
  action: SettingsAction;
  onDirtyChange: (id: string, dirty: boolean) => void;
  children: (
    state: SettingsActionState,
    pending: boolean,
    dirty: boolean,
  ) => ReactNode;
  className?: string;
  saveLabel?: string;
  pendingLabel?: string;
  resetOnSuccess?: boolean;
  confirmMessage?: string;
  onValuesChange?: (form: HTMLFormElement) => void;
  onResetValues?: () => void;
  onSuccess?: () => void;
};

const initialSettingsActionState: SettingsActionState = {
  status: "idle",
  message: "",
  submittedAt: 0,
};

const inputClass =
  "min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 hover:border-zinc-600 focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-500";
const textareaClass = `${inputClass} min-h-28 resize-y`;
const primaryButtonClass =
  "inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full bg-zinc-100 px-5 text-sm font-semibold text-zinc-950 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-wait disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full border border-zinc-700 px-4 text-sm font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass =
  "inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full px-3 text-sm font-medium text-red-300 hover:bg-red-950/60 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500";
const panelClass =
  "rounded-xl border border-zinc-800 bg-zinc-900/35 p-5 sm:p-6";

export function SettingsWorkspace({
  activeSection,
  timezones,
  school,
  offerings,
  windows,
  faqs,
}: SettingsWorkspaceProps) {
  const router = useRouter();
  const [dirtyForms, setDirtyForms] = useState<Set<string>>(() => new Set());
  const hasUnsavedChanges = dirtyForms.size > 0;
  const lastSettingsUrl = useRef(
    `/dashboard/settings?section=${activeSection}`,
  );
  lastSettingsUrl.current = `/dashboard/settings?section=${activeSection}`;

  const handleDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyForms((current) => {
      const next = new Set(current);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const message = "Discard your unsaved settings changes?";
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };
    const captureLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a") : null;
      if (!anchor || anchor.href === window.location.href) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        setDirtyForms(new Set());
      }
    };

    const handleHistoryNavigation = () => {
      if (window.confirm(message)) {
        setDirtyForms(new Set());
        return;
      }
      router.replace(lastSettingsUrl.current);
    };

    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", handleHistoryNavigation);
    document.addEventListener("click", captureLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", handleHistoryNavigation);
      document.removeEventListener("click", captureLink, true);
    };
  }, [hasUnsavedChanges, router]);

  const changeMobileSection = (section: SettingsSection) => {
    if (
      hasUnsavedChanges &&
      !window.confirm("Discard your unsaved settings changes?")
    ) {
      return;
    }
    setDirtyForms(new Set());
    router.push(`/dashboard/settings?section=${section}`);
  };

  const shared = { onDirtyChange: handleDirtyChange };

  return (
    <main id="main-content" className="mx-auto w-full max-w-7xl pb-16">
      <a
        href="#settings-content"
        className="sr-only z-50 rounded-md bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to Settings Content
      </a>
      <header className="mb-7 border-b border-zinc-800 pb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Settings
        </p>
        <h1 className="max-w-3xl text-pretty text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          Teach your agent about your school and manage the trial-booking
          experience.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Each save updates your live configuration immediately. Settings are
          saved one category at a time.
        </p>
      </header>

      <div className="mb-6 md:hidden">
        <label
          htmlFor="settings-category"
          className="mb-2 block text-sm font-medium text-zinc-200"
        >
          Settings Category
        </label>
        <select
          id="settings-category"
          value={activeSection}
          onChange={(event) =>
            changeMobileSection(event.target.value as SettingsSection)
          }
          className={inputClass}
        >
          {SETTINGS_SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid items-start gap-8 md:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
        <nav
          aria-label="Settings categories"
          className="sticky top-6 hidden md:block"
        >
          <ul className="space-y-1">
            {SETTINGS_SECTIONS.map((section, index) => {
              const active = section.id === activeSection;
              return (
                <li key={section.id}>
                  <Link
                    href={`/dashboard/settings?section=${section.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 touch-manipulation items-center gap-3 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
                      active
                        ? "bg-zinc-800 text-zinc-50"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-6 items-center justify-center rounded-md text-xs tabular-nums ${active ? "bg-zinc-700" : "bg-zinc-900"}`}
                    >
                      {index + 1}
                    </span>
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          id="settings-content"
          tabIndex={-1}
          className="min-w-0 scroll-mt-6"
        >
          <SectionIntroduction activeSection={activeSection} />
          {activeSection === "profile" ? (
            <ProfileSection school={school} timezones={timezones} {...shared} />
          ) : null}
          {activeSection === "offerings" ? (
            <OfferingsSection offerings={offerings} {...shared} />
          ) : null}
          {activeSection === "schedule" ? (
            <ScheduleSection
              offerings={offerings}
              windows={windows}
              {...shared}
            />
          ) : null}
          {activeSection === "pricing" ? (
            <PricingSection school={school} {...shared} />
          ) : null}
          {activeSection === "faqs" ? (
            <FaqsSection faqs={faqs} {...shared} />
          ) : null}
          {activeSection === "agent" ? (
            <AgentSection school={school} {...shared} />
          ) : null}
          {activeSection === "branding" ? (
            <BrandingSection school={school} {...shared} />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function SectionIntroduction({
  activeSection,
}: {
  activeSection: SettingsSection;
}) {
  const section = SETTINGS_SECTIONS.find((item) => item.id === activeSection);
  if (!section) return null;
  return (
    <div className="mb-6">
      <h2 className="text-pretty text-xl font-semibold text-zinc-50">
        {section.label}
      </h2>
      <p className="mt-1 text-sm leading-6 text-zinc-400">
        {section.description}.
      </p>
    </div>
  );
}

function ManagedForm({
  id,
  action,
  onDirtyChange,
  children,
  className,
  saveLabel,
  pendingLabel = "Saving…",
  resetOnSuccess = false,
  confirmMessage,
  onValuesChange,
  onResetValues,
  onSuccess,
}: ManagedFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialSettingsActionState,
  );
  const [dirty, setDirty] = useState(false);
  const [dismissedSubmission, setDismissedSubmission] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const handledSubmission = useRef(0);
  const focusedErrorSubmission = useRef(0);
  const displayState =
    dismissedSubmission === state.submittedAt
      ? initialSettingsActionState
      : state;

  const updateDirty = useCallback(
    (nextDirty: boolean) => {
      setDirty(nextDirty);
      onDirtyChange(id, nextDirty);
    },
    [id, onDirtyChange],
  );

  useEffect(() => {
    return () => onDirtyChange(id, false);
  }, [id, onDirtyChange]);

  useEffect(() => {
    if (
      state.status !== "validation" ||
      state.submittedAt === focusedErrorSubmission.current
    ) {
      return;
    }
    focusedErrorSubmission.current = state.submittedAt;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [state.status, state.submittedAt]);

  useEffect(() => {
    if (
      state.status !== "success" ||
      state.submittedAt === handledSubmission.current
    ) {
      return;
    }
    handledSubmission.current = state.submittedAt;
    if (resetOnSuccess) formRef.current?.reset();
    updateDirty(false);
    onSuccess?.();
  }, [onSuccess, resetOnSuccess, state.status, state.submittedAt, updateDirty]);

  const discard = () => {
    formRef.current?.reset();
    onResetValues?.();
    setDismissedSubmission(state.submittedAt);
    updateDirty(false);
  };

  const handleInput = (event: FormEvent<HTMLFormElement>) => {
    if (!dirty) updateDirty(true);
    if (state.status === "validation" || state.status === "error") {
      setDismissedSubmission(state.submittedAt);
    }
    onValuesChange?.(event.currentTarget);
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onInput={handleInput}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children(displayState, pending, dirty)}
      {saveLabel ? (
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <ActionFeedback
            state={displayState}
            pending={pending}
            dirty={dirty}
            pendingLabel={pendingLabel}
          />
          <div className="flex gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={discard}
              disabled={!dirty || pending}
              className={secondaryButtonClass}
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={pending}
              className={primaryButtonClass}
            >
              {pending ? pendingLabel : saveLabel}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function ActionFeedback({
  state,
  pending,
  dirty,
  pendingLabel = "Saving…",
}: {
  state: SettingsActionState;
  pending: boolean;
  dirty: boolean;
  pendingLabel?: string;
}) {
  let text = "";
  let color = "text-zinc-400";
  if (pending) text = pendingLabel;
  else if (state.status === "validation" || state.status === "error") {
    text = state.message;
    color = "text-red-300";
  } else if (dirty) {
    text = "Unsaved changes";
    color = "text-amber-300";
  } else if (state.status === "success") {
    text = state.message;
    color = "text-emerald-300";
  }

  return (
    <p aria-live="polite" className={`min-h-5 break-words text-sm ${color}`}>
      {text}
    </p>
  );
}

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string[];
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-zinc-200"
      >
        {label}
      </label>
      {children}
      {error?.[0] ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-300">
          {error[0]}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="mt-1.5 text-xs leading-5 text-zinc-500">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error: string[] | undefined, help?: string) {
  if (error?.[0]) return `${id}-error`;
  return help ? `${id}-help` : undefined;
}

function ProfileSection({
  school,
  timezones,
  onDirtyChange,
}: {
  school: SchoolSettings;
  timezones: string[];
  onDirtyChange: ManagedFormProps["onDirtyChange"];
}) {
  return (
    <ManagedForm
      id="profile-form"
      action={updateProfileAction}
      onDirtyChange={onDirtyChange}
      saveLabel="Save Profile"
      className="space-y-5"
    >
      {(state) => (
        <>
          <fieldset className={panelClass}>
            <legend className="px-1 text-base font-semibold text-zinc-100">
              School Details
            </legend>
            <p className="mb-5 mt-1 text-sm leading-6 text-zinc-400">
              These details identify your school to prospective students and
              parents.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="profile-name"
                label="School Name"
                error={state.fieldErrors?.name}
              >
                <input
                  id="profile-name"
                  name="name"
                  defaultValue={school.name}
                  required
                  maxLength={80}
                  autoComplete="organization"
                  aria-invalid={Boolean(state.fieldErrors?.name)}
                  aria-describedby={describedBy(
                    "profile-name",
                    state.fieldErrors?.name,
                  )}
                  className={inputClass}
                />
              </Field>
              <Field
                id="profile-slug"
                label="Public Page Address"
                error={state.fieldErrors?.slug}
                help={
                  school.published
                    ? "Locked after your school is published so existing links keep working."
                    : "Used in your public page URL. You can change it until publishing."
                }
              >
                <div className="flex min-w-0 items-center rounded-lg border border-zinc-700 bg-zinc-950 focus-within:ring-2 focus-within:ring-zinc-500/30">
                  <span
                    className="shrink-0 pl-3 text-sm text-zinc-600"
                    aria-hidden="true"
                  >
                    /s/
                  </span>
                  <input
                    id="profile-slug"
                    name="slug"
                    defaultValue={school.slug}
                    required={!school.published}
                    disabled={school.published}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(state.fieldErrors?.slug)}
                    aria-describedby={describedBy(
                      "profile-slug",
                      state.fieldErrors?.slug,
                      "help",
                    )}
                    className="min-h-11 min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-zinc-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-zinc-500"
                  />
                </div>
              </Field>
              <Field
                id="profile-timezone"
                label="School Timezone"
                error={state.fieldErrors?.timezone}
                help={
                  school.published
                    ? "Locked after publishing so trial times remain consistent."
                    : "All trial times are shown in this timezone."
                }
              >
                <select
                  id="profile-timezone"
                  name="timezone"
                  defaultValue={school.timezone}
                  disabled={school.published}
                  aria-invalid={Boolean(state.fieldErrors?.timezone)}
                  aria-describedby={describedBy(
                    "profile-timezone",
                    state.fieldErrors?.timezone,
                    "help",
                  )}
                  className={inputClass}
                >
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>

          <fieldset className={panelClass}>
            <legend className="px-1 text-base font-semibold text-zinc-100">
              Contact & Location
            </legend>
            <p className="mb-5 mt-1 text-sm leading-6 text-zinc-400">
              Parents may see these details. The notification email is only used
              to alert your school.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="profile-email"
                label="Notification Email"
                error={state.fieldErrors?.notificationEmail}
                help="Booking and lead alerts go here; prospects do not see it."
              >
                <input
                  id="profile-email"
                  name="notificationEmail"
                  type="email"
                  defaultValue={school.notificationEmail}
                  required
                  autoComplete="email"
                  spellCheck={false}
                  aria-invalid={Boolean(state.fieldErrors?.notificationEmail)}
                  aria-describedby={describedBy(
                    "profile-email",
                    state.fieldErrors?.notificationEmail,
                    "help",
                  )}
                  className={inputClass}
                />
              </Field>
              <Field
                id="profile-phone"
                label="Public Phone"
                error={state.fieldErrors?.phone}
                help="Your agent uses this when a parent needs to contact the school directly."
              >
                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  defaultValue={school.phone ?? ""}
                  maxLength={32}
                  autoComplete="tel"
                  placeholder="Example: (415) 555-0132"
                  aria-invalid={Boolean(state.fieldErrors?.phone)}
                  aria-describedby={describedBy(
                    "profile-phone",
                    state.fieldErrors?.phone,
                    "help",
                  )}
                  className={inputClass}
                />
              </Field>
              <Field
                id="profile-website"
                label="Website"
                error={state.fieldErrors?.website}
              >
                <input
                  id="profile-website"
                  name="website"
                  type="url"
                  defaultValue={school.website ?? ""}
                  maxLength={2048}
                  autoComplete="url"
                  placeholder="Example: https://yourschool.com"
                  aria-invalid={Boolean(state.fieldErrors?.website)}
                  aria-describedby={describedBy(
                    "profile-website",
                    state.fieldErrors?.website,
                  )}
                  className={inputClass}
                />
              </Field>
              <Field
                id="profile-address"
                label="Street Address"
                error={state.fieldErrors?.address}
              >
                <input
                  id="profile-address"
                  name="address"
                  defaultValue={school.address ?? ""}
                  maxLength={500}
                  autoComplete="street-address"
                  placeholder="Example: 123 Market Street"
                  aria-invalid={Boolean(state.fieldErrors?.address)}
                  aria-describedby={describedBy(
                    "profile-address",
                    state.fieldErrors?.address,
                  )}
                  className={inputClass}
                />
              </Field>
              <Field
                id="profile-city"
                label="City"
                error={state.fieldErrors?.city}
              >
                <input
                  id="profile-city"
                  name="city"
                  defaultValue={school.city ?? ""}
                  maxLength={80}
                  autoComplete="address-level2"
                  aria-invalid={Boolean(state.fieldErrors?.city)}
                  aria-describedby={describedBy(
                    "profile-city",
                    state.fieldErrors?.city,
                  )}
                  className={inputClass}
                />
              </Field>
              <Field
                id="profile-country"
                label="Country Code"
                error={state.fieldErrors?.country}
                help="Use the 2-letter code for your country."
              >
                <input
                  id="profile-country"
                  name="country"
                  defaultValue={school.country}
                  minLength={2}
                  maxLength={2}
                  autoComplete="country"
                  spellCheck={false}
                  placeholder="Example: US"
                  aria-invalid={Boolean(state.fieldErrors?.country)}
                  aria-describedby={describedBy(
                    "profile-country",
                    state.fieldErrors?.country,
                    "help",
                  )}
                  className={inputClass}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className={panelClass}>
            <legend className="px-1 text-base font-semibold text-zinc-100">
              Arrival Guidance
            </legend>
            <p className="mb-5 mt-1 text-sm leading-6 text-zinc-400">
              Help first-time students feel prepared without overloading them.
            </p>
            <div className="space-y-5">
              <Field
                id="profile-parking"
                label="Parking Notes"
                error={state.fieldErrors?.parkingNotes}
                help="Your agent uses this to explain where students can park."
              >
                <textarea
                  id="profile-parking"
                  name="parkingNotes"
                  defaultValue={school.parkingNotes ?? ""}
                  maxLength={2000}
                  rows={4}
                  autoComplete="off"
                  placeholder="Example: Free parking is behind the building…"
                  aria-invalid={Boolean(state.fieldErrors?.parkingNotes)}
                  aria-describedby={describedBy(
                    "profile-parking",
                    state.fieldErrors?.parkingNotes,
                    "help",
                  )}
                  className={textareaClass}
                />
              </Field>
              <Field
                id="profile-access"
                label="Building Access"
                error={state.fieldErrors?.accessNotes}
                help="Include entrance, stairs, reception, or accessibility details."
              >
                <textarea
                  id="profile-access"
                  name="accessNotes"
                  defaultValue={school.accessNotes ?? ""}
                  maxLength={2000}
                  rows={4}
                  autoComplete="off"
                  placeholder="Example: Enter through the blue side door…"
                  aria-invalid={Boolean(state.fieldErrors?.accessNotes)}
                  aria-describedby={describedBy(
                    "profile-access",
                    state.fieldErrors?.accessNotes,
                    "help",
                  )}
                  className={textareaClass}
                />
              </Field>
              <Field
                id="profile-guidance"
                label="Before the Trial Class"
                error={state.fieldErrors?.trialGuidance}
                help="General preparation that applies to every trial class."
              >
                <textarea
                  id="profile-guidance"
                  name="trialGuidance"
                  defaultValue={school.trialGuidance ?? ""}
                  maxLength={2000}
                  rows={4}
                  autoComplete="off"
                  placeholder="Example: Please arrive 10 minutes early…"
                  aria-invalid={Boolean(state.fieldErrors?.trialGuidance)}
                  aria-describedby={describedBy(
                    "profile-guidance",
                    state.fieldErrors?.trialGuidance,
                    "help",
                  )}
                  className={textareaClass}
                />
              </Field>
            </div>
          </fieldset>
        </>
      )}
    </ManagedForm>
  );
}

function OfferingsSection({
  offerings,
  onDirtyChange,
}: {
  offerings: Offering[];
  onDirtyChange: ManagedFormProps["onDirtyChange"];
}) {
  return (
    <div className="space-y-5">
      {offerings.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {offerings.map((offering) => (
            <li key={offering.id} className={`${panelClass} min-w-0`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold text-zinc-100">
                    {offering.name}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatAgeRange(offering)}
                  </p>
                </div>
                <StatusPill active={offering.active} />
              </div>
              <p className="mt-4 break-words text-sm leading-6 text-zinc-400">
                {offering.description ||
                  "No description yet. Your agent will rely on the name and age range."}
              </p>
              {offering.attire ? (
                <p className="mt-3 break-words text-sm text-zinc-300">
                  <span className="text-zinc-500">What to wear:</span>{" "}
                  {offering.attire}
                </p>
              ) : null}
              <ManagedForm
                id={`offering-${offering.id}`}
                action={toggleOfferingAction}
                onDirtyChange={onDirtyChange}
                className="mt-5 border-t border-zinc-800 pt-4"
              >
                {(state, pending) => (
                  <>
                    <input type="hidden" name="id" value={offering.id} />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <ActionFeedback
                        state={state}
                        pending={pending}
                        dirty={false}
                        pendingLabel="Updating…"
                      />
                      <button
                        type="submit"
                        disabled={pending}
                        className={secondaryButtonClass}
                      >
                        {pending
                          ? "Updating…"
                          : offering.active
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </div>
                  </>
                )}
              </ManagedForm>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No Trial Offerings Yet"
          description="Add the first trial class parents and students can choose."
        />
      )}

      <details className="group rounded-xl border border-zinc-800 bg-zinc-900/35">
        <summary className="flex min-h-14 cursor-pointer touch-manipulation list-none items-center justify-between px-5 font-medium text-zinc-100 hover:bg-zinc-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 [&::-webkit-details-marker]:hidden">
          Add a Trial Offering
          <span
            aria-hidden="true"
            className="text-xl text-zinc-500 group-open:rotate-45 motion-reduce:transform-none"
          >
            +
          </span>
        </summary>
        <ManagedForm
          id="new-offering"
          action={createOfferingAction}
          onDirtyChange={onDirtyChange}
          saveLabel="Add Offering"
          pendingLabel="Adding…"
          resetOnSuccess
          className="border-t border-zinc-800 p-5 sm:p-6"
        >
          {(state) => (
            <div className="grid gap-5">
              <Field
                id="offering-name"
                label="Offering Name"
                error={state.fieldErrors?.name}
                help="Use a name parents will recognize."
              >
                <input
                  id="offering-name"
                  name="name"
                  required
                  maxLength={80}
                  autoComplete="off"
                  placeholder="Example: Kids Beginner Trial"
                  aria-invalid={Boolean(state.fieldErrors?.name)}
                  aria-describedby={describedBy(
                    "offering-name",
                    state.fieldErrors?.name,
                    "help",
                  )}
                  className={inputClass}
                />
              </Field>
              <Field
                id="offering-description"
                label="Description"
                error={state.fieldErrors?.description}
                help="Explain who the class is for and what a new student can expect."
              >
                <textarea
                  id="offering-description"
                  name="description"
                  maxLength={2000}
                  rows={4}
                  autoComplete="off"
                  placeholder="Example: A friendly introduction to martial arts fundamentals…"
                  aria-invalid={Boolean(state.fieldErrors?.description)}
                  aria-describedby={describedBy(
                    "offering-description",
                    state.fieldErrors?.description,
                    "help",
                  )}
                  className={textareaClass}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="offering-min-age"
                  label="Minimum Age"
                  error={state.fieldErrors?.minimumAge}
                >
                  <input
                    id="offering-min-age"
                    name="minimumAge"
                    type="number"
                    min={0}
                    max={99}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Example: 6"
                    aria-invalid={Boolean(state.fieldErrors?.minimumAge)}
                    aria-describedby={describedBy(
                      "offering-min-age",
                      state.fieldErrors?.minimumAge,
                    )}
                    className={inputClass}
                  />
                </Field>
                <Field
                  id="offering-max-age"
                  label="Maximum Age"
                  error={state.fieldErrors?.maximumAge}
                >
                  <input
                    id="offering-max-age"
                    name="maximumAge"
                    type="number"
                    min={0}
                    max={99}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Example: 12"
                    aria-invalid={Boolean(state.fieldErrors?.maximumAge)}
                    aria-describedby={describedBy(
                      "offering-max-age",
                      state.fieldErrors?.maximumAge,
                    )}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field
                id="offering-attire"
                label="What to Wear"
                error={state.fieldErrors?.attire}
                help="Your agent uses this to help students arrive prepared."
              >
                <input
                  id="offering-attire"
                  name="attire"
                  maxLength={1000}
                  autoComplete="off"
                  placeholder="Example: Comfortable workout clothes; no uniform needed"
                  aria-invalid={Boolean(state.fieldErrors?.attire)}
                  aria-describedby={describedBy(
                    "offering-attire",
                    state.fieldErrors?.attire,
                    "help",
                  )}
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </ManagedForm>
      </details>
      <p className="text-xs leading-5 text-zinc-500">
        Offerings can be activated or deactivated, but not edited or deleted
        here yet.
      </p>
    </div>
  );
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function ScheduleSection({
  offerings,
  windows,
  onDirtyChange,
}: {
  offerings: Offering[];
  windows: ScheduleWindow[];
  onDirtyChange: ManagedFormProps["onDirtyChange"];
}) {
  const sortedWindows = windows.toSorted(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute,
  );
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-900/60 bg-blue-950/25 p-4 text-sm leading-6 text-blue-100">
        <p className="font-medium">How Schedule Changes Work</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-blue-200/75">
          <li>
            Deactivating a window stops new trial times without changing
            existing bookings.
          </li>
          <li>
            A window cannot be deleted after it has generated any class
            occurrence.
          </li>
          <li>
            Capacity cannot go below the most students already booked into a
            future class.
          </li>
        </ul>
      </div>

      {sortedWindows.length ? (
        DAYS.map((day, dayIndex) => {
          const dayWindows = sortedWindows.filter(
            (window) => window.dayOfWeek === dayIndex,
          );
          if (!dayWindows.length) return null;
          return (
            <section key={day} aria-labelledby={`day-${dayIndex}`}>
              <h3
                id={`day-${dayIndex}`}
                className="mb-2 text-sm font-semibold text-zinc-300"
              >
                {day}
              </h3>
              <ul className="space-y-3">
                {dayWindows.map((window) => (
                  <ScheduleWindowCard
                    key={window.id}
                    window={window}
                    onDirtyChange={onDirtyChange}
                  />
                ))}
              </ul>
            </section>
          );
        })
      ) : (
        <EmptyState
          title="No Weekly Trial Times Yet"
          description="Add a recurring window so parents can see available trial classes."
        />
      )}

      <details className="group rounded-xl border border-zinc-800 bg-zinc-900/35">
        <summary className="flex min-h-14 cursor-pointer touch-manipulation list-none items-center justify-between px-5 font-medium text-zinc-100 hover:bg-zinc-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 [&::-webkit-details-marker]:hidden">
          Add a Weekly Trial Time
          <span
            aria-hidden="true"
            className="text-xl text-zinc-500 group-open:rotate-45 motion-reduce:transform-none"
          >
            +
          </span>
        </summary>
        {offerings.length ? (
          <ManagedForm
            id="new-window"
            action={createWindowAction}
            onDirtyChange={onDirtyChange}
            saveLabel="Add Schedule Window"
            pendingLabel="Adding…"
            resetOnSuccess
            className="grid gap-5 border-t border-zinc-800 p-5 sm:p-6"
          >
            {(state) => (
              <>
                <Field
                  id="window-offering"
                  label="Trial Offering"
                  error={state.fieldErrors?.trialOfferingId}
                  help="Inactive offerings are labeled so you can avoid creating unavailable combinations."
                >
                  <select
                    id="window-offering"
                    name="trialOfferingId"
                    required
                    defaultValue=""
                    aria-invalid={Boolean(state.fieldErrors?.trialOfferingId)}
                    aria-describedby={describedBy(
                      "window-offering",
                      state.fieldErrors?.trialOfferingId,
                      "help",
                    )}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Choose an offering
                    </option>
                    {offerings.map((offering) => (
                      <option key={offering.id} value={offering.id}>
                        {offering.name}
                        {offering.active ? "" : " — inactive"}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    id="window-day"
                    label="Day"
                    error={state.fieldErrors?.dayOfWeek}
                  >
                    <select
                      id="window-day"
                      name="dayOfWeek"
                      defaultValue="1"
                      aria-invalid={Boolean(state.fieldErrors?.dayOfWeek)}
                      aria-describedby={describedBy(
                        "window-day",
                        state.fieldErrors?.dayOfWeek,
                      )}
                      className={inputClass}
                    >
                      {DAYS.map((day, index) => (
                        <option key={day} value={index}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    id="window-time"
                    label="Local Start Time"
                    error={state.fieldErrors?.startTime}
                    help="Shown in your school timezone."
                  >
                    <input
                      id="window-time"
                      name="startTime"
                      type="time"
                      defaultValue="18:00"
                      required
                      aria-invalid={Boolean(state.fieldErrors?.startTime)}
                      aria-describedby={describedBy(
                        "window-time",
                        state.fieldErrors?.startTime,
                        "help",
                      )}
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    id="window-duration"
                    label="Duration (Minutes)"
                    error={state.fieldErrors?.durationMinutes}
                  >
                    <input
                      id="window-duration"
                      name="durationMinutes"
                      type="number"
                      min={15}
                      step={5}
                      defaultValue={60}
                      required
                      inputMode="numeric"
                      autoComplete="off"
                      aria-invalid={Boolean(state.fieldErrors?.durationMinutes)}
                      aria-describedby={describedBy(
                        "window-duration",
                        state.fieldErrors?.durationMinutes,
                      )}
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    id="window-capacity"
                    label="Student Capacity"
                    error={state.fieldErrors?.capacity}
                  >
                    <input
                      id="window-capacity"
                      name="capacity"
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={8}
                      required
                      inputMode="numeric"
                      autoComplete="off"
                      aria-invalid={Boolean(state.fieldErrors?.capacity)}
                      aria-describedby={describedBy(
                        "window-capacity",
                        state.fieldErrors?.capacity,
                      )}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field
                  id="window-label"
                  label="Optional Label"
                  error={state.fieldErrors?.label}
                  help="Use this only when it helps distinguish this time, such as “After school.”"
                >
                  <input
                    id="window-label"
                    name="label"
                    maxLength={80}
                    autoComplete="off"
                    placeholder="Example: After school"
                    aria-invalid={Boolean(state.fieldErrors?.label)}
                    aria-describedby={describedBy(
                      "window-label",
                      state.fieldErrors?.label,
                      "help",
                    )}
                    className={inputClass}
                  />
                </Field>
              </>
            )}
          </ManagedForm>
        ) : (
          <div className="border-t border-zinc-800 p-5 text-sm text-zinc-400">
            Add an offering before creating a schedule window.
          </div>
        )}
      </details>
      <p className="text-xs leading-5 text-zinc-500">
        Deactivated schedule windows cannot be reactivated or generally edited.
        Add a new window when the day or time changes.
      </p>
    </div>
  );
}

function ScheduleWindowCard({
  window,
  onDirtyChange,
}: {
  window: ScheduleWindow;
  onDirtyChange: ManagedFormProps["onDirtyChange"];
}) {
  const hour = Math.floor(window.startMinute / 60);
  const minute = window.startMinute % 60;
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2020, 0, 1, hour, minute)));
  return (
    <li className={`${panelClass} min-w-0`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words font-semibold text-zinc-100">
            {window.offeringName}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            <span className="font-medium text-zinc-200">{time}</span> ·{" "}
            {window.durationMinutes} minutes · {window.capacity} students
          </p>
          {window.label ? (
            <p className="mt-1 break-words text-xs text-zinc-500">
              {window.label}
            </p>
          ) : null}
        </div>
        <StatusPill active={window.active} />
      </div>
      {window.maxFutureBooked > 0 ? (
        <p className="mt-4 rounded-lg bg-amber-950/35 px-3 py-2 text-xs leading-5 text-amber-200">
          At least {window.maxFutureBooked}{" "}
          {window.maxFutureBooked === 1 ? "student is" : "students are"} already
          booked in a future class. Capacity cannot go lower.
        </p>
      ) : null}
      <ManagedForm
        id={`capacity-${window.id}`}
        action={updateWindowCapacityAction}
        onDirtyChange={onDirtyChange}
        saveLabel="Save Capacity"
        className="mt-5"
      >
        {(state) => (
          <>
            <input type="hidden" name="id" value={window.id} />
            <Field
              id={`capacity-input-${window.id}`}
              label="Student Capacity"
              error={state.fieldErrors?.capacity}
              help="Updates future classes where the current booked count fits."
            >
              <input
                id={`capacity-input-${window.id}`}
                name="capacity"
                type="number"
                min={Math.max(1, window.maxFutureBooked)}
                max={50}
                defaultValue={window.capacity}
                required
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={Boolean(state.fieldErrors?.capacity)}
                aria-describedby={describedBy(
                  `capacity-input-${window.id}`,
                  state.fieldErrors?.capacity,
                  "help",
                )}
                className={`${inputClass} max-w-40`}
              />
            </Field>
          </>
        )}
      </ManagedForm>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
        {window.active ? (
          <SimpleActionForm
            id={`deactivate-window-${window.id}`}
            action={deactivateWindowAction}
            itemId={window.id}
            label="Deactivate Window"
            pendingLabel="Deactivating…"
            onDirtyChange={onDirtyChange}
          />
        ) : null}
        {!window.hasOccurrence ? (
          <SimpleActionForm
            id={`delete-window-${window.id}`}
            action={deleteWindowAction}
            itemId={window.id}
            label="Delete Window"
            pendingLabel="Deleting…"
            danger
            confirmMessage="Delete this schedule window? This cannot be undone."
            onDirtyChange={onDirtyChange}
          />
        ) : (
          <p className="self-center text-xs text-zinc-500">
            This window has generated classes, so it can be deactivated but not
            deleted.
          </p>
        )}
      </div>
    </li>
  );
}

function PricingSection({
  school,
  onDirtyChange,
}: {
  school: SchoolSettings;
  onDirtyChange: ManagedFormProps["onDirtyChange"];
}) {
  return (
    <ManagedForm
      id="pricing-form"
      action={updatePricingAction}
      onDirtyChange={onDirtyChange}
      saveLabel="Save Pricing"
      className={panelClass}
    >
      {(state) => (
        <>
          <div className="mb-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-400">
            Add the prices and conditions your agent may share. It will not
            invent discounts or turn this into structured plans. If a price is
            unknown, your agent will say so.
          </div>
          <Field
            id="pricing-text"
            label="Pricing Information"
            error={state.fieldErrors?.pricing}
            help="Up to 4,000 characters. Include trial fees, recurring prices, and any conditions in plain language."
          >
            <textarea
              id="pricing-text"
              name="pricing"
              defaultValue={school.pricing ?? ""}
              maxLength={4000}
              rows={12}
              autoComplete="off"
              placeholder={
                "Example:\nTrial class: Free\nMonthly membership: From $120 after the trial\nFamily discount: Contact the school for details"
              }
              aria-invalid={Boolean(state.fieldErrors?.pricing)}
              aria-describedby={describedBy(
                "pricing-text",
                state.fieldErrors?.pricing,
                "help",
              )}
              className={`${textareaClass} min-h-72`}
            />
          </Field>
          <p className="mt-2 text-right text-xs text-zinc-600">
            4,000-character limit
          </p>
        </>
      )}
    </ManagedForm>
  );
}

function FaqsSection({
  faqs,
  onDirtyChange,
}: {
  faqs: Faq[];
  onDirtyChange: ManagedFormProps["onDirtyChange"];
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-400">{faqs.length} of 20 FAQs</p>
        <span className="text-xs text-zinc-600">
          Answers go live when added
        </span>
      </div>
      {faqs.length ? (
        <ul className="space-y-3">
          {faqs.map((faq) => (
            <li key={faq.id} className={panelClass}>
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer touch-manipulation list-none items-start justify-between gap-4 font-medium text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 break-words pt-2">
                    {faq.question}
                  </span>
                  <span
                    aria-hidden="true"
                    className="pt-1 text-xl text-zinc-600 group-open:rotate-45 motion-reduce:transform-none"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">
                  {faq.answer}
                </p>
              </details>
              <div className="mt-4 border-t border-zinc-800 pt-3">
                <SimpleActionForm
                  id={`delete-faq-${faq.id}`}
                  action={deleteFaqAction}
                  itemId={faq.id}
                  label="Delete FAQ"
                  pendingLabel="Deleting…"
                  danger
                  confirmMessage={`Delete “${faq.question}”? This cannot be undone.`}
                  onDirtyChange={onDirtyChange}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No FAQs Yet"
          description="Add answers to the questions parents ask most often."
        />
      )}

      <details className="group rounded-xl border border-zinc-800 bg-zinc-900/35">
        <summary className="flex min-h-14 cursor-pointer touch-manipulation list-none items-center justify-between px-5 font-medium text-zinc-100 hover:bg-zinc-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 [&::-webkit-details-marker]:hidden">
          Add an FAQ
          <span
            aria-hidden="true"
            className="text-xl text-zinc-500 group-open:rotate-45 motion-reduce:transform-none"
          >
            +
          </span>
        </summary>
        {faqs.length < 20 ? (
          <ManagedForm
            id="new-faq"
            action={createFaqAction}
            onDirtyChange={onDirtyChange}
            saveLabel="Add FAQ"
            pendingLabel="Adding…"
            resetOnSuccess
            className="grid gap-5 border-t border-zinc-800 p-5 sm:p-6"
          >
            {(state) => (
              <>
                <Field
                  id="faq-question"
                  label="Parent’s Question"
                  error={state.fieldErrors?.question}
                  help="Try a question such as “What should my child wear?” or “Where can we park?”"
                >
                  <input
                    id="faq-question"
                    name="question"
                    required
                    maxLength={200}
                    autoComplete="off"
                    placeholder="Example: What should my child wear?"
                    aria-invalid={Boolean(state.fieldErrors?.question)}
                    aria-describedby={describedBy(
                      "faq-question",
                      state.fieldErrors?.question,
                      "help",
                    )}
                    className={inputClass}
                  />
                </Field>
                <Field
                  id="faq-answer"
                  label="Approved Answer"
                  error={state.fieldErrors?.answer}
                  help="Give only facts your school is comfortable sharing."
                >
                  <textarea
                    id="faq-answer"
                    name="answer"
                    required
                    maxLength={2000}
                    rows={6}
                    autoComplete="off"
                    placeholder="Example: Comfortable workout clothes are perfect for the first class…"
                    aria-invalid={Boolean(state.fieldErrors?.answer)}
                    aria-describedby={describedBy(
                      "faq-answer",
                      state.fieldErrors?.answer,
                      "help",
                    )}
                    className={textareaClass}
                  />
                </Field>
              </>
            )}
          </ManagedForm>
        ) : (
          <p className="border-t border-zinc-800 p-5 text-sm text-zinc-400">
            You have reached the 20-FAQ limit. Delete an FAQ before adding
            another.
          </p>
        )}
      </details>
      <p className="text-xs leading-5 text-zinc-500">
        FAQs can be added or deleted, but not edited or reordered here yet.
      </p>
    </div>
  );
}

function AgentSection({
  school,
  onDirtyChange,
}: {
  school: SchoolSettings;
  onDirtyChange: ManagedFormProps["onDirtyChange"];
}) {
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [welcomePreview, setWelcomePreview] = useState(
    school.welcomeMessage ?? "",
  );
  const [previewDirty, setPreviewDirty] = useState(false);
  const resetPreview = () => {
    setWelcomePreview(school.welcomeMessage ?? "");
    setPreviewDirty(false);
  };
  return (
    <div>
      <PreviewSwitch value={mobileView} onChange={setMobileView} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className={mobileView === "edit" ? "block" : "hidden lg:block"}>
          <ManagedForm
            id="agent-form"
            action={updateAgentAction}
            onDirtyChange={onDirtyChange}
            saveLabel="Save Agent Guidance"
            className="space-y-5"
            onValuesChange={(form) => {
              setWelcomePreview(
                String(new FormData(form).get("welcomeMessage") ?? ""),
              );
              setPreviewDirty(true);
            }}
            onResetValues={resetPreview}
            onSuccess={() => {
              setWelcomePreview((value) => value.trim());
              setPreviewDirty(false);
            }}
          >
            {(state) => (
              <>
                <section className={panelClass}>
                  <h3 className="font-semibold text-zinc-100">
                    Welcome Message
                  </h3>
                  <p className="mb-5 mt-1 text-sm leading-6 text-zinc-400">
                    A short opening shown before a parent starts asking
                    questions.
                  </p>
                  <Field
                    id="agent-welcome"
                    label="Welcome Message"
                    error={state.fieldErrors?.welcomeMessage}
                    help="Up to 1,000 characters. Keep it warm and useful."
                  >
                    <textarea
                      id="agent-welcome"
                      name="welcomeMessage"
                      defaultValue={school.welcomeMessage ?? ""}
                      maxLength={1000}
                      rows={5}
                      autoComplete="off"
                      placeholder="Example: Welcome! I can help you find the right trial class and answer questions about your first visit."
                      aria-invalid={Boolean(state.fieldErrors?.welcomeMessage)}
                      aria-describedby={describedBy(
                        "agent-welcome",
                        state.fieldErrors?.welcomeMessage,
                        "help",
                      )}
                      className={textareaClass}
                    />
                  </Field>
                </section>
                <section className={panelClass}>
                  <h3 className="font-semibold text-zinc-100">
                    Tone & Qualification
                  </h3>
                  <p className="mb-5 mt-1 text-sm leading-6 text-zinc-400">
                    Teach your agent how to sound and which appropriate
                    questions help match a student to a trial.
                  </p>
                  <Field
                    id="agent-instructions"
                    label="Owner Guidance"
                    error={state.fieldErrors?.agentInstructions}
                    help="Up to 2,000 characters. Example: “Be encouraging and concise. Ask whether the student has trained before.”"
                  >
                    <textarea
                      id="agent-instructions"
                      name="agentInstructions"
                      defaultValue={school.agentInstructions ?? ""}
                      maxLength={2000}
                      rows={9}
                      autoComplete="off"
                      placeholder="Example: Be welcoming and concise. Ask about prior experience before suggesting a class…"
                      aria-invalid={Boolean(
                        state.fieldErrors?.agentInstructions,
                      )}
                      aria-describedby={describedBy(
                        "agent-instructions",
                        state.fieldErrors?.agentInstructions,
                        "help",
                      )}
                      className={`${textareaClass} min-h-56`}
                    />
                  </Field>
                  <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                    <p className="text-sm font-medium text-zinc-200">
                      What This Guidance Cannot Change
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Your agent always follows your saved eligibility,
                      availability, honesty, privacy, payment, waiver, and
                      booking-confirmation rules. Guidance cannot override those
                      protections.
                    </p>
                  </div>
                </section>
              </>
            )}
          </ManagedForm>
        </div>
        <div className={mobileView === "preview" ? "block" : "hidden lg:block"}>
          <ExperiencePreview
            schoolName={school.name}
            logoUrl={school.logoUrl}
            color={school.primaryColor}
            welcome={welcomePreview}
            unsaved={previewDirty}
          />
        </div>
      </div>
    </div>
  );
}

function BrandingSection({
  school,
  onDirtyChange,
}: {
  school: SchoolSettings;
  onDirtyChange: ManagedFormProps["onDirtyChange"];
}) {
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [logoUrl, setLogoUrl] = useState(school.logoUrl ?? "");
  const [color, setColor] = useState(school.primaryColor ?? "");
  const [previewDirty, setPreviewDirty] = useState(false);
  const resetPreview = () => {
    setLogoUrl(school.logoUrl ?? "");
    setColor(school.primaryColor ?? "");
    setPreviewDirty(false);
  };
  const validPickerColor = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#E4E4E7";
  return (
    <div>
      <PreviewSwitch value={mobileView} onChange={setMobileView} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className={mobileView === "edit" ? "block" : "hidden lg:block"}>
          <ManagedForm
            id="branding-form"
            action={updateBrandingAction}
            onDirtyChange={onDirtyChange}
            saveLabel="Save Branding"
            className={panelClass}
            onResetValues={resetPreview}
            onSuccess={() => {
              setLogoUrl((value) => value.trim());
              setColor((value) => value.toUpperCase());
              setPreviewDirty(false);
            }}
          >
            {(state) => (
              <div className="space-y-5">
                <Field
                  id="branding-logo"
                  label="Logo URL"
                  error={state.fieldErrors?.logoUrl}
                  help="Paste a direct HTTPS image URL. File uploads are not supported."
                >
                  <input
                    id="branding-logo"
                    name="logoUrl"
                    type="url"
                    value={logoUrl}
                    onChange={(event) => {
                      setLogoUrl(event.target.value);
                      setPreviewDirty(true);
                    }}
                    maxLength={2048}
                    autoComplete="url"
                    spellCheck={false}
                    placeholder="Example: https://yourschool.com/logo.png"
                    aria-invalid={Boolean(state.fieldErrors?.logoUrl)}
                    aria-describedby={describedBy(
                      "branding-logo",
                      state.fieldErrors?.logoUrl,
                      "help",
                    )}
                    className={inputClass}
                  />
                </Field>
                <Field
                  id="branding-color"
                  label="Primary Color"
                  error={state.fieldErrors?.primaryColor}
                  help="Use a 6-digit hex color. The preview shows a representative customer-facing treatment."
                >
                  <div className="flex gap-3">
                    <input
                      aria-label="Choose primary color"
                      type="color"
                      value={validPickerColor}
                      onChange={(event) => {
                        setColor(event.target.value.toUpperCase());
                        setPreviewDirty(true);
                      }}
                      className="size-11 shrink-0 cursor-pointer touch-manipulation rounded-lg border border-zinc-700 bg-zinc-950 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                    />
                    <input
                      id="branding-color"
                      name="primaryColor"
                      value={color}
                      onChange={(event) => {
                        setColor(event.target.value);
                        setPreviewDirty(true);
                      }}
                      maxLength={7}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Example: #F97316"
                      pattern="#[0-9A-Fa-f]{6}"
                      aria-invalid={Boolean(state.fieldErrors?.primaryColor)}
                      aria-describedby={describedBy(
                        "branding-color",
                        state.fieldErrors?.primaryColor,
                        "help",
                      )}
                      className={`${inputClass} font-mono uppercase`}
                    />
                  </div>
                </Field>
              </div>
            )}
          </ManagedForm>
        </div>
        <div className={mobileView === "preview" ? "block" : "hidden lg:block"}>
          <ExperiencePreview
            schoolName={school.name}
            logoUrl={logoUrl}
            color={validPickerColor}
            welcome={school.welcomeMessage ?? ""}
            unsaved={previewDirty}
          />
        </div>
      </div>
    </div>
  );
}

function PreviewSwitch({
  value,
  onChange,
}: {
  value: "edit" | "preview";
  onChange: (value: "edit" | "preview") => void;
}) {
  return (
    <fieldset className="mb-4 grid grid-cols-2 rounded-lg border border-zinc-800 bg-zinc-900 p-1 lg:hidden">
      <legend className="sr-only">Editor and Preview</legend>
      <button
        type="button"
        onClick={() => onChange("edit")}
        aria-pressed={value === "edit"}
        className={`min-h-11 touch-manipulation rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${value === "edit" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => onChange("preview")}
        aria-pressed={value === "preview"}
        className={`min-h-11 touch-manipulation rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${value === "preview" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
      >
        Preview
      </button>
    </fieldset>
  );
}

function passthroughImageLoader({ src }: ImageLoaderProps) {
  return src;
}

function ExperiencePreview({
  schoolName,
  logoUrl,
  color,
  welcome,
  unsaved,
}: {
  schoolName: string;
  logoUrl: string | null;
  color: string | null;
  welcome: string;
  unsaved: boolean;
}) {
  const safeLogo = logoUrl && /^https:\/\//.test(logoUrl) ? logoUrl : null;
  const accent = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#E4E4E7";
  return (
    <aside
      className="sticky top-6 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950"
      aria-label="Visual preview"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Visual Preview
        </p>
        <span
          className={`text-xs ${unsaved ? "text-amber-300" : "text-emerald-300"}`}
        >
          {unsaved ? "Unsaved values" : "Saved values"}
        </span>
      </div>
      <div className="p-4">
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
          <div className="h-2" style={{ backgroundColor: accent }} />
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-800 text-sm font-bold text-zinc-300">
                {safeLogo ? (
                  <Image
                    loader={passthroughImageLoader}
                    unoptimized
                    src={safeLogo}
                    alt="School logo preview"
                    width={44}
                    height={44}
                    className="size-11 object-contain"
                  />
                ) : (
                  schoolName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {schoolName}
                </p>
                <p className="text-xs text-zinc-500">Trial class assistant</p>
              </div>
            </div>
            <div className="mt-5 rounded-xl rounded-tl-sm bg-zinc-800 p-3 text-sm leading-6 text-zinc-200">
              {welcome.trim() ||
                "Welcome! How can I help with your first trial class?"}
            </div>
            <div className="mt-4 h-11 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-xs text-zinc-600">
              Ask about a trial class…
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Representative appearance only. This preview does not test agent
          behavior or prove how every public page will render.
        </p>
      </div>
    </aside>
  );
}

function SimpleActionForm({
  id,
  action,
  itemId,
  label,
  pendingLabel,
  danger = false,
  confirmMessage,
  onDirtyChange,
}: {
  id: string;
  action: SettingsAction;
  itemId: string;
  label: string;
  pendingLabel: string;
  danger?: boolean;
  confirmMessage?: string;
  onDirtyChange: ManagedFormProps["onDirtyChange"];
}) {
  return (
    <ManagedForm
      id={id}
      action={action}
      onDirtyChange={onDirtyChange}
      confirmMessage={confirmMessage}
    >
      {(state, pending) => (
        <>
          <input type="hidden" name="id" value={itemId} />
          <button
            type="submit"
            disabled={pending}
            className={danger ? dangerButtonClass : secondaryButtonClass}
          >
            {pending ? pendingLabel : label}
          </button>
          {state.status !== "idle" ? (
            <div className="mt-2">
              <ActionFeedback
                state={state}
                pending={pending}
                dirty={false}
                pendingLabel={pendingLabel}
              />
            </div>
          ) : null}
        </>
      )}
    </ManagedForm>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-emerald-950 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/20 px-6 py-10 text-center">
      <h3 className="font-semibold text-zinc-200">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
        {description}
      </p>
    </div>
  );
}

function formatAgeRange(offering: Offering) {
  if (offering.minimumAge == null && offering.maximumAge == null)
    return "All ages";
  if (offering.minimumAge == null) return `Up to age ${offering.maximumAge}`;
  if (offering.maximumAge == null) return `Ages ${offering.minimumAge}+`;
  return `Ages ${offering.minimumAge}–${offering.maximumAge}`;
}
