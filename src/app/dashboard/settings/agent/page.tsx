import { AgentForm } from "../_components/agent-form";
import { CategoryHeading } from "../_components/category-heading";
import { getSettingsCategory } from "../categories";
import { loadSettings } from "../load";

export default async function SettingsAgentPage() {
  const { school } = await loadSettings();
  const category = getSettingsCategory("agent");
  return (
    <div className="flex flex-col gap-6">
      <CategoryHeading title={category.title} purpose={category.purpose} />
      <AgentForm
        schoolName={school.name}
        location={school.location}
        logoUrl={school.logoUrl}
        primaryColor={school.primaryColor}
        welcomeMessage={school.welcomeMessage}
        agentInstructions={school.agentInstructions}
      />
    </div>
  );
}
