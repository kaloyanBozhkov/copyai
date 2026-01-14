import { useState, useEffect, useCallback } from "react";
import { ipcRenderer } from "@/utils/electron";
import { CategorySidebar } from "./CategorySidebar";
import { CommandDetail } from "./CommandDetail";
import { CreateTemplateModal } from "./CreateTemplateModal";
import { GrimoireHeader } from "./GrimoireHeader";
import { SettingsPanel } from "./SettingsPanel";
import type { CommandsData, CommandInfo, CustomTemplate, GrimoireSettings } from "./types";

export default function CommandGrimoire() {
  const [commandsData, setCommandsData] = useState<CommandsData | null>(null);
  const [settings, setSettings] = useState<GrimoireSettings | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<CommandInfo | null>(null);
  const [selectedCustomTemplate, setSelectedCustomTemplate] = useState<CustomTemplate | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplate | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "execs" | "templates">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    ipcRenderer.send("grimoire-mounted");

    const handleInit = (_: unknown, data: { commands: CommandsData; settings: GrimoireSettings }) => {
      setCommandsData(data.commands);
      setSettings(data.settings);
    };

    const handleCommandsData = (_: unknown, data: CommandsData) => {
      setCommandsData(data);
    };

    const handleSettingsData = (_: unknown, data: GrimoireSettings) => {
      setSettings(data);
    };

    ipcRenderer.on("grimoire-init", handleInit);
    ipcRenderer.on("grimoire-commands-data", handleCommandsData);
    ipcRenderer.on("grimoire-settings-data", handleSettingsData);

    return () => {
      ipcRenderer.removeListener("grimoire-init", handleInit);
      ipcRenderer.removeListener("grimoire-commands-data", handleCommandsData);
      ipcRenderer.removeListener("grimoire-settings-data", handleSettingsData);
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

  const handleEditCustomTemplate = useCallback((template: CustomTemplate) => {
    setEditingTemplate(template);
  }, []);

  const handleUpdateTemplate = useCallback(
    (id: string, template: Omit<CustomTemplate, "id" | "createdAt">) => {
      ipcRenderer.send("grimoire-update-template", { id, updates: template });
      setEditingTemplate(null);
    },
    []
  );

  const handleClose = () => ipcRenderer.send("grimoire-close");
  const handleMinimize = () => ipcRenderer.send("grimoire-minimize");

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(!isSettingsOpen);
    if (!isSettingsOpen) {
      // Clear selection when opening settings
      setSelectedCommand(null);
      setSelectedCustomTemplate(null);
    }
  }, [isSettingsOpen]);

  if (!commandsData || !settings) {
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
        onOpenSettings={handleOpenSettings}
        isSettingsOpen={isSettingsOpen}
      />

      <div className="grimoire-content">
        {isSettingsOpen && settings ? (
          <div className="grimoire-settings-container">
            <SettingsPanel settings={settings} />
          </div>
        ) : (
          <>
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
              onEditCustomTemplate={handleEditCustomTemplate}
            />
          </>
        )}
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

      {editingTemplate && (
        <CreateTemplateModal
          existingCategories={[
            ...new Set([
              ...Object.keys(commandsData.templates),
              ...commandsData.customTemplates.map((t) => t.category),
            ]),
          ]}
          existingTemplate={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onCreate={handleCreateTemplate}
          onUpdate={handleUpdateTemplate}
        />
      )}
    </div>
  );
}

