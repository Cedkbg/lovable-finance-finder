import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Loader2, Save, User } from "lucide-react";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const initialsFromName = (name?: string | null) => {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
};

const Profile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
    setCompany(profile?.company ?? "");
  }, [profile]);

  const avatarFallback = useMemo(() => initialsFromName(displayName || user?.email), [displayName, user?.email]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    try {
      const payload = {
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        company: company.trim() || null,
      };

      let error: { message: string } | null = null;

      if (profile) {
        const result = await supabase
          .from("profiles")
          .update(payload)
          .eq("user_id", user.id);
        error = result.error;
      } else {
        const result = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            ...payload,
          });
        error = result.error;
      }

      if (error) throw error;

      await refreshProfile();
      toast.success("Profil mis à jour.");
    } catch (err: any) {
      toast.error(err.message || "Impossible de sauvegarder le profil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-muted transition-colors" title="Retour">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </Link>
          <span className="font-mono text-xs font-semibold text-foreground">PROFIL</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-xl mx-auto p-4">
        <section className="border border-border rounded-xl bg-card p-5 space-y-5">
          <div className="flex items-center gap-3">
            <Avatar className="w-14 h-14 border border-border">
              <AvatarImage src={avatarUrl || undefined} alt="Avatar utilisateur" />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{displayName || "Votre profil"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Nom</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Votre nom"
                  className="pl-10"
                  maxLength={120}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avatarUrl">Avatar (URL)</Label>
              <Input
                id="avatarUrl"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                type="url"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company">Entreprise</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Nom de l'entreprise"
                  className="pl-10"
                  maxLength={120}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Profile;
