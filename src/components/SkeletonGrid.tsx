import { motion } from "framer-motion";

const SkeletonGrid = () => {
  const rows = Array.from({ length: 8 });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full"
    >
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="h-3 w-24 bg-secondary rounded animate-pulse-subtle" />
        <div className="h-5 w-48 bg-secondary rounded mt-2 animate-pulse-subtle" />
      </div>
      <div className="grid grid-cols-2">
        {rows.map((_, i) => (
          <div key={i} className="py-2.5 px-4 border-b border-border/50">
            <div className="h-2.5 w-16 bg-secondary rounded animate-pulse-subtle" />
            <div className="h-4 w-28 bg-secondary rounded mt-1.5 animate-pulse-subtle" />
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default SkeletonGrid;
