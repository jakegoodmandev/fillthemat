import { CategoryHeading } from "../_components/category-heading";
import { FaqsPanel } from "../_components/faqs-panel";
import { getSettingsCategory } from "../categories";
import { loadSettings } from "../load";

export default async function SettingsFaqsPage() {
  const { faqs } = await loadSettings();
  const category = getSettingsCategory("faqs");
  return (
    <div className="flex flex-col gap-6">
      <CategoryHeading title={category.title} purpose={category.purpose} />
      <FaqsPanel faqs={faqs} />
    </div>
  );
}
