import { useState, useMemo, useEffect } from "react";
import {
  X,
  Beaker,
  Plus,
  Trash2,
  Search,
  Info,
  Play,
  Edit2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ipcRenderer } from "@/utils/electron";
import type { AlchemyPotion } from "./types";
import { ActionButton } from "../atoms/ActionButton.atom";

interface AlchemyModalProps {
  potions: AlchemyPotion[];
  onClose: () => void;
}

export function AlchemyModal({
  potions: initialPotions,
  onClose,
}: AlchemyModalProps) {
  const [potions, setPotions] = useState<AlchemyPotion[]>(initialPotions);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPotion, setEditingPotion] = useState<AlchemyPotion | null>(
    null
  );
  const [isCreating, setIsCreating] = useState(false);
  const [testingPotionId, setTestingPotionId] = useState<string | null>(null);
  const [expandedPotionIds, setExpandedPotionIds] = useState<Set<string>>(
    new Set()
  );
  const [deletingPotion, setDeletingPotion] = useState<AlchemyPotion | null>(
    null
  );

  const filteredPotions = useMemo(() => {
    if (!searchQuery) return potions;
    const q = searchQuery.toLowerCase();
    return potions.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.url.toLowerCase().includes(q) ||
        p.method.toLowerCase().includes(q)
    );
  }, [potions, searchQuery]);

  useEffect(() => {
    const handlePotionResult = (
      _: unknown,
      data: { result?: string; potion?: AlchemyPotion; error?: string }
    ) => {
      if (data.error) {
        console.error("Potion execution failed:", data.error);
        setTestingPotionId(null);
        return;
      }
      if (data.potion) {
        // Update the potion in the list with the new result
        setPotions((prev) =>
          prev.map((p) => (p.id === data.potion!.id ? data.potion! : p))
        );
        setTestingPotionId(null);
      }
    };

    const handleSettingsUpdate = (
      _: unknown,
      settings: { alchemy?: AlchemyPotion[] }
    ) => {
      if (settings.alchemy) {
        setPotions(settings.alchemy);
      }
    };

    ipcRenderer.on("grimoire-potion-result", handlePotionResult);
    ipcRenderer.on("grimoire-settings-data", handleSettingsUpdate);

    return () => {
      ipcRenderer.removeListener("grimoire-potion-result", handlePotionResult);
      ipcRenderer.removeListener(
        "grimoire-settings-data",
        handleSettingsUpdate
      );
    };
  }, []);

  const handleTestPotion = async (potion: AlchemyPotion) => {
    setTestingPotionId(potion.id);
    ipcRenderer.send("grimoire-execute-potion", potion.id);
  };

  const handleSavePotion = (potion: AlchemyPotion) => {
    if (isCreating) {
      // Create new
      ipcRenderer.send("grimoire-add-potion", potion);
    } else {
      // Update existing
      ipcRenderer.send("grimoire-update-potion", potion);
    }
    setEditingPotion(null);
    setIsCreating(false);
  };

  const handleDeleteClick = (potion: AlchemyPotion) => {
    setDeletingPotion(potion);
  };

  const handleConfirmDelete = () => {
    if (deletingPotion) {
      ipcRenderer.send("grimoire-remove-potion", deletingPotion.id);
      setDeletingPotion(null);
    }
  };

  const handleCancelDelete = () => {
    setDeletingPotion(null);
  };

  const startCreating = () => {
    setEditingPotion({
      id: `potion_${Date.now()}`,
      name: "",
      method: "GET",
      url: "",
      headers: {},
    });
    setIsCreating(true);
  };

  const togglePotionExpanded = (id: string) => {
    setExpandedPotionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-gradient-to-br from-grimoire-bg-secondary to-grimoire-bg border border-grimoire-purple rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-grimoire-purple/50 bg-gradient-to-r from-grimoire-purple/10 to-transparent">
          <div className="flex items-center gap-3">
            <Beaker size={20} className="text-grimoire-purple-bright" />
            <h2 className="font-fantasy text-grimoire-purple-bright font-bold text-xl">
              Alchemy Lab
            </h2>
          </div>
          <button
            className="p-1 rounded text-grimoire-text-dim hover:text-grimoire-text hover:bg-white/10 transition-all"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Info */}
        <div className="px-6 py-4 border-b border-grimoire-border/50 bg-gradient-to-br from-grimoire-purple/5 to-transparent">
          <div className="flex items-start gap-3">
            <Info
              size={16}
              className="text-grimoire-purple-bright mt-0.5 flex-shrink-0"
            />
            <p className="text-grimoire-text-dim text-sm">
              Create dynamic potions that fetch values from APIs. Reference them
              using{" "}
              <code className="px-1.5 py-0.5 bg-black/30 rounded text-grimoire-purple-bright font-grimoire text-xs">
                ${"{alchemy.potionname}"}
              </code>{" "}
              in templates. Values are fetched when templates are executed.
            </p>
          </div>
        </div>

        {!editingPotion ? (
          <>
            {/* Search & Add */}
            <div className="px-6 py-3 border-b border-grimoire-border/50 flex gap-3">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-grimoire-text-dim pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search potions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text placeholder:text-grimoire-text-dim text-sm focus:outline-none focus:border-grimoire-purple focus:ring-1 focus:ring-grimoire-purple transition-all"
                />
              </div>
              <ActionButton
                variant="purple"
                className="text-sm"
                onClick={startCreating}
                icon={<Plus size={14} />}
              >
                New Potion
              </ActionButton>
            </div>

            {/* Potions List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
              {filteredPotions.length === 0 && potions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Beaker
                    size={48}
                    className="text-grimoire-text-dim mb-4 opacity-50"
                  />
                  <p className="text-grimoire-text-dim text-sm mb-1">
                    No potions brewed yet
                  </p>
                  <span className="text-grimoire-text-dim text-xs">
                    Click "New Potion" to create your first dynamic value
                  </span>
                </div>
              ) : filteredPotions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search
                    size={48}
                    className="text-grimoire-text-dim mb-4 opacity-50"
                  />
                  <p className="text-grimoire-text-dim text-sm">
                    No potions match your search
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPotions.map((potion) => (
                    <div
                      key={potion.id}
                      className="p-4 bg-black/20 border border-grimoire-purple/30 rounded space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-grimoire-purple-bright font-grimoire text-sm font-semibold">
                              ${"{alchemy." + potion.name + "}"}
                            </code>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-mono ${
                                potion.method === "GET"
                                  ? "bg-grimoire-accent/20 text-grimoire-accent-bright"
                                  : "bg-grimoire-gold/20 text-grimoire-gold"
                              }`}
                            >
                              {potion.method}
                            </span>
                          </div>
                          <div className="text-grimoire-text-dim text-xs font-mono mb-2">
                            {potion.url}
                          </div>
                          {potion.lastValue && (
                            <div className="mt-2">
                              <button
                                onClick={() => togglePotionExpanded(potion.id)}
                                className="flex items-center gap-1 text-grimoire-text-dim hover:text-grimoire-text text-xs font-semibold transition-all mb-1"
                              >
                                {expandedPotionIds.has(potion.id) ? (
                                  <ChevronDown size={12} />
                                ) : (
                                  <ChevronRight size={12} />
                                )}
                                <span>Last value</span>
                                {potion.lastFetched && (
                                  <span className="text-grimoire-text-dim/60 font-normal ml-1">
                                    (
                                    {new Date(
                                      potion.lastFetched
                                    ).toLocaleTimeString()}
                                    )
                                  </span>
                                )}
                              </button>
                              {expandedPotionIds.has(potion.id) && (
                                <div className="p-3 bg-black/30 rounded max-h-32 overflow-y-auto custom-scrollbar">
                                  <pre className="text-grimoire-text text-xs font-mono whitespace-pre-wrap break-words">
                                    {potion.lastValue}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            className={`p-2 rounded transition-all ${
                              testingPotionId === potion.id
                                ? "text-grimoire-accent-bright bg-grimoire-accent/10 animate-pulse"
                                : "text-grimoire-text-dim hover:text-grimoire-accent-bright hover:bg-grimoire-accent/10"
                            }`}
                            onClick={() => handleTestPotion(potion)}
                            title="Test potion"
                            disabled={testingPotionId === potion.id}
                          >
                            <Play size={14} />
                          </button>
                          <button
                            className="p-2 rounded text-grimoire-text-dim hover:text-grimoire-purple-bright hover:bg-grimoire-purple/10 transition-all"
                            onClick={() => setEditingPotion(potion)}
                            title="Edit potion"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="p-2 rounded text-grimoire-text-dim hover:text-grimoire-red hover:bg-grimoire-red/10 transition-all"
                            onClick={() => handleDeleteClick(potion)}
                            title="Delete potion"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <PotionEditor
            potion={editingPotion}
            onSave={handleSavePotion}
            onCancel={() => {
              setEditingPotion(null);
              setIsCreating(false);
            }}
            isCreating={isCreating}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingPotion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
          onClick={handleCancelDelete}
        >
          <div
            className="w-full max-w-md bg-gradient-to-br from-grimoire-bg-secondary to-grimoire-bg border-2 border-grimoire-red/50 rounded-lg shadow-2xl overflow-hidden pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-grimoire-red/30 bg-gradient-to-r from-grimoire-red/20 to-transparent">
              <h3 className="font-fantasy text-grimoire-red font-bold text-lg flex items-center gap-2">
                <Trash2 size={20} />
                Delete Potion
              </h3>
            </div>
            <div className="px-6 py-6 space-y-4">
              <p className="text-grimoire-text text-sm">
                Are you sure you want to delete the potion{" "}
                <code className="px-1.5 py-0.5 bg-grimoire-purple/20 rounded font-grimoire font-semibold text-grimoire-purple-bright">
                  ${"{alchemy." + deletingPotion.name + "}"}
                </code>
                ?
              </p>
              <p className="text-grimoire-text-dim text-sm">
                This action cannot be undone. Any templates using this potion
                will fail to fetch this value.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-grimoire-border bg-black/20 flex justify-end gap-3">
              <ActionButton variant="ghost" onClick={handleCancelDelete}>
                Cancel
              </ActionButton>
              <ActionButton
                variant="danger"
                onClick={handleConfirmDelete}
                icon={<Trash2 size={14} />}
              >
                Delete
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PotionEditorProps {
  potion: AlchemyPotion;
  onSave: (potion: AlchemyPotion) => void;
  onCancel: () => void;
  isCreating: boolean;
}

function PotionEditor({
  potion: initialPotion,
  onSave,
  onCancel,
  isCreating,
}: PotionEditorProps) {
  const [potion, setPotion] = useState(initialPotion);
  const [headerKey, setHeaderKey] = useState("");
  const [headerValue, setHeaderValue] = useState("");

  const handleAddHeader = () => {
    if (!headerKey.trim()) return;
    setPotion({
      ...potion,
      headers: { ...potion.headers, [headerKey]: headerValue },
    });
    setHeaderKey("");
    setHeaderValue("");
  };

  const handleRemoveHeader = (key: string) => {
    const updated = { ...potion.headers };
    delete updated[key];
    setPotion({ ...potion, headers: updated });
  };

  const isValidUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const canSave =
    potion.name.trim() && potion.url.trim() && isValidUrl(potion.url);
  const urlError = potion.url.trim() && !isValidUrl(potion.url);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
      <h3 className="font-fantasy text-grimoire-purple-bright font-semibold">
        {isCreating ? "Brew New Potion" : "Edit Potion"}
      </h3>

      {/* Name */}
      <div className="space-y-2">
        <label className="text-grimoire-text font-fantasy text-sm">
          Potion Name
        </label>
        <input
          type="text"
          value={potion.name}
          onChange={(e) =>
            setPotion({ ...potion, name: e.target.value.replace(/\s+/g, "_") })
          }
          placeholder="my_potion"
          className="w-full px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-grimoire placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-purple focus:ring-1 focus:ring-grimoire-purple transition-all"
        />
        {potion.name && (
          <div className="text-grimoire-text-dim text-xs">
            Will be available as:{" "}
            <code className="px-1.5 py-0.5 bg-black/30 rounded text-grimoire-purple-bright font-grimoire">
              ${"{alchemy." + potion.name + "}"}
            </code>
          </div>
        )}
      </div>

      {/* Method */}
      <div className="space-y-2">
        <label className="text-grimoire-text font-fantasy text-sm">
          Method
        </label>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded text-sm font-medium transition-all ${
              potion.method === "GET"
                ? "bg-grimoire-accent/20 text-grimoire-accent-bright border border-grimoire-accent/50"
                : "bg-black/20 text-grimoire-text-dim border border-grimoire-border hover:text-grimoire-text"
            }`}
            onClick={() =>
              setPotion({ ...potion, method: "GET", body: undefined })
            }
          >
            GET
          </button>
          <button
            className={`px-4 py-2 rounded text-sm font-medium transition-all ${
              potion.method === "POST"
                ? "bg-grimoire-gold/20 text-grimoire-gold border border-grimoire-gold/50"
                : "bg-black/20 text-grimoire-text-dim border border-grimoire-border hover:text-grimoire-text"
            }`}
            onClick={() => setPotion({ ...potion, method: "POST" })}
          >
            POST
          </button>
        </div>
      </div>

      {/* URL */}
      <div className="space-y-2">
        <label className="text-grimoire-text font-fantasy text-sm">URL</label>
        <input
          type="text"
          value={potion.url}
          onChange={(e) => setPotion({ ...potion, url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          className={`w-full px-3 py-2 bg-black/30 border rounded text-grimoire-text text-sm font-mono placeholder:text-grimoire-text-dim focus:outline-none transition-all ${
            urlError
              ? "border-grimoire-red focus:border-grimoire-red focus:ring-1 focus:ring-grimoire-red"
              : "border-grimoire-border focus:border-grimoire-purple focus:ring-1 focus:ring-grimoire-purple"
          }`}
        />
        {urlError && (
          <p className="text-grimoire-red text-xs">
            Please enter a valid URL starting with http:// or https://
          </p>
        )}
      </div>

      {/* Headers */}
      <div className="space-y-2">
        <label className="text-grimoire-text font-fantasy text-sm">
          Headers
        </label>
        {Object.entries(potion.headers).length > 0 && (
          <div className="space-y-2 mb-2">
            {Object.entries(potion.headers).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-2 p-2 bg-black/30 rounded"
              >
                <code className="flex-1 text-grimoire-text text-xs font-mono">
                  {key}: {value}
                </code>
                <button
                  className="p-1 rounded text-grimoire-text-dim hover:text-grimoire-red hover:bg-grimoire-red/10 transition-all"
                  onClick={() => handleRemoveHeader(key)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={headerKey}
            onChange={(e) => setHeaderKey(e.target.value)}
            placeholder="Header-Name"
            className="flex-1 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-mono placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-purple focus:ring-1 focus:ring-grimoire-purple transition-all"
          />
          <input
            type="text"
            value={headerValue}
            onChange={(e) => setHeaderValue(e.target.value)}
            placeholder="Value"
            className="flex-1 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-mono placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-purple focus:ring-1 focus:ring-grimoire-purple transition-all"
          />
          <button
            className="px-3 py-2 rounded bg-black/20 border border-grimoire-border text-grimoire-text-dim hover:text-grimoire-text hover:bg-black/30 transition-all"
            onClick={handleAddHeader}
            disabled={!headerKey.trim()}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Body (POST only) */}
      {potion.method === "POST" && (
        <div className="space-y-2">
          <label className="text-grimoire-text font-fantasy text-sm">
            Body (JSON)
          </label>
          <textarea
            value={potion.body || ""}
            onChange={(e) => setPotion({ ...potion, body: e.target.value })}
            placeholder='{"key": "value"}'
            className="w-full px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-mono placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-purple focus:ring-1 focus:ring-grimoire-purple transition-all resize-y min-h-[100px]"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-grimoire-border">
        <ActionButton variant="ghost" onClick={onCancel}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="purple"
          className="flex-1"
          onClick={() => onSave(potion)}
          disabled={!canSave}
          title={
            !canSave
              ? !potion.name.trim()
                ? "Potion name is required"
                : !potion.url.trim()
                  ? "URL is required"
                  : urlError
                    ? "URL must be a valid http:// or https:// URL"
                    : ""
              : ""
          }
        >
          {isCreating ? "Brew Potion" : "Save Changes"}
        </ActionButton>
      </div>
    </div>
  );
}
