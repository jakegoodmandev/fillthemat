import { describe, expect, it } from "vitest";
import statusDelivered from "@/test/fixtures/whatsapp/status-delivered.json";
import statusFailed from "@/test/fixtures/whatsapp/status-failed.json";
import textInbound from "@/test/fixtures/whatsapp/text-inbound.json";
import { parseInboundWhatsAppStatuses } from "./status";

describe("parseInboundWhatsAppStatuses", () => {
  it("extracts a delivered status", () => {
    const parsed = parseInboundWhatsAppStatuses(statusDelivered);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      status: "delivered",
      wamid: "wamid.HBgLMjY1MDUSMTIzNDVBMUIx",
      recipientId: "16505551234",
      timestamp: 1690000010,
    });
  });

  it("extracts a failed status with its error", () => {
    const parsed = parseInboundWhatsAppStatuses(statusFailed);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].status).toBe("failed");
    expect(parsed[0].errorCode).toBe("131026");
  });

  it("returns an empty list for inbound payloads", () => {
    expect(parseInboundWhatsAppStatuses(textInbound)).toHaveLength(0);
  });

  it("skips unknown status values", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: "wamid.1", status: "bogus", timestamp: "1" }],
              },
            },
          ],
        },
      ],
    };
    expect(parseInboundWhatsAppStatuses(payload)).toHaveLength(0);
  });
});
