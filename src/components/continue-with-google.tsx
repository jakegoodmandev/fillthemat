"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function ContinueWithGoogle({ next = "/dashboard" }: { next?: string }) {
  async function onClick() {
    const supabase = createBrowserSupabaseClient();
    const origin = window.location.origin;
    document.cookie = `fillthemat_next=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        scopes: "openid email profile",
      },
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
    >
      Continue with Google
    </button>
  );
}
