import { createHmac, randomUUID } from "node:crypto";
import { addDays } from "date-fns";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { conversations, messages, schools, users } from "@/db/schema";
import { hashWaId } from "@/lib/crypto";
import { MAX_CHAT_MESSAGES_PER_CONVERSATION } from "@/lib/security/limits";
import {
  WHATSAPP_MAX_BODY_BYTES,
  WHATSAPP_STUB_APP_SECRET,
  WHATSAPP_STUB_VERIFY_TOKEN,
} from "@/lib/whatsapp/config";
import statusDelivered from "@/test/fixtures/whatsapp/status-delivered.json";
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
            contacts: [{ wa_id: string }];
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

async function messageCount() {
  const rows = await db
    .select()
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.schoolId, schoolId));
  return rows.length;
}

async function conversationCount() {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.schoolId, schoolId));
  return rows.length;
}

async function conversationForWa(waId: string) {
  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.schoolId, schoolId),
        eq(conversations.waIdHash, hashWaId(waId)),
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
    })
    .returning({ id: schools.id });
  if (!school) throw new Error("failed to seed school");
  schoolId = school.id;
});

afterAll(async () => {
  // Deleting the app user cascades to school -> conversations -> messages;
  // then remove the matching auth user row.
  await db.delete(users).where(eq(users.id, ownerId));
  await deleteAuthUser(sql, ownerId);
  await sql.end({ timeout: 5 });
});

describe("POST /api/webhooks/whatsapp", () => {
  it("persists an inbound message into a new conversation", async () => {
    const response = await POST(post(inboundPayload()));
    expect(response.status).toBe(200);
    expect(await messageCount()).toBe(1);
    expect(await conversationCount()).toBe(1);
  });

  it("dedupes a replayed wamid to a single message row", async () => {
    await POST(post(inboundPayload()));
    await POST(post(inboundPayload()));
    expect(await messageCount()).toBe(1);
    expect(await conversationCount()).toBe(1);
  });

  it("routes a second distinct message from the same wa_id into one conversation", async () => {
    const payload = inboundPayload();
    payload.entry[0].changes[0].value.messages[0].id = "wamid.second-message";
    payload.entry[0].changes[0].value.messages[0].text.body = "What times?";
    const response = await POST(post(payload));
    expect(response.status).toBe(200);
    expect(await messageCount()).toBe(2);
    expect(await conversationCount()).toBe(1);
  });

  it("acks status payloads without writing a message row", async () => {
    const before = await messageCount();
    const response = await POST(post(statusDelivered));
    expect(response.status).toBe(200);
    expect(await messageCount()).toBe(before);
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

  it("releases generatingAt after persisting an inbound message", async () => {
    const payload = inboundPayload();
    payload.entry[0].changes[0].value.messages[0].id = "wamid.release-lock";
    const response = await POST(post(payload));
    expect(response.status).toBe(200);
    const conversation = await conversationForWa("16505551234");
    expect(conversation).toBeTruthy();
    expect(conversation?.generatingAt).toBeNull();
  });

  it("serializes concurrent inbound on the same conversation", async () => {
    const before = await messageCount();
    const first = inboundPayload();
    first.entry[0].changes[0].value.messages[0].id = "wamid.concurrent-a";
    const second = inboundPayload();
    second.entry[0].changes[0].value.messages[0].id = "wamid.concurrent-b";

    const [firstResponse, secondResponse] = await Promise.all([
      POST(post(first)),
      POST(post(second)),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(await messageCount()).toBe(before + 2);
    expect(await conversationCount()).toBe(1);
    const conversation = await conversationForWa("16505551234");
    expect(conversation?.generatingAt).toBeNull();
  });

  it("caps a conversation at MAX_CHAT_MESSAGES_PER_CONVERSATION", async () => {
    const capWaId = "16505559999";
    const seed = inboundPayload();
    seed.entry[0].changes[0].value.contacts[0].wa_id = capWaId;
    seed.entry[0].changes[0].value.messages[0].from = capWaId;
    seed.entry[0].changes[0].value.messages[0].id = "wamid.cap-seed";
    expect((await POST(post(seed))).status).toBe(200);

    const conversation = await conversationForWa(capWaId);
    expect(conversation).toBeTruthy();

    const purgeAt = addDays(new Date(), 30);
    const fill = MAX_CHAT_MESSAGES_PER_CONVERSATION - 1;
    if (fill > 0) {
      await db.insert(messages).values(
        Array.from({ length: fill }, (_, i) => ({
          conversationId: conversation!.id,
          messageId: `wamid.cap-fill-${i}`,
          role: "user" as const,
          parts: [{ type: "text", text: `fill ${i}` }],
          completion: "complete" as const,
          purgeAt,
        })),
      );
    }

    const over = inboundPayload();
    over.entry[0].changes[0].value.contacts[0].wa_id = capWaId;
    over.entry[0].changes[0].value.messages[0].from = capWaId;
    over.entry[0].changes[0].value.messages[0].id = "wamid.cap-over";
    expect((await POST(post(over))).status).toBe(200);

    const rows = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversationId, conversation!.id));
    expect(rows.length).toBe(MAX_CHAT_MESSAGES_PER_CONVERSATION);
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
