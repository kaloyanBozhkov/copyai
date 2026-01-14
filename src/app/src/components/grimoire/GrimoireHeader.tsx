import { Search, X, Minus, Plus, Sparkles, Scroll, Zap, Settings } from "lucide-react";

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
}: GrimoireHeaderProps) {
  return (
    <div className="grimoire-header">
      <div className="grimoire-header-drag">
        <div className="grimoire-title">
          <Scroll className="grimoire-title-icon" />
          <span>Command Grimoire</span>
          <div className="grimoire-title-glow" />
        </div>
      </div>

      <div className="grimoire-toolbar">
        <div className="grimoire-search">
          <Search className="grimoire-search-icon" />
          <input
            type="text"
            placeholder="Search incantations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="grimoire-search-input"
          />
        </div>

        <div className="grimoire-filters">
          <button
            onClick={() => onFilterChange("all")}
            className={`grimoire-filter-btn ${filter === "all" ? "active" : ""}`}
          >
            <Sparkles size={14} />
            All
          </button>
          <button
            onClick={() => onFilterChange("execs")}
            className={`grimoire-filter-btn ${filter === "execs" ? "active" : ""}`}
          >
            <Zap size={14} />
            Spells
          </button>
          <button
            onClick={() => onFilterChange("templates")}
            className={`grimoire-filter-btn ${filter === "templates" ? "active" : ""}`}
          >
            <Scroll size={14} />
            Scrolls
          </button>
        </div>

        <button onClick={onCreateTemplate} className="grimoire-create-btn">
          <Plus size={16} />
          <span>Inscribe Scroll</span>
        </button>

        <button
          onClick={onOpenSettings}
          className={`grimoire-settings-btn ${isSettingsOpen ? "active" : ""}`}
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      <div className="grimoire-window-controls">
        <button onClick={onMinimize} className="grimoire-control-btn minimize">
          <Minus size={14} />
        </button>
        <button onClick={onClose} className="grimoire-control-btn close">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

