"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Chrome, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = getSupabase();
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Conta criada. Confirma o email para iniciar sessão.");
      return;
    }

    router.replace("/");
  }

  async function handleGoogle() {
    await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-foreground text-background">
            <PiggyBank className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">FinanceFlow</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entra e regista o teu dinheiro em segundos.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleEmail}>
          <Input
            autoComplete="email"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button className="w-full" disabled={loading} size="lg" type="submit">
            {loading ? "A entrar..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <Button className="mt-3 w-full" size="lg" type="button" variant="secondary" onClick={handleGoogle}>
          <Chrome className="h-5 w-5" />
          Entrar com Google
        </Button>

        {message ? <p className="mt-4 text-center text-sm text-rose-500">{message}</p> : null}

        <button
          className="mt-6 w-full text-center text-sm font-medium text-muted-foreground"
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "Ainda não tenho conta" : "Já tenho conta"}
        </button>
      </Card>
    </main>
  );
}
