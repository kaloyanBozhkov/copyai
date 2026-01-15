import { useState, useMemo } from "react";
import { X, Beaker, Search, ChevronDown, ChevronRight } from "lucide-react";
import type { AlchemyPotion } from "./types";

interface AlchemyFieldsModalProps {
  potions: AlchemyPotion[];
  onClose: () => void;
  onSelect?: (potionName: string) => void;
}

export function AlchemyFieldsModal({
  potions,
  onClose,
  onSelect,
}: AlchemyFieldsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPotionIds, setExpandedPotionIds] = useState<Set<string>>(new Set());

  const filteredPotions = useMemo(() => {
    if (!searchQuery) return potions;
    const q = searchQuery.toLowerCase();
    return potions.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.url.toLowerCase().includes(q)
    );
  }, [potions, searchQuery]);

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
        className="w-full max-w-md bg-gradient-to-br from-grimoire-bg-secondary to-grimoire-bg border border-grimoire-purple rounded-lg shadow-2xl overflow-hidden pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grimoire-purple/50 bg-gradient-to-r from-grimoire-purple/10 to-transparent">
          <div className="flex items-center gap-2">
            <Beaker size={18} className="text-grimoire-purple-bright" />
            <span className="font-fantasy text-grimoire-purple-bright font-semibold">
              Alchemy Potions Reference
            </span>
          </div>
          <button
            className="p-1 rounded text-grimoire-text-dim hover:text-grimoire-text hover:bg-white/10 transition-all"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-grimoire-border/50">
          <div className="relative">
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
              autoFocus
            />
          </div>
        </div>

        {/* Potions List */}
        <div className="max-h-96 overflow-y-auto custom-scrollbar">
          {filteredPotions.length === 0 && potions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Beaker size={32} className="text-grimoire-text-dim mb-3 opacity-50" />
              <p className="text-grimoire-text-dim text-sm mb-1">
                No potions brewed yet
              </p>
              <span className="text-grimoire-text-dim text-xs">
                Create potions in the Alchemy Lab to use them here
              </span>
            </div>
          ) : filteredPotions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Search size={32} className="text-grimoire-text-dim mb-3 opacity-50" />
              <p className="text-grimoire-text-dim text-sm">
                No potions match your search
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredPotions.map((potion) => (
                <div
                  key={potion.id}
                  className={`p-3 bg-black/20 border border-grimoire-purple/50 rounded ${
                    onSelect ? "cursor-pointer hover:bg-grimoire-purple/10" : ""
                  } transition-all`}
                  onClick={() => onSelect && onSelect(potion.name)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <code className="text-grimoire-purple-bright font-grimoire text-xs">
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
                  <div className="text-grimoire-text-dim text-xs font-mono truncate">
                    {potion.url}
                  </div>
                  {potion.lastValue && (
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
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
                            ({new Date(potion.lastFetched).toLocaleTimeString()})
                          </span>
                        )}
                      </button>
                      {expandedPotionIds.has(potion.id) && (
                        <div className="p-2 bg-black/30 rounded max-h-32 overflow-y-auto custom-scrollbar">
                          <pre className="text-grimoire-text text-xs font-mono whitespace-pre-wrap break-words">
                            {potion.lastValue}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {onSelect && filteredPotions.length > 0 && (
          <div className="px-4 py-2 border-t border-grimoire-border/50 bg-black/20">
            <span className="text-grimoire-text-dim text-xs">
              Click a potion to insert it
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

