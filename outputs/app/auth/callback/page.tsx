"use client";

import { Suspense } from "react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackLoading />}>
      <AuthCallbackContent />
    </Suspense>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      router.replace("/login");
      return;
    }

    getSupabase()
      .auth.exchangeCodeForSession(code)
      .finally(() => router.replace("/"));
  }, [router, searchParams]);

  return (
    <CallbackLoading />
  );
}

function CallbackLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <p className="text-sm text-muted-foreground">A terminar o login...</p>
    </main>
  );
}
