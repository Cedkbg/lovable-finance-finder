import { useState } from "react";
import { Loader2, Mail, User, Building2, MessageSquare, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AccessRequestFormProps {
  initialEmail?: string;
  onBack: () => void;
}

const AccessRequestForm = ({ initialEmail = "", onBack }: AccessRequestFormProps) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("access_requests").insert({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        company: company.trim() || null,
        message: message.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("Une demande en attente existe déjà pour cet email.");
          return;
        }
        throw error;
      }

      toast.success("Demande envoyée ! Nous reviendrons vers vous rapidement.");
      setFullName("");
      setCompany("");
      setMessage("");
    } catch (err: any) {
      toast.error(err.message || "Impossible d'envoyer la demande");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Retour
      </button>

      <h1 className="text-lg font-semibold text-foreground text-center mb-1">Demande d'accès</h1>
      <p className="text-xs text-muted-foreground text-center mb-6">
        Un canal simple pour demander votre ouverture de compte
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nom complet"
            className="w-full h-10 pl-10 pr-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            required
            minLength={2}
          />
        </div>

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

        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Entreprise (optionnel)"
            className="w-full h-10 pl-10 pr-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            maxLength={120}
          />
        </div>

        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Dites-nous votre besoin (optionnel)"
            className="w-full min-h-[92px] pl-10 pr-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
            maxLength={1200}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Envoyer ma demande
        </button>
      </form>
    </div>
  );
};

export default AccessRequestForm;
