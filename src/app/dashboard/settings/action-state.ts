export type SettingsActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
};

export const idleSettingsActionState: SettingsActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

export function successState(message: string): SettingsActionState {
  return { status: "success", message, fieldErrors: {} };
}

export function errorState(
  message: string,
  fieldErrors: Record<string, string> = {},
): SettingsActionState {
  return { status: "error", message, fieldErrors };
}
