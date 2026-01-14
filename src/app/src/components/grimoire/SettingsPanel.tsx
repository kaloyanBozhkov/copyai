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
    <div className="grimoire-settings">
      {/* API Keys Section */}
      <div className="grimoire-settings-section">
        <div className="grimoire-settings-header">
          <Key size={18} />
          <h3>API Keys</h3>
        </div>
        <p className="grimoire-settings-description">
          Configure API keys for AI-powered commands. Keys are stored locally.
        </p>

        <div className="grimoire-settings-fields">
          {/* OpenAI Key */}
          <div className="grimoire-api-key-field">
            <label>OpenAI API Key</label>
            <div className="grimoire-api-key-input">
              <input
                type={showOpenai ? "text" : "password"}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
              />
              <button
                className="grimoire-toggle-visibility"
                onClick={() => setShowOpenai(!showOpenai)}
              >
                {showOpenai ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                className="grimoire-save-key"
                onClick={() => handleSaveApiKey("OPENAI_API_KEY", openaiKey)}
              >
                <Save size={14} />
              </button>
            </div>
          </div>

          {/* OpenRouter Key */}
          <div className="grimoire-api-key-field">
            <label>OpenRouter API Key</label>
            <div className="grimoire-api-key-input">
              <input
                type={showOpenrouter ? "text" : "password"}
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder="sk-or-..."
              />
              <button
                className="grimoire-toggle-visibility"
                onClick={() => setShowOpenrouter(!showOpenrouter)}
              >
                {showOpenrouter ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                className="grimoire-save-key"
                onClick={() => handleSaveApiKey("OPENROUTER_API_KEY", openrouterKey)}
              >
                <Save size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Book (Custom Dictionary) Section */}
      <div className="grimoire-settings-section">
        <div className="grimoire-settings-header">
          <Book size={18} />
          <h3>The Book</h3>
        </div>
        <div className="grimoire-settings-info">
          <Info size={14} />
          <p>
            Define custom fields that can be referenced in templates using{" "}
            <code>{"${book.fieldname}"}</code> syntax.
          </p>
        </div>

        {/* Existing fields */}
        <div className="grimoire-book-fields">
          {Object.entries(bookFields).map(([field, value]) => (
            <div key={field} className="grimoire-book-field">
              <div className="grimoire-book-field-header">
                <code className="grimoire-book-field-ref">{"${book." + field + "}"}</code>
                <button
                  className="grimoire-book-field-delete"
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
              />
            </div>
          ))}

          {Object.keys(bookFields).length === 0 && (
            <div className="grimoire-book-empty">
              <Book size={24} className="muted" />
              <p>No fields defined yet. Add your first field below.</p>
            </div>
          )}
        </div>

        {/* Add new field */}
        <div className="grimoire-book-add">
          <div className="grimoire-book-add-header">
            <Plus size={14} />
            <span>Add New Field</span>
          </div>
          <div className="grimoire-book-add-inputs">
            <input
              type="text"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value.replace(/\s+/g, "_"))}
              placeholder="field_name"
              className="grimoire-book-add-name"
            />
            <input
              type="text"
              value={newFieldValue}
              onChange={(e) => setNewFieldValue(e.target.value)}
              placeholder="Value"
              className="grimoire-book-add-value"
            />
            <button
              className="grimoire-book-add-btn"
              onClick={handleAddBookField}
              disabled={!newFieldName.trim()}
            >
              <Plus size={14} />
              Add
            </button>
          </div>
          {newFieldName && (
            <div className="grimoire-book-add-preview">
              Will be available as: <code>{"${book." + newFieldName + "}"}</code>
            </div>
          )}
        </div>
      </div>

      {/* Usage Examples */}
      <div className="grimoire-settings-section">
        <div className="grimoire-settings-header">
          <Info size={18} />
          <h3>Usage Examples</h3>
        </div>
        <div className="grimoire-settings-examples">
          <div className="grimoire-example">
            <div className="grimoire-example-title">In a template:</div>
            <pre>{"Hello ${book.name}, welcome to ${book.company}!"}</pre>
          </div>
          <div className="grimoire-example">
            <div className="grimoire-example-title">Common fields:</div>
            <ul>
              <li><code>name</code> - Your name</li>
              <li><code>email</code> - Your email address</li>
              <li><code>company</code> - Company name</li>
              <li><code>signature</code> - Email signature</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

