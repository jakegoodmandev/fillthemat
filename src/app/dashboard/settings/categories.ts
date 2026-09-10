/** Deep-linkable settings categories.
 * Profile lives at `/dashboard/settings`.
 * Other categories use nested routes such as `/dashboard/settings/offerings`.
 */
export const SETTINGS_CATEGORIES = [
  {
    slug: "profile",
    label: "Profile",
    title: "School profile",
    purpose:
      "School details parents can see, plus the email used for booking notices.",
  },
  {
    slug: "offerings",
    label: "Offerings",
    title: "Trial classes",
    purpose:
      "Describe the trial classes parents can choose. Age ranges decide who is eligible.",
  },
  {
    slug: "schedule",
    label: "Schedule",
    title: "Weekly schedule",
    purpose:
      "Set the weekly times parents can book. Your agent only offers these times.",
  },
  {
    slug: "pricing",
    label: "Pricing",
    title: "Pricing",
    purpose:
      "Add the prices and conditions your agent may share. It will not invent discounts.",
  },
  {
    slug: "faqs",
    label: "FAQs",
    title: "FAQs",
    purpose:
      "Answers to questions parents ask before a trial class, such as experience or what to bring.",
  },
  {
    slug: "agent",
    label: "Agent",
    title: "Your agent",
    purpose:
      "Set the first message parents see and the tone of replies. Eligibility, times, and prices come from the other sections.",
  },
  {
    slug: "branding",
    label: "Branding",
    title: "Branding",
    purpose:
      "Choose the logo and color parents see on your trial-booking page.",
  },
] as const;

export type SettingsCategorySlug = (typeof SETTINGS_CATEGORIES)[number]["slug"];

export function isSettingsCategorySlug(
  value: string | null,
): value is SettingsCategorySlug {
  return SETTINGS_CATEGORIES.some((category) => category.slug === value);
}

export function getSettingsCategory(slug: string | null) {
  const resolved = slug && isSettingsCategorySlug(slug) ? slug : "profile";
  const category = SETTINGS_CATEGORIES.find((item) => item.slug === resolved);
  return category ?? SETTINGS_CATEGORIES[0];
}

export function settingsCategoryHref(slug: SettingsCategorySlug): string {
  return slug === "profile"
    ? "/dashboard/settings"
    : `/dashboard/settings/${slug}`;
}
