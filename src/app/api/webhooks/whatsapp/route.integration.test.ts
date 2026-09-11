import { createHmac, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  conversations,
  messages,
  schools,
  users,
  whatsappDeliveries,
  whatsappJobs,
} from "@/db/schema";
import { hashWaId } from "@/lib/crypto";
import {
  WHATSAPP_MAX_BODY_BYTES,
  WHATSAPP_STUB_APP_SECRET,
  WHATSAPP_STUB_VERIFY_TOKEN,
} from "@/lib/whatsapp/config";
import { runWhatsAppWorkerOnce } from "@/lib/whatsapp/worker";
import textInbound from "@/test/fixtures/whatsapp/text-inbound.json";
import {
  authSql,
  deleteAuthUser,
  insertAuthUser,
  loadLocalEnv,
} from "@/test/integration-env";
import { GET, POST } from "./route";

loadLocalEnv();

const db = getDb();
const sql = authSql();
const suffix = randomUUID().slice(0, 8);
const ownerId = randomUUID();
const phoneNumberId = `199${Date.now().toString().slice(-9)}`;
const slug = `wa-${suffix}`;
const waId = "16505551234";
let schoolId = "";

function sign(body: string, secret = WHATSAPP_STUB_APP_SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

type MetaPayload = {
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: string };
            contacts: [{ wa_id: string; profile: { name: string } }];
            messages: [
              {
                from: string;
                id: string;
                type: string;
                text: { body: string };
              },
            ];
          };
        },
      ];
    },
  ];
};

function inboundPayload(): MetaPayload {
  const payload = structuredClone(textInbound as unknown as MetaPayload);
  payload.entry[0].changes[0].value.metadata.phone_number_id = phoneNumberId;
  payload.entry[0].changes[0].value.contacts[0].wa_id = waId;
  payload.entry[0].changes[0].value.messages[0].from = waId;
  // wamids are globally unique in production; use a per-run id so the global
  // `whatsapp_jobs.dedupe_key` uniqueness never collides across test runs.
  payload.entry[0].changes[0].value.messages[0].id = `wamid.p4.${suffix}`;
  return payload;
}

function post(payload: unknown, secret = WHATSAPP_STUB_APP_SECRET): Request {
  const body = JSON.stringify(payload);
  return new Request("http://127.0.0.1:3000/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": sign(body, secret),
    },
    body,
  });
}

async function jobCount() {
  const rows = await db.select().from(whatsappJobs);
  return rows.filter((row) => row.phoneNumberId === phoneNumberId).length;
}

async function messageRows() {
  return db
    .select({ id: messages.id, role: messages.role })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.schoolId, schoolId));
}

async function deliveryRows() {
  return db
    .select()
    .from(whatsappDeliveries)
    .where(eq(whatsappDeliveries.schoolId, schoolId));
}

async function conversationForWa(id: string) {
  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.schoolId, schoolId),
        eq(conversations.waIdHash, hashWaId(id)),
      ),
    )
    .limit(1);
  return rows[0];
}

beforeAll(async () => {
  await insertAuthUser(sql, ownerId, `wa-${suffix}@local.test`);
  await db.insert(users).values({
    id: ownerId,
    email: `wa-${suffix}@local.test`,
    name: "WA Owner",
  });
  const [school] = await db
    .insert(schools)
    .values({
      ownerUserId: ownerId,
      name: "WhatsApp School",
      slug,
      timezone: "America/New_York",
      notificationEmail: `wa-${suffix}@local.test`,
      whatsappPhoneNumberId: phoneNumberId,
      approvedAt: new Date(),
    })
    .returning({ id: schools.id });
  if (!school) throw new Error("failed to seed school");
  schoolId = school.id;
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, ownerId));
  await deleteAuthUser(sql, ownerId);
  await sql.end({ timeout: 5 });
});

describe("POST /api/webhooks/whatsapp (enqueue-then-ack)", () => {
  it("enqueues a job instead of persisting inline", async () => {
    const response = await POST(post(inboundPayload()));
    expect(response.status).toBe(200);
    expect(await jobCount()).toBe(1);
    expect(await messageRows()).toHaveLength(0);
  });

  it("dedupes a replayed wamid to a single job row", async () => {
    await POST(post(inboundPayload()));
    expect(await jobCount()).toBe(1);
  });

  it("rejects a wrong signature with 401", async () => {
    const response = await POST(post(inboundPayload(), "wrong-secret"));
    expect(response.status).toBe(401);
  });

  it("rejects an oversized body with 413", async () => {
    const body = "x".repeat(WHATSAPP_MAX_BODY_BYTES + 1);
    const request = new Request("http://127.0.0.1:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": sign(body),
      },
      body,
    });
    const response = await POST(request);
    expect(response.status).toBe(413);
  });
});

describe("worker + status flow", () => {
  it("runs the agent to completion and advances delivery pending→claimed→sent", async () => {
    await runWhatsAppWorkerOnce(randomUUID());

    const rows = await messageRows();
    const userRows = rows.filter((row) => row.role === "user");
    const assistantRows = rows.filter((row) => row.role === "assistant");
    expect(userRows).toHaveLength(1);
    // The local AI stub produces a deterministic reply even without a model.
    expect(assistantRows).toHaveLength(1);

    const deliveries = await deliveryRows();
    expect(deliveries.length).toBeGreaterThanOrEqual(1);
    expect(deliveries[0].state).toBe("sent");
    expect(deliveries[0].providerId).toMatch(/^local-noop:/);

    const conversation = await conversationForWa(waId);
    expect(conversation).toBeTruthy();
    expect(conversation?.generatingAt).toBeNull();
  });

  it("applies a delivered status and ignores an older out-of-order status", async () => {
    const [delivery] = await deliveryRows();
    expect(delivery).toBeTruthy();

    const statusPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "test-waba",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: phoneNumberId },
                statuses: [
                  {
                    id: delivery?.providerId,
                    status: "delivered",
                    timestamp: "1700000000",
                    recipient_id: waId,
                  },
                  {
                    id: delivery?.providerId,
                    status: "read",
                    timestamp: "1600000000",
                    recipient_id: waId,
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    expect((await POST(post(statusPayload))).status).toBe(200);

    const [updated] = await deliveryRows();
    expect(updated.state).toBe("delivered");
  });

  it("does not double-write on a replayed wamid after processing", async () => {
    const before = await messageRows();
    await POST(post(inboundPayload()));
    expect(await jobCount()).toBe(1);
    await runWhatsAppWorkerOnce(randomUUID());
    const after = await messageRows();
    expect(after.length).toBe(before.length);
  });
});

describe("GET /api/webhooks/whatsapp", () => {
  it("echoes the challenge as text/plain for a matching verify token", async () => {
    const url = new URL("http://127.0.0.1:3000/api/webhooks/whatsapp");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", WHATSAPP_STUB_VERIFY_TOKEN);
    url.searchParams.set("hub.challenge", "challenge-123");
    const response = await GET(new Request(url.toString()));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe("challenge-123");
  });

  it("rejects a mismatched verify token with 403", async () => {
    const url = new URL("http://127.0.0.1:3000/api/webhooks/whatsapp");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", "wrong-token");
    url.searchParams.set("hub.challenge", "challenge-123");
    const response = await GET(new Request(url.toString()));
    expect(response.status).toBe(403);
  });
});
