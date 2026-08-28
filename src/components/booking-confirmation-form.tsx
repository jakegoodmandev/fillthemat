"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useState } from "react";
import { readConversationToken } from "./browser-token";
import { readLandingSessionToken } from "./landing-session";

export type ConfirmationValues = {
  schoolName: string;
  slug: string;
  offeringId: string;
  offeringName: string;
  slotId: string;
  whenLabel: string;
  location: string | null;
  participantName: string;
  participantAge: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export function BookingConfirmationForm({
  values,
  onBooked,
}: {
  values: ConfirmationValues;
  onBooked: (result: { offeringName: string; whenLabel: string }) => void;
}) {
  const [contactName, setContactName] = useState(values.contactName);
  const [contactEmail, setContactEmail] = useState(values.contactEmail);
  const [contactPhone, setContactPhone] = useState(values.contactPhone);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const keyResponse = await fetch("/api/bookings/key", { method: "POST" });
      const { idempotencyKey } = (await keyResponse.json()) as {
        idempotencyKey: string;
      };
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schoolSlug: values.slug,
          offeringId: values.offeringId,
          slotId: values.slotId,
          idempotencyKey,
          contact: {
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
          },
          participant: {
            name: values.participantName,
            age: values.participantAge,
          },
          turnstileToken,
          landingSessionToken: readLandingSessionToken(values.slug),
          conversationResumeToken: readConversationToken(values.slug),
        }),
      });
      if (!response.ok) {
        setError(
          "Could not complete this booking. Try another time or leave a note.",
        );
        return;
      }
      onBooked({
        offeringName: values.offeringName,
        whenLabel: values.whenLabel,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm"
    >
      <h2 className="text-base font-semibold">Confirm your trial</h2>
      <p>{values.schoolName}</p>
      <p>{values.offeringName}</p>
      <p>
        {values.participantName}, age {values.participantAge}
      </p>
      <p>{values.whenLabel}</p>
      {values.location ? <p>{values.location}</p> : null}
      <input
        required
        value={contactName}
        onChange={(event) => setContactName(event.target.value)}
        placeholder="Adult name"
        className="rounded-md border border-zinc-300 px-3 py-2"
      />
      <input
        required
        type="email"
        value={contactEmail}
        onChange={(event) => setContactEmail(event.target.value)}
        placeholder="Email"
        className="rounded-md border border-zinc-300 px-3 py-2"
      />
      <input
        required
        value={contactPhone}
        onChange={(event) => setContactPhone(event.target.value)}
        placeholder="Phone"
        className="rounded-md border border-zinc-300 px-3 py-2"
      />
      {siteKey ? (
        <Turnstile siteKey={siteKey} onSuccess={setTurnstileToken} />
      ) : (
        <p className="text-red-600">Turnstile is not configured.</p>
      )}
      {error ? <p className="text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || !turnstileToken}
        className="h-11 rounded-full bg-zinc-950 text-white disabled:opacity-50"
      >
        {pending ? "Booking…" : "Confirm trial"}
      </button>
    </form>
  );
}
