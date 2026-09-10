import { CategoryHeading } from "./_components/category-heading";
import { ProfileForm } from "./_components/profile-form";
import { getSettingsCategory } from "./categories";
import { loadSettings } from "./load";

export default async function SettingsProfilePage() {
  const { school, timezones } = await loadSettings();
  const category = getSettingsCategory("profile");
  return (
    <div className="flex flex-col gap-6">
      <CategoryHeading title={category.title} purpose={category.purpose} />
      <ProfileForm school={school} timezones={timezones} />
    </div>
  );
}
