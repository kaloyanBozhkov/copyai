import { useState } from "react";
import { Key, Eye, EyeOff, Save, Plus, Trash2 } from "lucide-react";
import { ipcRenderer } from "@/utils/electron";
import type { GrimoireSettings } from "./types";
import { ActionButton } from "../atoms/ActionButton.atom";

interface SettingsPanelProps {
  settings: GrimoireSettings;
}

interface ApiKeyEntry {
  name: string;
  value: string;
  showValue: boolean;
}

export function SettingsPanel({ settings }: SettingsPanelProps) {
  // Initialize state from settings.apiKeys
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>(() => {
    const entries = Object.entries(settings.apiKeys);
    // Ensure default keys exist
    const defaultKeys = ["OPENAI_API_KEY", "OPENROUTER_API_KEY"];
    const result: ApiKeyEntry[] = [];
    
    for (const key of defaultKeys) {
      result.push({
        name: key,
        value: settings.apiKeys[key] || "",
        showValue: false,
      });
    }
    
    // Add any custom keys not in defaults
    for (const [key, value] of entries) {
      if (!defaultKeys.includes(key)) {
        result.push({
          name: key,
          value: value || "",
          showValue: false,
        });
      }
    }
    
    return result;
  });

  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");

  const handleUpdateKey = (index: number, value: string) => {
    const updated = [...apiKeys];
    updated[index] = { ...updated[index], value };
    setApiKeys(updated);
  };

  const handleToggleShow = (index: number) => {
    const updated = [...apiKeys];
    updated[index] = { ...updated[index], showValue: !updated[index].showValue };
    setApiKeys(updated);
  };

  const handleSaveKey = (index: number) => {
    const entry = apiKeys[index];
    ipcRenderer.send("grimoire-set-api-key", { key: entry.name, value: entry.value });
  };

  const handleAddKey = () => {
    if (!newKeyName.trim()) return;
    const keyName = newKeyName.trim().toUpperCase().replace(/\s+/g, "_");
    
    // Check if key already exists
    if (apiKeys.some((k) => k.name === keyName)) return;
    
    setApiKeys([...apiKeys, { name: keyName, value: newKeyValue, showValue: false }]);
    setNewKeyName("");
    setNewKeyValue("");
    
    // Save key to backend
    ipcRenderer.send("grimoire-set-api-key", { key: keyName, value: newKeyValue });
  };

  const handleRemoveKey = (index: number) => {
    const entry = apiKeys[index];
    // Don't allow removing default keys
    if (["OPENAI_API_KEY", "OPENROUTER_API_KEY"].includes(entry.name)) return;
    
    const updated = apiKeys.filter((_, i) => i !== index);
    setApiKeys(updated);
    
    // Remove from backend
    ipcRenderer.send("grimoire-remove-api-key", entry.name);
  };

  const isDefaultKey = (name: string) =>
    ["OPENAI_API_KEY", "OPENROUTER_API_KEY"].includes(name);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-8">
      {/* API Keys Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-grimoire-gold">
          <Key size={18} />
          <h3 className="font-fantasy text-lg font-bold">API Keys</h3>
        </div>
        <p className="text-grimoire-text-dim text-sm">
          Configure API keys for AI-powered commands and alchemy potions. Keys are stored locally.
          <br />
          Reference keys in potions with{" "}
          <code className="px-1 py-0.5 bg-black/30 rounded text-grimoire-green font-grimoire text-xs">
            ${"{env.KEY_NAME}"}
          </code>
        </p>

        <div className="space-y-3">
          {apiKeys.map((entry, index) => (
            <div key={entry.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-grimoire-text font-fantasy text-sm font-medium">
                  {entry.name}
                </label>
                {!isDefaultKey(entry.name) && (
                  <button
                    className="p-1 rounded text-grimoire-text-dim hover:text-grimoire-red hover:bg-grimoire-red/10 transition-all"
                    onClick={() => handleRemoveKey(index)}
                    title="Remove key"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type={entry.showValue ? "text" : "password"}
                  value={entry.value}
                  onChange={(e) => handleUpdateKey(index, e.target.value)}
                  placeholder="Enter value..."
                  className="flex-1 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-grimoire placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-gold-dim focus:ring-1 focus:ring-grimoire-gold-dim transition-all"
                />
                <button
                  className="p-2 rounded bg-black/30 border border-grimoire-border text-grimoire-text-dim hover:text-grimoire-text hover:border-grimoire-border transition-all"
                  onClick={() => handleToggleShow(index)}
                  title={entry.showValue ? "Hide" : "Show"}
                >
                  {entry.showValue ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  className="p-2 rounded bg-grimoire-gold/20 border border-grimoire-gold/50 text-grimoire-gold hover:bg-grimoire-gold/30 transition-all"
                  onClick={() => handleSaveKey(index)}
                  title="Save"
                >
                  <Save size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add new key */}
        <div className="pt-4 border-t border-grimoire-border space-y-2">
          <label className="text-grimoire-text font-fantasy text-sm font-medium">
            Add Custom Key
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
              placeholder="KEY_NAME"
              className="flex-1 basis-1/2 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-mono placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-green focus:ring-1 focus:ring-grimoire-green transition-all"
            />
            <input
              type="text"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="value..."
              className="flex-1 basis-1/2 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-grimoire placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-green focus:ring-1 focus:ring-grimoire-green transition-all"
              onKeyDown={(e) => e.key === "Enter" && handleAddKey()}
            />
            <ActionButton
              variant="accent"
              onClick={handleAddKey}
              disabled={!newKeyName.trim()}
              icon={<Plus size={14} />}
            >
              Add
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
