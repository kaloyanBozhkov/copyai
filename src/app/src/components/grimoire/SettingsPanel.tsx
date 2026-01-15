import { useState } from "react";
import {
  Key,
  Book,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Info,
} from "lucide-react";
import { ipcRenderer } from "@/utils/electron";
import type { GrimoireSettings } from "./types";

interface SettingsPanelProps {
  settings: GrimoireSettings;
}

export function SettingsPanel({ settings }: SettingsPanelProps) {
  const [openaiKey, setOpenaiKey] = useState(settings.apiKeys.OPENAI_API_KEY);
  const [openrouterKey, setOpenrouterKey] = useState(settings.apiKeys.OPENROUTER_API_KEY);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showOpenrouter, setShowOpenrouter] = useState(false);
  const [bookFields, setBookFields] = useState<Record<string, string>>(settings.book);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");

  const handleSaveApiKey = (key: "OPENAI_API_KEY" | "OPENROUTER_API_KEY", value: string) => {
    ipcRenderer.send("grimoire-set-api-key", { key, value });
  };

  const handleAddBookField = () => {
    if (!newFieldName.trim()) return;
    const fieldName = newFieldName.trim().replace(/\s+/g, "_");
    ipcRenderer.send("grimoire-set-book-field", { 
      field: fieldName, 
      value: newFieldValue 
    });
    setBookFields({ ...bookFields, [fieldName]: newFieldValue });
    setNewFieldName("");
    setNewFieldValue("");
  };

  const handleUpdateBookField = (field: string, value: string) => {
    ipcRenderer.send("grimoire-set-book-field", { field, value });
    setBookFields({ ...bookFields, [field]: value });
  };

  const handleRemoveBookField = (field: string) => {
    ipcRenderer.send("grimoire-remove-book-field", field);
    const updated = { ...bookFields };
    delete updated[field];
    setBookFields(updated);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-8">
      {/* API Keys Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-grimoire-gold">
          <Key size={18} />
          <h3 className="font-fantasy text-lg font-bold">API Keys</h3>
        </div>
        <p className="text-grimoire-text-dim text-sm">
          Configure API keys for AI-powered commands. Keys are stored locally.
        </p>

        <div className="space-y-4">
          {/* OpenAI Key */}
          <div className="space-y-2">
            <label className="text-grimoire-text font-fantasy text-sm font-medium">
              OpenAI API Key
            </label>
            <div className="flex gap-2">
              <input
                type={showOpenai ? "text" : "password"}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-grimoire placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-gold-dim focus:ring-1 focus:ring-grimoire-gold-dim transition-all"
              />
              <button
                className="p-2 rounded bg-black/30 border border-grimoire-border text-grimoire-text-dim hover:text-grimoire-text hover:border-grimoire-border transition-all"
                onClick={() => setShowOpenai(!showOpenai)}
                title={showOpenai ? "Hide" : "Show"}
              >
                {showOpenai ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                className="p-2 rounded bg-grimoire-gold/20 border border-grimoire-gold/50 text-grimoire-gold hover:bg-grimoire-gold/30 transition-all"
                onClick={() => handleSaveApiKey("OPENAI_API_KEY", openaiKey)}
                title="Save"
              >
                <Save size={14} />
              </button>
            </div>
          </div>

          {/* OpenRouter Key */}
          <div className="space-y-2">
            <label className="text-grimoire-text font-fantasy text-sm font-medium">
              OpenRouter API Key
            </label>
            <div className="flex gap-2">
              <input
                type={showOpenrouter ? "text" : "password"}
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder="sk-or-..."
                className="flex-1 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-grimoire placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-gold-dim focus:ring-1 focus:ring-grimoire-gold-dim transition-all"
              />
              <button
                className="p-2 rounded bg-black/30 border border-grimoire-border text-grimoire-text-dim hover:text-grimoire-text hover:border-grimoire-border transition-all"
                onClick={() => setShowOpenrouter(!showOpenrouter)}
                title={showOpenrouter ? "Hide" : "Show"}
              >
                {showOpenrouter ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                className="p-2 rounded bg-grimoire-gold/20 border border-grimoire-gold/50 text-grimoire-gold hover:bg-grimoire-gold/30 transition-all"
                onClick={() => handleSaveApiKey("OPENROUTER_API_KEY", openrouterKey)}
                title="Save"
              >
                <Save size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Book (Custom Dictionary) Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-grimoire-gold">
          <Book size={18} />
          <h3 className="font-fantasy text-lg font-bold">The Book</h3>
        </div>
        <div className="flex items-start gap-2 p-3 bg-grimoire-accent/10 border border-grimoire-accent/30 rounded">
          <Info size={14} className="text-grimoire-accent-bright mt-0.5 flex-shrink-0" />
          <p className="text-grimoire-text-dim text-sm">
            Define custom fields that can be referenced in templates using{" "}
            <code className="px-1.5 py-0.5 bg-black/30 rounded text-grimoire-accent-bright font-grimoire text-xs">
              {"${book.fieldname}"}
            </code>{" "}
            syntax.
          </p>
        </div>

        {/* Existing fields */}
        <div className="space-y-2">
          {Object.entries(bookFields).map(([field, value]) => (
            <div
              key={field}
              className="p-3 bg-black/20 border border-grimoire-border rounded space-y-2"
            >
              <div className="flex items-center justify-between">
                <code className="text-grimoire-gold font-grimoire text-xs">
                  {"${book." + field + "}"}
                </code>
                <button
                  className="p-1 rounded text-grimoire-text-dim hover:text-grimoire-red hover:bg-grimoire-red/10 transition-all"
                  onClick={() => handleRemoveBookField(field)}
                  title="Remove field"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <input
                type="text"
                value={value}
                onChange={(e) => handleUpdateBookField(field, e.target.value)}
                placeholder="Enter value..."
                className="w-full px-3 py-2 bg-black/30 border border-grimoire-border/50 rounded text-grimoire-text text-sm placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-gold-dim focus:ring-1 focus:ring-grimoire-gold-dim transition-all"
              />
            </div>
          ))}

          {Object.keys(bookFields).length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Book size={24} className="text-grimoire-text-dim mb-2 opacity-50" />
              <p className="text-grimoire-text-dim text-sm">
                No fields defined yet. Add your first field below.
              </p>
            </div>
          )}
        </div>

        {/* Add new field */}
        <div className="p-4 bg-gradient-to-br from-grimoire-gold/10 to-transparent border border-grimoire-gold/30 rounded space-y-3">
          <div className="flex items-center gap-2 text-grimoire-gold font-fantasy text-sm font-semibold">
            <Plus size={14} />
            <span>Add New Field</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value.replace(/\s+/g, "_"))}
              placeholder="field_name"
              className="flex-1 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-grimoire placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-gold-dim focus:ring-1 focus:ring-grimoire-gold-dim transition-all"
            />
            <input
              type="text"
              value={newFieldValue}
              onChange={(e) => setNewFieldValue(e.target.value)}
              placeholder="Value"
              className="flex-1 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-gold-dim focus:ring-1 focus:ring-grimoire-gold-dim transition-all"
            />
            <button
              className="flex items-center gap-2 px-4 py-2 rounded bg-grimoire-gold/20 border border-grimoire-gold/50 text-grimoire-gold font-fantasy text-sm font-semibold hover:bg-grimoire-gold/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              onClick={handleAddBookField}
              disabled={!newFieldName.trim()}
            >
              <Plus size={14} />
              Add
            </button>
          </div>
          {newFieldName && (
            <div className="text-grimoire-text-dim text-xs">
              Will be available as:{" "}
              <code className="px-1.5 py-0.5 bg-black/30 rounded text-grimoire-gold font-grimoire">
                {"${book." + newFieldName + "}"}
              </code>
            </div>
          )}
        </div>
      </div>

      {/* Usage Examples */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-grimoire-accent-bright">
          <Info size={18} />
          <h3 className="font-fantasy text-lg font-bold">Usage Examples</h3>
        </div>
        <div className="space-y-3">
          <div className="p-4 bg-black/20 border border-grimoire-border rounded space-y-2">
            <div className="text-grimoire-text font-fantasy text-sm font-medium">
              In a template:
            </div>
            <pre className="p-3 bg-black/30 rounded text-grimoire-text text-xs font-grimoire">
              {"Hello ${book.name}, welcome to ${book.company}!"}
            </pre>
          </div>
          <div className="p-4 bg-black/20 border border-grimoire-border rounded space-y-2">
            <div className="text-grimoire-text font-fantasy text-sm font-medium">
              Common fields:
            </div>
            <ul className="space-y-1 text-grimoire-text-dim text-sm list-disc list-inside">
              <li>
                <code className="px-1.5 py-0.5 bg-black/30 rounded text-grimoire-gold font-grimoire text-xs">
                  name
                </code>{" "}
                - Your name
              </li>
              <li>
                <code className="px-1.5 py-0.5 bg-black/30 rounded text-grimoire-gold font-grimoire text-xs">
                  email
                </code>{" "}
                - Your email address
              </li>
              <li>
                <code className="px-1.5 py-0.5 bg-black/30 rounded text-grimoire-gold font-grimoire text-xs">
                  company
                </code>{" "}
                - Company name
              </li>
              <li>
                <code className="px-1.5 py-0.5 bg-black/30 rounded text-grimoire-gold font-grimoire text-xs">
                  signature
                </code>{" "}
                - Email signature
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
