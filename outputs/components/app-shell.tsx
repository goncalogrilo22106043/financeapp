"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Home, LogOut, PiggyBank, Plus, ReceiptText, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Início", icon: Home },
  { href: "/transacoes", label: "Transações", icon: ReceiptText },
  { href: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { href: "/objetivos", label: "Objetivos", icon: Target }
];

export function AppShell({
  children,
  onNewTransaction
}: {
  children: React.ReactNode;
  onNewTransaction?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link className="flex items-center gap-3" href="/">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-foreground text-background">
              <PiggyBank className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">FinanceFlow</p>
              <p className="text-xs text-muted-foreground">Simples e diário</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {onNewTransaction ? (
              <Button className="hidden md:inline-flex" size="sm" onClick={onNewTransaction}>
                <Plus className="h-4 w-4" />
                Nova
              </Button>
            ) : null}
            <ThemeToggle />
            <Button aria-label="Terminar sessão" size="icon" variant="secondary" onClick={signOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-10">{children}</main>

      {onNewTransaction ? (
        <Button
          className="fixed bottom-24 right-4 z-40 h-16 rounded-full px-6 shadow-soft md:hidden"
          onClick={onNewTransaction}
        >
          <Plus className="h-5 w-5" />
          Nova
        </Button>
      ) : null}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 px-3 pt-2 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-medium text-muted-foreground",
                  active && "bg-foreground text-background"
                )}
                href={item.href}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <aside className="fixed bottom-6 left-1/2 z-20 hidden -translate-x-1/2 rounded-full border border-border bg-background/90 p-2 shadow-soft backdrop-blur-xl md:block">
        <div className="flex gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground",
                  active && "bg-foreground text-background"
                )}
                href={item.href}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
