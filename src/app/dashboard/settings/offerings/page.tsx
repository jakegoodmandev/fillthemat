import { CategoryHeading } from "../_components/category-heading";
import { OfferingsPanel } from "../_components/offerings-panel";
import { getSettingsCategory } from "../categories";
import { loadSettings } from "../load";

export default async function SettingsOfferingsPage() {
  const { offerings } = await loadSettings();
  const category = getSettingsCategory("offerings");
  return (
    <div className="flex flex-col gap-6">
      <CategoryHeading title={category.title} purpose={category.purpose} />
      <OfferingsPanel offerings={offerings} />
    </div>
  );
}
