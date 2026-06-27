"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ensureProfileAndDefaults, getCurrentUser } from "@/lib/supabase/queries";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    ensureProfileAndDefaults()
      .then((currentUser) => {
        if (!active) return;
        if (!currentUser) router.replace("/login");
        setUser(currentUser);
      })
      .catch(() => {
        if (!active) return;
        router.replace("/login");
        setUser(null);
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (user === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-3xl bg-foreground" />
          <p className="text-sm text-muted-foreground">A preparar a tua app...</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

export function useSignedInUser() {
  const [name, setName] = useState("Gonçalo");

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) return;
      setName(user.user_metadata?.full_name || user.email?.split("@")[0] || "Gonçalo");
    });
  }, []);

  return name;
}
