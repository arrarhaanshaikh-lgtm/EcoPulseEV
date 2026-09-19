import React, { useState } from "react";
import { User, ShieldCheck, Zap } from "lucide-react";
import { signInUser, signUpUser, signInWithGoogle, UserRole } from "../lib/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (role: UserRole, email: string) => void;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (isSignUp) {
      const { data, error } = await signUpUser(email, password, role);
      if (error) {
        setErrorMsg(error.message);
      } else {
        onAuthSuccess(role, email);
        onClose();
      }
    } else {
      const { data, error } = await signInUser(email, password);
      if (error) {
        setErrorMsg(error.message);
      } else {
        const userRole = ((data?.user?.user_metadata as any)?.user_role as UserRole) || "user";
        onAuthSuccess(userRole, email);
        onClose();
      }
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg("");
    const { error } = await signInWithGoogle();
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
  };

  // Instant Demo Mode for SIH Judges
  const handleDemoLogin = (selectedRole: UserRole) => {
    const demoEmail = selectedRole === "operator" ? "operator@ecopulse.ev" : "driver@ecopulse.ev";
    onAuthSuccess(selectedRole, demoEmail);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-slate-100">
        <h2 className="text-xl font-bold mb-4 text-emerald-400 flex items-center gap-2">
          <Zap className="w-5 h-5" /> EcoPulse Portal Login
        </h2>

        {/* Mode Selector */}
        <div className="flex bg-slate-800 p-1 rounded-xl mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setRole("user")}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
              role === "user" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="w-4 h-4" /> EV Driver
          </button>
          <button
            type="button"
            onClick={() => setRole("operator")}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
              role === "operator" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Station Operator
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />

          {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Authenticating..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* Google OAuth Option */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-slate-900 px-2 text-slate-500">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Google
        </button>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg("");
            }}
            className="text-xs text-slate-400 hover:text-emerald-400 underline"
          >
            {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
          </button>
        </div>

        {/* SIH Judge Demo Bypass Section */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <p className="text-xs font-semibold text-slate-400 mb-2 text-center">⚡ SIH Evaluation Quick Access</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoLogin("user")}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 rounded-xl border border-slate-700 transition-colors"
            >
              Demo Driver
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin("operator")}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs py-2 rounded-xl border border-emerald-500/30 font-semibold transition-colors"
            >
              Demo Operator
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}