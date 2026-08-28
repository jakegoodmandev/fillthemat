import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export type VerifiedUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function getVerifiedClaims(): Promise<VerifiedUser | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims || typeof claims.sub !== "string") return null;
    const email = typeof claims.email === "string" ? claims.email : null;
    if (!email) return null;
    const name = typeof claims.name === "string" ? claims.name : null;
    return { id: claims.sub, email, name };
  } catch {
    return null;
  }
}

export async function ensureUser(): Promise<VerifiedUser | null> {
  const claims = await getVerifiedClaims();
  if (!claims) return null;
  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({
      id: claims.id,
      email: claims.email,
      name: claims.name,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: claims.email,
        name: claims.name,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user ?? claims;
}

export async function requireUser(): Promise<VerifiedUser> {
  const user = await ensureUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function getUserById(id: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}
