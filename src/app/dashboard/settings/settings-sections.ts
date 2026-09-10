export const SETTINGS_SECTIONS = [
  {
    id: "profile",
    label: "Profile",
    description: "School details, contact information, and arrival guidance",
  },
  {
    id: "offerings",
    label: "Offerings",
    description: "The trial classes parents and students can choose",
  },
  {
    id: "schedule",
    label: "Schedule",
    description: "Weekly trial times and class capacity",
  },
  {
    id: "pricing",
    label: "Pricing",
    description: "Prices and conditions your agent may share",
  },
  {
    id: "faqs",
    label: "FAQs",
    description: "Reliable answers to common parent questions",
  },
  {
    id: "agent",
    label: "Agent",
    description: "Your welcome message, tone, and qualification guidance",
  },
  {
    id: "branding",
    label: "Branding",
    description: "Logo and color shown in the trial-booking experience",
  },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];
