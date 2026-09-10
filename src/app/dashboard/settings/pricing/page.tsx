import { CategoryHeading } from "../_components/category-heading";
import { PricingForm } from "../_components/pricing-form";
import { getSettingsCategory } from "../categories";
import { loadSettings } from "../load";

export default async function SettingsPricingPage() {
  const { school } = await loadSettings();
  const category = getSettingsCategory("pricing");
  return (
    <div className="flex flex-col gap-6">
      <CategoryHeading title={category.title} purpose={category.purpose} />
      <PricingForm pricing={school.pricing} />
    </div>
  );
}
