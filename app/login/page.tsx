"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn("password", {
        email,
        password,
        flow: isSignUp ? "signUp" : "signIn",
      });
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isSignUp && (msg.includes("already") || msg.includes("exists"))) {
        // Account was created but redirect failed, or genuinely duplicate
        setIsSignUp(false);
        setError("Account already exists — try signing in with this email.");
      } else {
        setError(isSignUp ? msg || "Sign up failed." : "Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm space-y-6 px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-100">Influence Me</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500"
          />
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {loading
              ? isSignUp
                ? "Creating account..."
                : "Signing in..."
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-xs text-zinc-500">
          {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-violet-400 hover:text-violet-300"
          >
            {isSignUp ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}
