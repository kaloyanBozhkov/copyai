import {
  Search,
  X,
  Minus,
  Plus,
  Sparkles,
  Scroll,
  Zap,
  Settings,
  Book,
  Beaker,
} from "lucide-react";

interface GrimoireHeaderProps {
  onClose: () => void;
  onMinimize: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: "all" | "execs" | "templates";
  onFilterChange: (filter: "all" | "execs" | "templates") => void;
  onCreateTemplate: () => void;
  onOpenSettings: () => void;
  isSettingsOpen: boolean;
  onOpenBook: () => void;
  isBookOpen: boolean;
  onOpenAlchemy: () => void;
  isAlchemyOpen: boolean;
}

export function GrimoireHeader({
  onClose,
  onMinimize,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  onCreateTemplate,
  onOpenSettings,
  isSettingsOpen,
  onOpenBook,
  isBookOpen,
  onOpenAlchemy,
  isAlchemyOpen,
}: GrimoireHeaderProps) {
  return (
    <div className="flex items-center gap-4 border-b border-grimoire-border bg-gradient-to-b from-grimoire-bg-secondary/80 to-grimoire-bg/60 px-4 py-2 backdrop-blur-sm">
      {/* Draggable Title Area */}
      <div className="flex items-center gap-2 app-drag-region flex-shrink-0">
        <div className="flex items-center gap-2 relative">
          <Scroll className="w-5 h-5 text-grimoire-gold" />
          <span className="text-grimoire-gold font-fantasy text-lg font-semibold tracking-wide">
            Command Grimoire
          </span>
          <div className="absolute inset-0 blur-md bg-grimoire-gold/20 -z-10 rounded-lg" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-grimoire-text-dim pointer-events-none" />
          <input
            type="text"
            placeholder="Search incantations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 w-80 bg-black/30 border border-grimoire-border rounded text-grimoire-text placeholder:text-grimoire-text-dim text-sm focus:outline-none focus:border-grimoire-gold-dim focus:ring-1 focus:ring-grimoire-gold-dim transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1 bg-black/20 rounded p-1 border border-grimoire-border/50">
          <button
            onClick={() => onFilterChange("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
              filter === "all"
                ? "bg-grimoire-gold/20 text-grimoire-gold border border-grimoire-gold/50 shadow-sm"
                : "text-grimoire-text-dim hover:text-grimoire-text hover:bg-white/5"
            }`}
          >
            <Sparkles size={14} />
            All
          </button>
          <button
            onClick={() => onFilterChange("execs")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
              filter === "execs"
                ? "bg-grimoire-accent/20 text-grimoire-accent-bright border border-grimoire-accent/50 shadow-sm"
                : "text-grimoire-text-dim hover:text-grimoire-text hover:bg-white/5"
            }`}
          >
            <Zap size={14} />
            Spells
          </button>
          <button
            onClick={() => onFilterChange("templates")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
              filter === "templates"
                ? "bg-grimoire-gold/20 text-grimoire-gold border border-grimoire-gold/50 shadow-sm"
                : "text-grimoire-text-dim hover:text-grimoire-text hover:bg-white/5"
            }`}
          >
            <Scroll size={14} />
            Scrolls
          </button>
        </div>

        {/* Create Button */}
        <button
          onClick={onCreateTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-grimoire-gold/80 to-grimoire-gold/60 border border-grimoire-gold text-grimoire-bg font-fantasy text-sm font-semibold rounded transition-all hover:from-grimoire-gold-bright/80 hover:to-grimoire-gold-bright/60 hover:shadow-[0_0_20px_rgba(201,162,39,0.4)] active:scale-95"
        >
          <Plus size={16} />
          <span>Inscribe Scroll</span>
        </button>

        {/* Book Button */}
        <button
          onClick={onOpenBook}
          className={`p-2 rounded border transition-all ${
            isBookOpen
              ? "bg-grimoire-accent/20 text-grimoire-accent-bright border-grimoire-accent/50"
              : "bg-black/20 text-grimoire-text-dim border-grimoire-border/50 hover:text-grimoire-text hover:border-grimoire-border"
          }`}
          title="The Book"
        >
          <Book size={16} />
        </button>

        {/* Alchemy Button */}
        <button
          onClick={onOpenAlchemy}
          className={`p-2 rounded border transition-all ${
            isAlchemyOpen
              ? "bg-grimoire-purple/20 text-grimoire-purple-bright border-grimoire-purple/50"
              : "bg-black/20 text-grimoire-text-dim border-grimoire-border/50 hover:text-grimoire-text hover:border-grimoire-border"
          }`}
          title="Alchemy Lab"
        >
          <Beaker size={16} />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className={`p-2 rounded border transition-all ${
            isSettingsOpen
              ? "bg-grimoire-accent/20 text-grimoire-accent-bright border-grimoire-accent/50"
              : "bg-black/20 text-grimoire-text-dim border-grimoire-border/50 hover:text-grimoire-text hover:border-grimoire-border"
          }`}
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Window Controls */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onMinimize}
          className="p-1.5 rounded bg-black/20 border border-grimoire-border/50 text-grimoire-text-dim hover:text-grimoire-text hover:border-grimoire-border transition-all"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded bg-black/20 border border-grimoire-border/50 text-grimoire-text-dim hover:text-grimoire-red hover:border-grimoire-red hover:bg-grimoire-red/10 transition-all"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
