import { useState, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { ipcRenderer } from "@/utils/electron";
import { CategorySidebar } from "./CategorySidebar";
import { CommandDetail } from "./CommandDetail";
import { CreateTemplateModal } from "./CreateTemplateModal";
import { GrimoireHeader } from "./GrimoireHeader";
import { SettingsPanel } from "./SettingsPanel";
import { BookModal } from "./BookModal";
import { AlchemyModal } from "./AlchemyModal";
import type { CommandsData, CommandInfo, CustomTemplate, GrimoireSettings } from "./types";

export default function CommandGrimoire() {
  const [commandsData, setCommandsData] = useState<CommandsData | null>(null);
  const [settings, setSettings] = useState<GrimoireSettings | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<CommandInfo | null>(null);
  const [selectedCustomTemplate, setSelectedCustomTemplate] = useState<CustomTemplate | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplate | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isAlchemyOpen, setIsAlchemyOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "execs" | "templates">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
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

    // Register listeners BEFORE sending the mounted message
    ipcRenderer.on("grimoire-init", handleInit);
    ipcRenderer.on("grimoire-commands-data", handleCommandsData);
    ipcRenderer.on("grimoire-settings-data", handleSettingsData);

    // Now send the mounted message
    ipcRenderer.send("grimoire-mounted");

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

  const handleOpenBook = useCallback(() => {
    setIsBookOpen(!isBookOpen);
  }, [isBookOpen]);

  const handleOpenAlchemy = useCallback(() => {
    setIsAlchemyOpen(!isAlchemyOpen);
  }, [isAlchemyOpen]);

  if (!commandsData || !settings) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-grimoire-bg font-serif-grimoire pointer-events-auto">
        <div className="text-center space-y-4">
          <Sparkles className="w-12 h-12 mx-auto text-grimoire-gold animate-pulse" />
          <span className="text-grimoire-text font-fantasy text-lg">
            Summoning the Grimoire...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-grimoire-bg text-grimoire-text font-serif-grimoire pointer-events-auto overflow-hidden">
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
        onOpenBook={handleOpenBook}
        isBookOpen={isBookOpen}
        onOpenAlchemy={handleOpenAlchemy}
        isAlchemyOpen={isAlchemyOpen}
      />

      <div className="flex-1 flex overflow-hidden">
        {isSettingsOpen && settings ? (
          <SettingsPanel settings={settings} />
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
          bookFields={settings.book}
          alchemyPotions={settings.alchemy || []}
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
          bookFields={settings.book}
          alchemyPotions={settings.alchemy || []}
          existingTemplate={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onCreate={handleCreateTemplate}
          onUpdate={handleUpdateTemplate}
        />
      )}

      {isBookOpen && (
        <BookModal
          bookFields={settings.book}
          onClose={() => setIsBookOpen(false)}
        />
      )}

      {isAlchemyOpen && settings && (
        <AlchemyModal
          potions={settings.alchemy || []}
          onClose={() => setIsAlchemyOpen(false)}
        />
      )}
    </div>
  );
}
