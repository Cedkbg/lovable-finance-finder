import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowLeft, Database, Globe, Briefcase, Wifi, Loader2, UserCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";
import type { DbAsset } from "@/lib/asset-service";

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 70%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(270, 60%, 55%)",
  "hsl(180, 60%, 45%)",
  "hsl(330, 70%, 50%)",
  "hsl(60, 70%, 45%)",
];

const Dashboard = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<DbAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssets = async () => {
      const { data } = await supabase.from("financial_assets").select("*");
      setAssets((data as DbAsset[]) || []);
      setLoading(false);
    };
    fetchAssets();

    // Realtime
    const channel = supabase
      .channel("dashboard_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_assets" }, () => fetchAssets())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const bySource = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach((a) => { map[a.source || "unknown"] = (map[a.source || "unknown"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [assets]);

  const byCountry = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach((a) => { map[a.country || "Unknown"] = (map[a.country || "Unknown"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [assets]);

  const bySector = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach((a) => { map[a.sector || "Unknown"] = (map[a.sector || "Unknown"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [assets]);

  const myAssets = assets.filter((a) => a.user_id === user?.id).length;
  const publicAssets = assets.filter((a) => !a.user_id).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </Link>
          <span className="font-mono text-xs font-semibold text-foreground">DASHBOARD</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/profile" className="p-2 rounded-lg hover:bg-muted transition-colors" title="Profil">
            <UserCircle2 className="w-4 h-4 text-muted-foreground" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Assets", value: assets.length, icon: Database, color: "text-primary" },
            { label: "Mes Assets", value: myAssets, icon: Briefcase, color: "text-[hsl(var(--success))]" },
            { label: "Assets Publics", value: publicAssets, icon: Globe, color: "text-[hsl(var(--warning))]" },
            { label: "Sources", value: bySource.length, icon: Wifi, color: "text-primary" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-border rounded-xl bg-card p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="label-xs">{stat.label}</span>
              </div>
              <p className="text-2xl font-semibold text-foreground font-mono">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* By Source */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border rounded-xl bg-card p-4">
            <h3 className="label-xs mb-4">PAR SOURCE</h3>
            {bySource.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={bySource} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                    {bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-xs text-center py-8">Aucune donnée</p>}
          </motion.div>

          {/* By Country */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border rounded-xl bg-card p-4">
            <h3 className="label-xs mb-4">PAR PAYS</h3>
            {byCountry.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byCountry} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="value" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-xs text-center py-8">Aucune donnée</p>}
          </motion.div>

          {/* By Sector */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border rounded-xl bg-card p-4 md:col-span-2">
            <h3 className="label-xs mb-4">PAR SECTEUR</h3>
            {bySector.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bySector}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="value" fill="hsl(142, 70%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-xs text-center py-8">Aucune donnée</p>}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
