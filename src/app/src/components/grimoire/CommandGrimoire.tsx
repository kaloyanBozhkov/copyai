import { useState, useEffect, useCallback } from "react";
import { ipcRenderer } from "@/utils/electron";
import { CategorySidebar } from "./CategorySidebar";
import { CommandDetail } from "./CommandDetail";
import { CreateTemplateModal } from "./CreateTemplateModal";
import { GrimoireHeader } from "./GrimoireHeader";
import type { CommandsData, CommandInfo, CustomTemplate } from "./types";

export default function CommandGrimoire() {
  const [commandsData, setCommandsData] = useState<CommandsData | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<CommandInfo | null>(null);
  const [selectedCustomTemplate, setSelectedCustomTemplate] = useState<CustomTemplate | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "execs" | "templates">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    ipcRenderer.send("grimoire-mounted");

    const handleInit = (_: unknown, data: { commands: CommandsData }) => {
      setCommandsData(data.commands);
    };

    const handleCommandsData = (_: unknown, data: CommandsData) => {
      setCommandsData(data);
    };

    ipcRenderer.on("grimoire-init", handleInit);
    ipcRenderer.on("grimoire-commands-data", handleCommandsData);

    return () => {
      ipcRenderer.removeListener("grimoire-init", handleInit);
      ipcRenderer.removeListener("grimoire-commands-data", handleCommandsData);
    };
  }, []);

  const handleSelectCommand = useCallback((command: CommandInfo | null) => {
    setSelectedCommand(command);
    setSelectedCustomTemplate(null);
  }, []);

  const handleSelectCustomTemplate = useCallback((template: CustomTemplate | null) => {
    setSelectedCustomTemplate(template);
    setSelectedCommand(null);
  }, []);

  const handleDeleteCustomTemplate = useCallback((id: string) => {
    ipcRenderer.send("grimoire-remove-template", id);
    if (selectedCustomTemplate?.id === id) {
      setSelectedCustomTemplate(null);
    }
  }, [selectedCustomTemplate]);

  const handleCreateTemplate = useCallback(
    (template: Omit<CustomTemplate, "id" | "createdAt">) => {
      ipcRenderer.send("grimoire-add-template", template);
      setIsCreateModalOpen(false);
    },
    []
  );

  const handleClose = () => ipcRenderer.send("grimoire-close");
  const handleMinimize = () => ipcRenderer.send("grimoire-minimize");

  if (!commandsData) {
    return (
      <div className="grimoire-loading">
        <div className="grimoire-loading-rune" />
        <span>Summoning the Grimoire...</span>
      </div>
    );
  }

  return (
    <div className="grimoire-container">
      <GrimoireHeader
        onClose={handleClose}
        onMinimize={handleMinimize}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filter={filter}
        onFilterChange={setFilter}
        onCreateTemplate={() => setIsCreateModalOpen(true)}
      />

      <div className="grimoire-content">
        <CategorySidebar
          commandsData={commandsData}
          selectedCommand={selectedCommand}
          selectedCustomTemplate={selectedCustomTemplate}
          onSelectCommand={handleSelectCommand}
          onSelectCustomTemplate={handleSelectCustomTemplate}
          filter={filter}
          searchQuery={searchQuery}
        />

        <CommandDetail
          command={selectedCommand}
          customTemplate={selectedCustomTemplate}
          onDeleteCustomTemplate={handleDeleteCustomTemplate}
        />
      </div>

      {isCreateModalOpen && (
        <CreateTemplateModal
          existingCategories={[
            ...new Set([
              ...Object.keys(commandsData.templates),
              ...commandsData.customTemplates.map((t) => t.category),
            ]),
          ]}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateTemplate}
        />
      )}
    </div>
  );
}

