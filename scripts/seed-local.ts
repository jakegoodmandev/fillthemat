import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { schools, trialOfferings, trialWindows, users } from "../src/db/schema";
import { parseSupabaseStatusEnv, readEnvFile } from "./local-env";
import { capture, fail } from "./local-process";

export const LOCAL_OWNER_EMAIL = "owner@local.test";
export const LOCAL_OWNER_PASSWORD = "local-dev-password";
export const LOCAL_SCHOOL_SLUG = "demo";

function loadEnv() {
  const file = readEnvFile(".env.local");
  for (const [key, value] of Object.entries(file)) {
    process.env[key] = value;
  }
}

async function ensureAuthUser(apiUrl: string, serviceRoleKey: string) {
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: LOCAL_OWNER_EMAIL,
      password: LOCAL_OWNER_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "Local Owner" },
    });
  if (!createError && created.user) return created.user;

  const duplicate =
    createError?.message?.toLowerCase().includes("already") ||
    createError?.status === 422;
  if (!duplicate) {
    fail(`Could not create local owner: ${createError?.message ?? "unknown"}`);
  }

  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) fail(`Could not list auth users: ${listError.message}`);
  const existing = list.users.find(
    (user) => user.email?.toLowerCase() === LOCAL_OWNER_EMAIL,
  );
  if (!existing) fail("Local owner exists but could not be loaded.");
  return existing;
}

export async function seedLocal() {
  loadEnv();
  const status = parseSupabaseStatusEnv(
    capture("bunx", ["supabase", "status", "-o", "env"]),
  );
  if (!status.serviceRoleKey) {
    fail("supabase status did not include SERVICE_ROLE_KEY.");
  }

  const authUser = await ensureAuthUser(status.apiUrl, status.serviceRoleKey);
  const db = getDb();

  await db
    .insert(users)
    .values({
      id: authUser.id,
      email: LOCAL_OWNER_EMAIL,
      name: "Local Owner",
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: LOCAL_OWNER_EMAIL,
        name: "Local Owner",
        updatedAt: new Date(),
      },
    });

  const [existingSchool] = await db
    .select()
    .from(schools)
    .where(eq(schools.ownerUserId, authUser.id))
    .limit(1);

  let schoolId = existingSchool?.id;
  if (!schoolId) {
    const [inserted] = await db
      .insert(schools)
      .values({
        ownerUserId: authUser.id,
        name: "Demo Dojo",
        slug: LOCAL_SCHOOL_SLUG,
        timezone: "America/New_York",
        city: "Brooklyn",
        address: "123 Demo Street",
        phone: "555-0100",
        notificationEmail: LOCAL_OWNER_EMAIL,
        country: "US",
        approvedAt: new Date(),
        welcomeMessage: "Welcome to the local demo school.",
      })
      .onConflictDoNothing()
      .returning({ id: schools.id });
    schoolId = inserted?.id;
  }
  if (!schoolId) {
    const [bySlug] = await db
      .select()
      .from(schools)
      .where(eq(schools.slug, LOCAL_SCHOOL_SLUG))
      .limit(1);
    schoolId = bySlug?.id;
  }
  if (!schoolId) fail("Could not seed demo school.");

  await db
    .update(schools)
    .set({
      approvedAt: existingSchool?.approvedAt ?? new Date(),
      city: existingSchool?.city ?? "Brooklyn",
      updatedAt: new Date(),
    })
    .where(eq(schools.id, schoolId));

  const [offering] = await db
    .select()
    .from(trialOfferings)
    .where(eq(trialOfferings.schoolId, schoolId))
    .limit(1);
  let offeringId = offering?.id;
  if (!offeringId) {
    const [createdOffering] = await db
      .insert(trialOfferings)
      .values({
        schoolId,
        name: "Kids beginner trial",
        description: "A 45-minute intro class for new students.",
        minimumAge: 5,
        maximumAge: 12,
        active: true,
      })
      .returning({ id: trialOfferings.id });
    offeringId = createdOffering?.id;
  }
  if (!offeringId) fail("Could not seed trial offering.");

  const [window] = await db
    .select()
    .from(trialWindows)
    .where(eq(trialWindows.schoolId, schoolId))
    .limit(1);
  if (!window) {
    await db.insert(trialWindows).values({
      schoolId,
      trialOfferingId: offeringId,
      dayOfWeek: 1,
      startMinute: 18 * 60,
      durationMinutes: 60,
      capacity: 8,
      label: "Monday 6pm",
      active: true,
    });
  }

  console.log(
    `Seeded ${LOCAL_OWNER_EMAIL} / ${LOCAL_OWNER_PASSWORD} with school /s/${LOCAL_SCHOOL_SLUG} (approved, unpublished).`,
  );
}

const invokedDirectly = process.argv[1]?.includes("seed-local");
if (invokedDirectly) {
  await seedLocal();
  process.exit(0);
}
