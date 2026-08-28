import { redirect } from "next/navigation";
import { ContinueWithGoogle } from "@/components/continue-with-google";
import { getOwnedSchool } from "@/lib/auth/current-school";
import { getVerifiedClaims } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getVerifiedClaims();
  if (user) {
    const school = await getOwnedSchool(user.id);
    redirect(school ? "/dashboard" : "/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
        Fillthemat
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">
        Turn martial arts interest into booked trial classes.
      </h1>
      <p className="max-w-xl text-lg text-zinc-400">
        Give every school a branded AI concierge and a persistent Book Trial
        path. Prospects confirm a timeslot. You see who is coming.
      </p>
      <ContinueWithGoogle />
    </main>
  );
}
