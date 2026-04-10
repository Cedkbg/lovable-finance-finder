import { Clock, Trash2, Database, HardDrive, Wifi, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SearchHistoryItem } from "@/hooks/use-search-history";

const SOURCE_ICON: Record<string, typeof Database> = {
  database: Database,
  eodhd: Wifi,
  coingecko: HardDrive,
  not_found: XCircle,
};

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  onSelect: (query: string) => void;
  onClear: () => void;
}

const SearchHistory = ({ history, onSelect, onClear }: SearchHistoryProps) => {
  if (history.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-xl bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="label-xs text-muted-foreground">SEARCH_HISTORY</span>
          <span className="text-[10px] font-mono text-muted-foreground/60">({history.length})</span>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors text-[10px] font-mono"
        >
          <Trash2 className="w-3 h-3" />
          CLEAR
        </button>
      </div>

      <div className="max-h-52 overflow-y-auto divide-y divide-border/50">
        <AnimatePresence>
          {history.map((item) => {
            const Icon = SOURCE_ICON[item.source] || Database;
            const timeAgo = getTimeAgo(item.timestamp);

            return (
              <motion.button
                key={item.query + item.timestamp}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => onSelect(item.query)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors text-left"
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${item.source === "not_found" ? "text-destructive" : "text-primary"}`} />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-foreground">{item.query}</span>
                  {item.assetName && (
                    <span className="ml-2 text-[10px] text-muted-foreground truncate">{item.assetName}</span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0">{timeAgo}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

function getTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default SearchHistory;
