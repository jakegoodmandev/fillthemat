import { CategoryHeading } from "../_components/category-heading";
import { SchedulePanel } from "../_components/schedule-panel";
import { getSettingsCategory } from "../categories";
import { loadSettings } from "../load";

export default async function SettingsSchedulePage() {
  const { offerings, windows } = await loadSettings();
  const category = getSettingsCategory("schedule");
  return (
    <div className="flex flex-col gap-6">
      <CategoryHeading title={category.title} purpose={category.purpose} />
      <SchedulePanel offerings={offerings} windows={windows} />
    </div>
  );
}
