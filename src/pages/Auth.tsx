import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Mail, Lock, User, Loader2, Zap, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";
import AccessRequestForm from "@/components/auth/AccessRequestForm";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "request">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getAuthErrorMessage = (err: any) => {
    const message = err?.message || "Erreur d'authentification";

    if (message.includes("Invalid login credentials")) {
      return "Email ou mot de passe incorrect.";
    }

    if (message.toLowerCase().includes("already") || message.toLowerCase().includes("registered")) {
      return "Cet email existe déjà. Essayez de vous connecter.";
    }

    return message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Email de réinitialisation envoyé !");
        setMode("login");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        if (data.session) {
          toast.success("Compte créé. Bienvenue !");
          navigate("/");
          return;
        }

        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) {
          toast.success("Compte créé. Connectez-vous avec vos identifiants.");
          setMode("login");
          return;
        }

        toast.success("Compte créé. Bienvenue !");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (err: any) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) throw result.error;
    } catch (err: any) {
      toast.error(err.message || "Erreur Google Sign-In");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-mono text-xs font-semibold text-foreground tracking-wide">ENRICHER</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="border border-border rounded-xl bg-card p-6 shadow-sm">
            {mode === "request" ? (
              <AccessRequestForm initialEmail={email} onBack={() => setMode("login")} />
            ) : (
              <>
                <h1 className="text-lg font-semibold text-foreground text-center mb-1">
                  {mode === "login" ? "Connexion" : mode === "signup" ? "Créer un compte" : "Mot de passe oublié"}
                </h1>
                <p className="text-xs text-muted-foreground text-center mb-6">
                  {mode === "login"
                    ? "Accédez à votre base d'actifs"
                    : mode === "signup"
                      ? "Inscription rapide, accès immédiat"
                      : "Recevez un lien de réinitialisation"}
                </p>

                {mode !== "forgot" && (
                  <>
                    <button
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full h-10 rounded-lg border border-border bg-background hover:bg-muted flex items-center justify-center gap-2 text-sm font-medium text-foreground transition-colors mb-4"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continuer avec Google
                    </button>

                    <div className="relative mb-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-[10px]">
                        <span className="px-2 bg-card text-muted-foreground">OU</span>
                      </div>
                    </div>
                  </>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  {mode === "signup" && (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nom complet"
                        className="w-full h-10 pl-10 pr-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        required
                      />
                    </div>
                  )}

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full h-10 pl-10 pr-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                      required
                    />
                  </div>

                  {mode !== "forgot" && (
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mot de passe"
                        className="w-full h-10 pl-10 pr-10 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {mode === "login" ? "Se connecter" : mode === "signup" ? "S'inscrire" : "Envoyer le lien"}
                  </button>
                </form>

                <div className="mt-4 text-center space-y-1">
                  {mode === "login" && (
                    <>
                      <button onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                        Mot de passe oublié ?
                      </button>
                      <p className="text-xs text-muted-foreground">
                        Pas encore de compte ?{" "}
                        <button onClick={() => setMode("signup")} className="text-primary hover:underline">
                          S'inscrire
                        </button>
                      </p>
                      <button onClick={() => setMode("request")} className="text-xs text-primary hover:underline">
                        Problème d'inscription ? Faire une demande assistée
                      </button>
                    </>
                  )}
                  {mode === "signup" && (
                    <p className="text-xs text-muted-foreground">
                      Déjà un compte ?{" "}
                      <button onClick={() => setMode("login")} className="text-primary hover:underline">
                        Se connecter
                      </button>
                    </p>
                  )}
                  {mode === "forgot" && (
                    <button onClick={() => setMode("login")} className="text-xs text-primary hover:underline">
                      Retour à la connexion
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
