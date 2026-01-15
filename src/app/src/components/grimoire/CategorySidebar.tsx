import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Zap, Scroll, Wand2, Sparkles } from "lucide-react";
import type { CommandsData, CommandInfo, CustomTemplate, CustomSpell, CategoryGroup } from "./types";

interface CategorySidebarProps {
  commandsData: CommandsData;
  selectedCommand: CommandInfo | null;
  selectedCustomTemplate: CustomTemplate | null;
  selectedCustomSpell: CustomSpell | null;
  onSelectCommand: (command: CommandInfo | null) => void;
  onSelectCustomTemplate: (template: CustomTemplate | null) => void;
  onSelectCustomSpell: (spell: CustomSpell | null) => void;
  filter: "all" | "execs" | "templates";
  searchQuery: string;
}

interface CategoryItemProps {
  category: CategoryGroup;
  type: "exec" | "template";
  selectedCommand: CommandInfo | null;
  onSelectCommand: (command: CommandInfo) => void;
  searchQuery: string;
}

function CategoryItem({
  category,
  type,
  selectedCommand,
  onSelectCommand,
  searchQuery,
}: CategoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSubcats, setExpandedSubcats] = useState<Record<string, boolean>>({});

  const filteredCommands = useMemo(() => {
    if (!searchQuery) return category.commands;
    const q = searchQuery.toLowerCase();
    return category.commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.fullKey.toLowerCase().includes(q)
    );
  }, [category.commands, searchQuery]);

  const filteredSubcategories = useMemo(() => {
    if (!category.subcategories) return {};
    if (!searchQuery) return category.subcategories;

    const q = searchQuery.toLowerCase();
    const result: Record<string, CommandInfo[]> = {};

    for (const [subcat, commands] of Object.entries(category.subcategories)) {
      const filtered = commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(q) ||
          cmd.fullKey.toLowerCase().includes(q) ||
          subcat.toLowerCase().includes(q)
      );
      if (filtered.length > 0) {
        result[subcat] = filtered;
      }
    }
    return result;
  }, [category.subcategories, searchQuery]);

  const hasContent =
    filteredCommands.length > 0 || Object.keys(filteredSubcategories).length > 0;

  if (!hasContent && searchQuery) return null;

  const toggleSubcat = (subcat: string) => {
    setExpandedSubcats((prev) => ({ ...prev, [subcat]: !prev[subcat] }));
  };

  const TypeIcon = type === "exec" ? Zap : Scroll;

  return (
    <div className="border-b border-grimoire-border/30 last:border-b-0">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-grimoire-text-dim">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <TypeIcon
          size={14}
          className={type === "exec" ? "text-grimoire-accent-bright" : "text-grimoire-gold"}
        />
        <span className="flex-1 text-grimoire-text font-fantasy text-sm font-medium">
          {category.name}
        </span>
        <span className="text-xs text-grimoire-text-dim bg-black/30 px-2 py-0.5 rounded">
          {filteredCommands.length +
            Object.values(filteredSubcategories).reduce((a, b) => a + b.length, 0)}
        </span>
      </button>

      {isExpanded && (
        <div className="bg-black/10">
          {filteredCommands.map((cmd) => (
            <button
              key={cmd.fullKey}
              className={`w-full flex items-center gap-2 px-3 py-2 pl-9 text-left text-sm transition-all ${
                selectedCommand?.fullKey === cmd.fullKey
                  ? "bg-grimoire-gold/20 text-grimoire-gold border-l-2 border-grimoire-gold"
                  : "text-grimoire-text-dim hover:text-grimoire-text hover:bg-white/5 border-l-2 border-transparent"
              }`}
              onClick={() => onSelectCommand(cmd)}
            >
              <Wand2 size={12} />
              <span>{cmd.name}</span>
            </button>
          ))}

          {Object.entries(filteredSubcategories).map(([subcat, commands]) => (
            <div key={subcat} className="border-l-2 border-grimoire-border/20 ml-4">
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/5 transition-colors"
                onClick={() => toggleSubcat(subcat)}
              >
                <div className="text-grimoire-text-dim">
                  {expandedSubcats[subcat] ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                </div>
                <span className="flex-1 text-grimoire-text-dim">{subcat}</span>
                <span className="text-xs text-grimoire-text-dim">{commands.length}</span>
              </button>

              {expandedSubcats[subcat] && (
                <div className="bg-black/10">
                  {commands.map((cmd) => (
                    <button
                      key={cmd.fullKey}
                      className={`w-full flex items-center gap-2 px-3 py-2 pl-12 text-left text-sm transition-all ${
                        selectedCommand?.fullKey === cmd.fullKey
                          ? "bg-grimoire-gold/20 text-grimoire-gold border-l-2 border-grimoire-gold"
                          : "text-grimoire-text-dim hover:text-grimoire-text hover:bg-white/5 border-l-2 border-transparent"
                      }`}
                      onClick={() => onSelectCommand(cmd)}
                    >
                      <Wand2 size={12} />
                      <span>{cmd.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategorySidebar({
  commandsData,
  selectedCommand,
  selectedCustomTemplate,
  selectedCustomSpell,
  onSelectCommand,
  onSelectCustomTemplate,
  onSelectCustomSpell,
  filter,
  searchQuery,
}: CategorySidebarProps) {
  const [customExpanded, setCustomExpanded] = useState(true);
  const [customSpellsExpanded, setCustomSpellsExpanded] = useState(true);

  const showExecs = filter === "all" || filter === "execs";
  const showTemplates = filter === "all" || filter === "templates";

  const filteredCustomTemplates = useMemo(() => {
    if (!searchQuery) return commandsData.customTemplates;
    const q = searchQuery.toLowerCase();
    return commandsData.customTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    );
  }, [commandsData.customTemplates, searchQuery]);

  const filteredCustomSpells = useMemo(() => {
    const spells = commandsData.customSpells || [];
    if (!searchQuery) return spells;
    const q = searchQuery.toLowerCase();
    return spells.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [commandsData.customSpells, searchQuery]);

  return (
    <div className="w-80 border-r border-grimoire-border bg-gradient-to-br from-grimoire-bg-secondary/40 to-grimoire-bg/60 backdrop-blur-sm overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Your Creations Section */}
        {(showTemplates && filteredCustomTemplates.length > 0) || (showExecs && filteredCustomSpells.length > 0) ? (
          <div className="border-b border-grimoire-border">
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-grimoire-gold/20 to-transparent border-b border-grimoire-gold/30">
              <Sparkles size={14} className="text-grimoire-gold" />
              <span className="font-fantasy text-sm font-semibold text-grimoire-gold">
                Your Inscriptions
              </span>
            </div>

            {/* Custom Scrolls */}
            {showTemplates && filteredCustomTemplates.length > 0 && (
              <div className="border-b border-grimoire-border/30">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                  onClick={() => setCustomExpanded(!customExpanded)}
                >
                  <div className="text-grimoire-text-dim">
                    {customExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </div>
                  <span className="flex-1 text-grimoire-purple-bright font-fantasy text-sm font-medium">
                    Custom Scrolls
                  </span>
                  <span className="text-xs text-grimoire-purple-bright bg-grimoire-purple/20 px-2 py-0.5 rounded">
                    {filteredCustomTemplates.length}
                  </span>
                </button>

                {customExpanded && (
                  <div className="bg-black/10">
                    {filteredCustomTemplates.map((template) => (
                      <button
                        key={template.id}
                        className={`w-full flex items-center gap-2 px-3 py-2 pl-9 text-left text-sm transition-all ${
                          selectedCustomTemplate?.id === template.id
                            ? "bg-grimoire-purple/20 text-grimoire-purple-bright border-l-2 border-grimoire-purple-bright"
                            : "text-grimoire-text-dim hover:text-grimoire-text hover:bg-white/5 border-l-2 border-transparent"
                        }`}
                        onClick={() => onSelectCustomTemplate(template)}
                      >
                        <Scroll size={12} className="text-grimoire-purple-bright" />
                        <span>{template.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Custom AI Spells */}
            {showExecs && filteredCustomSpells.length > 0 && (
              <div className="border-b border-grimoire-border/30 last:border-b-0">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                  onClick={() => setCustomSpellsExpanded(!customSpellsExpanded)}
                >
                  <div className="text-grimoire-text-dim">
                    {customSpellsExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </div>
                  <span className="flex-1 text-grimoire-accent-bright font-fantasy text-sm font-medium">
                    Custom AI Spells
                  </span>
                  <span className="text-xs text-grimoire-accent-bright bg-grimoire-accent/20 px-2 py-0.5 rounded">
                    {filteredCustomSpells.length}
                  </span>
                </button>

                {customSpellsExpanded && (
                  <div className="bg-black/10">
                    {filteredCustomSpells.map((spell) => (
                      <button
                        key={spell.id}
                        className={`w-full flex items-center gap-2 px-3 py-2 pl-9 text-left text-sm transition-all ${
                          selectedCustomSpell?.id === spell.id
                            ? "bg-grimoire-accent/20 text-grimoire-accent-bright border-l-2 border-grimoire-accent-bright"
                            : "text-grimoire-text-dim hover:text-grimoire-text hover:bg-white/5 border-l-2 border-transparent"
                        }`}
                        onClick={() => onSelectCustomSpell(spell)}
                      >
                        <Zap size={12} className="text-grimoire-accent-bright" />
                        <span>{spell.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Executable Commands Section */}
        {showExecs && (
          <div className="border-b border-grimoire-border">
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-grimoire-accent/20 to-transparent border-b border-grimoire-accent/30">
              <Zap size={14} className="text-grimoire-accent-bright" />
              <span className="font-fantasy text-sm font-semibold text-grimoire-accent-bright">
                Spells (Executables)
              </span>
            </div>
            {Object.values(commandsData.execs).map((category) => (
              <CategoryItem
                key={category.name}
                category={category}
                type="exec"
                selectedCommand={selectedCommand}
                onSelectCommand={onSelectCommand}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}

        {/* Template Commands Section */}
        {showTemplates && (
          <div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-grimoire-gold/20 to-transparent border-b border-grimoire-gold/30">
              <Scroll size={14} className="text-grimoire-gold" />
              <span className="font-fantasy text-sm font-semibold text-grimoire-gold">
                Scrolls (Templates)
              </span>
            </div>
            {Object.values(commandsData.templates).map((category) => (
              <CategoryItem
                key={category.name}
                category={category}
                type="template"
                selectedCommand={selectedCommand}
                onSelectCommand={onSelectCommand}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
