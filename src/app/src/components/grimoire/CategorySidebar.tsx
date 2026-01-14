import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Zap, Scroll, Wand2, Sparkles } from "lucide-react";
import type { CommandsData, CommandInfo, CustomTemplate, CategoryGroup } from "./types";

interface CategorySidebarProps {
  commandsData: CommandsData;
  selectedCommand: CommandInfo | null;
  selectedCustomTemplate: CustomTemplate | null;
  onSelectCommand: (command: CommandInfo | null) => void;
  onSelectCustomTemplate: (template: CustomTemplate | null) => void;
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
    <div className="grimoire-category">
      <button
        className="grimoire-category-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="grimoire-category-expand">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <TypeIcon size={14} className={`grimoire-category-type ${type}`} />
        <span className="grimoire-category-name">{category.name}</span>
        <span className="grimoire-category-count">
          {filteredCommands.length +
            Object.values(filteredSubcategories).reduce((a, b) => a + b.length, 0)}
        </span>
      </button>

      {isExpanded && (
        <div className="grimoire-category-content">
          {filteredCommands.map((cmd) => (
            <button
              key={cmd.fullKey}
              className={`grimoire-command-item ${
                selectedCommand?.fullKey === cmd.fullKey ? "selected" : ""
              }`}
              onClick={() => onSelectCommand(cmd)}
            >
              <Wand2 size={12} className="grimoire-command-icon" />
              <span>{cmd.name}</span>
            </button>
          ))}

          {Object.entries(filteredSubcategories).map(([subcat, commands]) => (
            <div key={subcat} className="grimoire-subcategory">
              <button
                className="grimoire-subcategory-header"
                onClick={() => toggleSubcat(subcat)}
              >
                {expandedSubcats[subcat] ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                <span>{subcat}</span>
                <span className="grimoire-subcategory-count">{commands.length}</span>
              </button>

              {expandedSubcats[subcat] && (
                <div className="grimoire-subcategory-content">
                  {commands.map((cmd) => (
                    <button
                      key={cmd.fullKey}
                      className={`grimoire-command-item ${
                        selectedCommand?.fullKey === cmd.fullKey ? "selected" : ""
                      }`}
                      onClick={() => onSelectCommand(cmd)}
                    >
                      <Wand2 size={12} className="grimoire-command-icon" />
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
  onSelectCommand,
  onSelectCustomTemplate,
  filter,
  searchQuery,
}: CategorySidebarProps) {
  const [customExpanded, setCustomExpanded] = useState(true);

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

  return (
    <div className="grimoire-sidebar">
      <div className="grimoire-sidebar-scroll">
        {/* Custom Templates Section */}
        {showTemplates && filteredCustomTemplates.length > 0 && (
          <div className="grimoire-section">
            <div className="grimoire-section-header custom">
              <Sparkles size={14} />
              <span>Your Inscriptions</span>
            </div>

            <div className="grimoire-category custom-templates">
              <button
                className="grimoire-category-header custom"
                onClick={() => setCustomExpanded(!customExpanded)}
              >
                <div className="grimoire-category-expand">
                  {customExpanded ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </div>
                <span className="grimoire-category-name">Custom Scrolls</span>
                <span className="grimoire-category-count">
                  {filteredCustomTemplates.length}
                </span>
              </button>

              {customExpanded && (
                <div className="grimoire-category-content">
                  {filteredCustomTemplates.map((template) => (
                    <button
                      key={template.id}
                      className={`grimoire-command-item custom ${
                        selectedCustomTemplate?.id === template.id ? "selected" : ""
                      }`}
                      onClick={() => onSelectCustomTemplate(template)}
                    >
                      <Scroll size={12} className="grimoire-command-icon custom" />
                      <span>{template.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Executable Commands Section */}
        {showExecs && (
          <div className="grimoire-section">
            <div className="grimoire-section-header execs">
              <Zap size={14} />
              <span>Spells (Executables)</span>
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
          <div className="grimoire-section">
            <div className="grimoire-section-header templates">
              <Scroll size={14} />
              <span>Scrolls (Templates)</span>
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

