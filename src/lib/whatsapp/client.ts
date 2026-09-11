import { isLocalWhatsAppNoop } from "@/lib/dev-flags";
import {
  whatsappApiVersion,
  whatsappGraphBase,
  whatsappSystemUserToken,
} from "./config";
import { whatsappTemplateComponents } from "./templates";

export type WhatsAppSendOutcome =
  | { ok: true; providerId: string | null }
  | { ok: false; code: number | null; message: string };

export const WHATSAPP_WINDOW_CLOSED_CODE = 131030;

type GraphError = {
  code?: number;
  error_subcode?: number;
  message?: string;
};

function graphPost(
  phoneNumberId: string,
  payload: Record<string, unknown>,
): Promise<WhatsAppSendOutcome> {
  const token = whatsappSystemUserToken();
  if (!token) {
    if (isLocalWhatsAppNoop()) {
      console.info(
        `[local whatsapp noop] POST ${phoneNumberId}/messages: ${JSON.stringify(payload)}`,
      );
      return Promise.resolve({ ok: true, providerId: null });
    }
    return Promise.resolve({
      ok: false,
      code: null,
      message: "WHATSAPP_SYSTEM_USER_TOKEN is not set",
    });
  }

  const url = `${whatsappGraphBase()}/${whatsappApiVersion()}/${phoneNumberId}/messages`;
  return fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then(async (response) => {
      const json = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: GraphError;
      };
      if (json.error) {
        return {
          ok: false as const,
          code: json.error.code ?? json.error.error_subcode ?? null,
          message: json.error.message ?? "graph_error",
        };
      }
      const providerId = json.messages?.[0]?.id ?? null;
      return { ok: true as const, providerId };
    })
    .catch((error) => ({
      ok: false as const,
      code: null,
      message: error instanceof Error ? error.message : "send_failed",
    }));
}

export function sendWhatsAppText({
  phoneNumberId,
  to,
  text,
}: {
  phoneNumberId: string;
  to: string;
  text: string;
}): Promise<WhatsAppSendOutcome> {
  return graphPost(phoneNumberId, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: text },
  });
}

export function sendWhatsAppTemplate({
  phoneNumberId,
  to,
  templateName,
  languageCode,
  params,
}: {
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode: string;
  params: unknown[];
}): Promise<WhatsAppSendOutcome> {
  const components = whatsappTemplateComponents(params);
  return graphPost(phoneNumberId, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  });
}

export function sendWhatsAppInteractive({
  phoneNumberId,
  to,
  body,
  buttons,
}: {
  phoneNumberId: string;
  to: string;
  body: string;
  buttons: Array<{ id: string; title: string }>;
}): Promise<WhatsAppSendOutcome> {
  return graphPost(phoneNumberId, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((button) => ({
          type: "reply",
          reply: { id: button.id, title: button.title },
        })),
      },
    },
  });
}
