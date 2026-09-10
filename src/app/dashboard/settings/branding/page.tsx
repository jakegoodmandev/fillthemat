import { BrandingForm } from "../_components/branding-form";
import { CategoryHeading } from "../_components/category-heading";
import { getSettingsCategory } from "../categories";
import { loadSettings } from "../load";

export default async function SettingsBrandingPage() {
  const { school } = await loadSettings();
  const category = getSettingsCategory("branding");
  return (
    <div className="flex flex-col gap-6">
      <CategoryHeading title={category.title} purpose={category.purpose} />
      <BrandingForm
        schoolName={school.name}
        location={school.location}
        welcomeMessage={school.welcomeMessage}
        logoUrl={school.logoUrl}
        primaryColor={school.primaryColor}
      />
    </div>
  );
}
