import { useState } from "react";
import {
  Key,
  Eye,
  EyeOff,
  Save,
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

  const handleSaveApiKey = (key: "OPENAI_API_KEY" | "OPENROUTER_API_KEY", value: string) => {
    ipcRenderer.send("grimoire-set-api-key", { key, value });
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
    </div>
  );
}
