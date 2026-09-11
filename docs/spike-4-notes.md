# Spike 4 Report: WhatsApp Cloud API Contract

This spike outlines the complete API contract, authentication, signature verification, message payloads, 24-hour customer service window constraints, and a robust local-test harness approach for integrating Meta's WhatsApp Cloud API into Fillthemat.

---

## 1. Findings

Based on Meta's developer documentation, the WhatsApp Business Platform OpenAPI specifications, and the project's architecture, here are the core findings for the WhatsApp Cloud API integration.

### A. Meta App Setup & Use-Cases
1. **Creation & Configuration:** The integration begins by navigating to `https://developers.facebook.com/apps/creation/`, entering app details, and selecting the **"Connect with customers through WhatsApp"** use case.
2. **Products & Assets:** Once selected, Meta automatically provisions the WhatsApp product in the App Dashboard.
3. **App Secrets:** The Meta App provides an **App ID** and **App Secret** (used to verify incoming POST webhook signatures) and generates a temporary developer token.
4. **App Association:** The app must be connected to a verified/unverified **Meta Business Portfolio**. Certain production permissions require Business Verification.

### B. System User & Permanent Token Permissions
1. **System User Role:** Since temporary access tokens expire within 24 hours, a **System User** (specifically an **Admin System User**) must be created in Meta Business Settings (`business.facebook.com/latest/settings`).
2. **Asset Assignment:** The System User must be assigned **Full Control** over:
   - The **Meta App** asset (via `Manage app`).
   - The **WhatsApp Business Account (WABA)** asset (via `Manage WhatsApp Business accounts`).
3. **Required Permanent Token Permissions:** Generating the system token requires checking exactly three permissions:
   - `whatsapp_business_messaging`: Enables sending free-form and template messages.
   - `whatsapp_business_management`: Enables managing templates and phone numbers.
   - `business_management`: Grants general access to read and manage linked business assets.

### C. Identifiers (Phone Number ID vs. WABA ID)
1. **WhatsApp Business Account (WABA) ID:** This represents the overall business container under the Meta Business Portfolio. Webhooks and message templates are registered and configured at the WABA level.
2. **Phone Number ID (`phone_number_id`):** This represents a specific phone number registered within a WABA.
3. **Multi-Tenancy Mapping:**
   - **Send Path:** Outbound HTTP POST requests are sent to the unique endpoint of the `phone_number_id`, not the WABA ID:
     `POST https://graph.facebook.com/v23.0/<phone_number_id>/messages`
   - **Webhook Payload:** Webhook notifications arrive with both the `metadata.phone_number_id` and the parent WABA ID on the `entry[].id` field.
   - **Database Schema Mapping:** To support multi-tenancy, the `schools` table should be extended to map a school to its `phone_number_id` and WABA ID, or we must introduce a `school_whatsapp_configs` table.

### D. Webhook Verification & Security Handshake
The webhook server endpoint (`/api/webhooks/whatsapp`) must handle two types of requests:

1. **GET Verification Handshake (Subscribing Webhook):**
   When configuring a webhook in Meta's Dashboard, Meta sends a GET request with query parameters:
   - `hub.mode` (must be `"subscribe"`)
   - `hub.challenge` (a random string)
   - `hub.verify_token` (a developer-defined static string, e.g. stored in `WHATSAPP_VERIFY_TOKEN`)
   
   *Action:* The server must verify that the incoming `hub.verify_token` matches our configured env secret. If valid, return `hub.challenge` as plain text (status `200 OK`). If invalid, return status `403 Forbidden`.

2. **POST Event Notifications & Signature Verification (`X-Hub-Signature-256`):**
   Every event notification is sent via POST. To guarantee authenticity, Meta signs the raw request payload using the App Secret and includes it in the header:
   - Header: `X-Hub-Signature-256` (value format: `sha256=<hmac_sha256_hex>`)
   
   *Action:* The server must parse the raw, unparsed request body, compute the SHA-256 HMAC using the `META_APP_SECRET` as the key, and verify it against the signature provided in the header using secure timing-safe comparison (`crypto.timingSafeEqual`).

### E. Message Send & Status Webhook Shapes
1. **Outbound Free-form (Text) Payload:**
   ```json
   {
     "messaging_product": "whatsapp",
     "recipient_type": "individual",
     "to": "<prospect_phone>",
     "type": "text",
     "text": { "body": "Hello! Let's book your martial arts trial." }
   }
   ```
2. **Outbound Template Payload:**
   ```json
   {
     "messaging_product": "whatsapp",
     "recipient_type": "individual",
     "to": "<prospect_phone>",
     "type": "template",
     "template": {
       "name": "booking_confirmation_utility",
       "language": { "code": "en_US" },
       "components": [
         {
           "type": "body",
           "parameters": [
             { "type": "text", "text": "Jessica" },
             { "type": "text", "text": "Brazilian Jiu-Jitsu" },
             { "type": "text", "text": "Tuesday, 5:30 PM" }
           ]
         }
       ]
     }
   }
   ```
3. **Outbound Send Response:**
   ```json
   {
     "messaging_product": "whatsapp",
     "contacts": [{ "input": "17863559966", "wa_id": "17863559966" }],
     "messages": [{ "id": "wamid.HBgLMTc4NjM1NTk5NjYVAGHAYWYET688aASGNTI1QzZFQjhEMDk2QQA=" }]
   }
   ```
4. **Inbound Webhook Payload (Message Received):**
   ```json
   {
     "object": "whatsapp_business_account",
     "entry": [{
       "id": "<WABA_ID>",
       "changes": [{
         "value": {
           "messaging_product": "whatsapp",
           "metadata": { "display_phone_number": "15551797781", "phone_number_id": "<phone_number_id>" },
           "contacts": [{ "profile": { "name": "Jessica Laverdetman" }, "wa_id": "17863559966" }],
           "messages": [{
             "from": "17863559966",
             "id": "wamid.HBgLMTc4NjM1NTk5NjYVAGHAYWYET688aASGNTI1QzZFQjhEMDk2QQA=",
             "timestamp": "1758254144",
             "text": { "body": "Hi, I would like to sign up for a trial class." },
             "type": "text"
           }]
         },
         "field": "messages"
       }]
     }]
   }
   ```
5. **Inbound Webhook Payload (Status Update):**
   ```json
   {
     "object": "whatsapp_business_account",
     "entry": [{
       "id": "<WABA_ID>",
       "changes": [{
         "value": {
           "messaging_product": "whatsapp",
           "metadata": { "display_phone_number": "15551797781", "phone_number_id": "<phone_number_id>" },
           "statuses": [{
             "id": "wamid.HBgLMTc4NjM1NTk5NjYVAGHAYWYET688aASGNTI1QzZFQjhEMDk2QQA=",
             "status": "delivered", // "sent" | "delivered" | "read" | "failed"
             "timestamp": "1758254150",
             "recipient_id": "17863559966",
             "errors": [] // Present if status is "failed"
           }]
         },
         "field": "messages"
       }]
     }]
   }
   ```

### F. 24-Hour Customer Service Window Constraints
1. **Window Trigger:** The customer service window is opened or reset *only* when the business receives an inbound message from the user. It lasts exactly 24 hours from the timestamp of the last incoming message.
2. **Allowed Messages:**
   - **Inside the 24h Window:** The business can send free-form text or media messages (allowing natural, open-ended AI conversation generated by our Booking Agent).
   - **Outside the 24h Window:** The API will reject free-form messages with error code `131030` ("Recipient phone number not in allowed list or customer service window closed"). The business *must* initiate communication with an approved **Template Message**.
3. **Template Categories:** Meta supports `UTILITY`, `AUTHENTICATION`, and `MARKETING`. Follow-up reminders or outbound re-engagement fits the `UTILITY` category.

### G. Graph API Version
1. **Current Production Version:** The current authoritative API version is `v23.0`, as cited in the latest Meta developer platform guidelines.
2. **Implementation Strategy:** All API endpoint paths must be parameterized to easily swap versions via an environment variable (e.g., `META_GRAPH_API_VERSION=v23.0`).

### H. Local-Test Approach (Without real phone number / Meta credentials)
To align with the project's "degradable vendor adapter" design philosophy:
1. **Degradable Outbound Client (`src/lib/whatsapp/client.ts`):**
   - If `process.env.NODE_ENV !== "production"` and `process.env.META_SYSTEM_USER_TOKEN` is missing/placeholder, swap the real HTTP request with a mock file logger or an in-memory queue.
   - Print outbound payloads to standard output or log to `tmp/whatsapp-outbound.log` in JSON format.
2. **Inbound Webhook Simulator (`POST /api/dev/whatsapp/simulate-inbound`):**
   - A developer-only route that generates realistic Meta inbound payloads.
   - It hashes the simulated body using HMAC-SHA-256 with the local `META_APP_SECRET` and fires an internal HTTP POST request to the local webhook endpoint (`/api/webhooks/whatsapp`) with the calculated `X-Hub-Signature-256` header.
   - This exercises the complete signature verification, database contact resolving, Booking Agent processing loop, and simulated outbound dispatch entirely offline!

---

## 2. Evidence

The following snippets and documentation quotes demonstrate how these constraints align with the existing code structure and authoritative references.

### GET Webhook Verification & POST Signature Verification Patterns
From `src/app/api/webhooks/resend/route.ts:8-30`, the codebase already relies on unparsed text body validation and secure verification headers for webhooks:
```typescript
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "unconfigured" }, { status: 500 });

  const payload = await request.text();
  if (Buffer.byteLength(payload, "utf8") > MAX_BODY_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  let event: ReturnType<ReturnType<typeof getResend>["webhooks"]["verify"]>;
  try {
    event = getResend().webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
...
```

For Meta's `X-Hub-Signature-256`, we will write a similar signature check:
```typescript
import crypto from "node:crypto";

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expectedSignature = signatureHeader.substring(7); // Remove "sha256="
  
  const computedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
    
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(computedSignature, "hex")
    );
  } catch {
    return false;
  }
}
```

### Meta App Setup Evidence (Verbatim Reference Doc 1 & 2)
```
"Use cases define the main ways your app will interact with Meta's platform... select one or more Use Cases... Connect with customers through WhatsApp."
"Create an app with Meta... Business settings -> System users -> Add+. ... Generate token -> add permissions: business_management, whatsapp_business_messaging, whatsapp_business_management."
```

### 24-Hour Window Constraints Evidence (Verbatim Reference Doc 2 Step 6)
```
"Step 6: Send a non-template message — works only while a customer service window is open (user replied within 24h)."
```

---

## 3. Contradictions/Lacunae

During this spike pass, several details could not be fully confirmed from the documentation alone:
1. **Webhook Payload Multi-Messages:** When a user sends rapid sequential messages, does Meta batch them into a single webhook POST under `changes[].value.messages[]`, or does it dispatch separate POST requests for each message? 
   - *Doc says:* Payload format contains an array of `messages`.
   - *Real-world reality:* In almost all high-throughput cases, Meta sends a separate POST request per message to maintain order, but the payload definition remains an array. We must write our webhook parser defensively to handle single-element arrays but iterate over `messages` nonetheless to avoid dropping batched frames.
2. **Template Variable Validation:** How strictly does Meta validate parameter types and lengths during a template POST? 
   - *Doc says:* "type: text" parameter.
   - *Real-world reality:* String parameters must fit within maximum template body bounds. Passing long values or fields with special characters can fail silently or return validation errors on delivery.
3. **Tenant-Level Webhook Scoping:** Does Meta allow multi-tenant setups where a single app receives webhooks for multiple distinct business accounts?
   - *Doc says:* A single Meta App can manage multiple WhatsApp accounts if they are associated with the same Meta Business Portfolio or onboarded via Embedded Signup.
   - *Impact:* The payload identifies the specific WABA ID (`entry[].id`) and phone number (`metadata.phone_number_id`). We can safely multiplex incoming webhooks to the correct school by querying their configured identifier in our database.

---

## 4. Risks & Gotchas

1. **The Crucial Signature Raw Body Pitfall:** Next.js Route Handlers (specifically App Router `/api/webhooks/whatsapp/route.ts`) sometimes automatically parse JSON bodies or strip raw white-spaces. If `request.json()` is parsed before calculating the signature, the verification will **always fail** because exact string representation (spaces, formatting) determines the HMAC value.
   - *Mitigation:* Always use `request.text()` to extract the exact string payload first, perform signature verification, and *then* parse it via `JSON.parse(payload)`.
2. **Concurrent Webhook Race Conditions:** WhatsApp sends status updates ("delivered", "read") almost instantly. If status updates arrive *before* our outbound send transaction finishes writing the message status to the database, we risk getting out-of-order state overwrites.
   - *Mitigation:* The status tracking must use timestamps and check that the update timestamp is newer than the current database state before writing, or use an append-only status log.
3. **Contact Model Friction (The required Email Constraint):**
   - Under `src/db/schema.ts:241-255`, the `contacts` table has a strict `email` constraint:
     `email: text("email").notNull()`
     and a unique key on `unique("contacts_school_email").on(t.schoolId, t.email)`.
   - On WhatsApp, we have the prospect's phone number (`contacts.phone`) but **no email** initially.
   - *Severe Risk:* If we attempt to insert a WhatsApp prospect into `contacts` without an email address, the transaction will fail due to the `notNull()` constraint.
   - *Mitigation:* We must propose one of:
     1. Altering the database schema to make `contacts.email` nullable and adding a new index `uniqueIndex("contacts_school_phone").on(t.schoolId, t.phone)`.
     2. Assigning a synthetic placeholder email (e.g., `whatsapp_17863559966@whatsapp.invalid`) when a WhatsApp contact starts a session, which can later be updated once the prospect provides a real email during the booking agent's flow.
4. **The "Out-of-Window" Assistant Lockout:** If an automated follow-up (e.g. reminder) is sent, or if the agent attempts to reply 24 hours and 1 minute after the prospect's last text, Meta will block the free-form text send.
   - *Mitigation:* The outbound delivery loop must check `Date.now() - last_inbound_at > 24 hours` and block free-form assistant messages, prompting either a manual intervention flag or triggering a pre-approved utility template message.

---

## 5. Open Questions

1. **How should we resolve the Contacts Email Nullability constraint?**
   - *Option A:* Refactor the database model via a Drizzle migration to make `contacts.email` nullable, allowing clean phone-first records.
   - *Option B:* Keep `contacts.email` not-null and use the `wa_id@whatsapp.invalid` synthetic email strategy. This avoids risky schema migrations on existing production contacts but adds data noise.
   - *Recommendation:* Option A. A mobile-first channel requires phone-primary identities; making `email` nullable is the cleaner, long-term architectural path.
2. **Tenancy Model Choice:**
   - Are we registering a single platform-owned WhatsApp Business App where all schools share one WABA or multiple phone numbers under one WABA? Or does each school link its own WABA?
   - *Recommendation:* For V1/Pilot, we should use a **single shared WhatsApp App and WABA**, where each participating school is allocated a distinct `phone_number_id` registered within our WABA. This keeps authentication simple and centralized under one System User token.
3. **Landing Sessions Mapping:**
   - The tables `leads` and `conversations` reference `landing_sessions.id`.
   - On WhatsApp, there is no browser session or UTM parameters unless the user landed on a `/s/<slug>` web page and clicked a "Chat on WhatsApp" button containing a personalized ref-string parameter (e.g., `https://wa.me/...&text=ref_session_id`).
   - How should we associate a WhatsApp conversation with a `landing_session`?
   - *Recommendation:* If the user initiates the chat organically (without a web ref-string), we should dynamically provision a dummy `landing_session` record with `utmSource = "whatsapp"` to preserve database foreign key integrity without throwing constraint exceptions.
