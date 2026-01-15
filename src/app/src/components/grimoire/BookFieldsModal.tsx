import { useState, useMemo } from "react";
import { X, Book, Search, Copy } from "lucide-react";

interface BookFieldsModalProps {
  bookFields: Record<string, string>;
  onClose: () => void;
  onSelect?: (field: string) => void;
}

export function BookFieldsModal({
  bookFields,
  onClose,
  onSelect,
}: BookFieldsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const filteredFields = useMemo(() => {
    if (!searchQuery) return Object.entries(bookFields);
    const query = searchQuery.toLowerCase();
    return Object.entries(bookFields).filter(
      ([field, value]) =>
        field.toLowerCase().includes(query) ||
        value.toLowerCase().includes(query)
    );
  }, [bookFields, searchQuery]);

  const handleCopy = (field: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`\${book.${field}}`);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSelect = (field: string) => {
    if (onSelect) {
      onSelect(field);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-gradient-to-br from-grimoire-bg-secondary to-grimoire-bg border border-grimoire-border rounded-lg shadow-2xl overflow-hidden pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grimoire-border bg-gradient-to-r from-grimoire-gold/10 to-transparent">
          <div className="flex items-center gap-2">
            <Book size={18} className="text-grimoire-gold" />
            <span className="font-fantasy text-grimoire-gold font-semibold">
              Book Fields Reference
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
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grimoire-text-dim pointer-events-none" />
            <input
              type="text"
              placeholder="Search fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text placeholder:text-grimoire-text-dim text-sm focus:outline-none focus:border-grimoire-gold-dim focus:ring-1 focus:ring-grimoire-gold-dim transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto custom-scrollbar">
          {filteredFields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Book size={32} className="text-grimoire-text-dim mb-3 opacity-50" />
              <p className="text-grimoire-text-dim text-sm mb-1">
                {searchQuery
                  ? "No fields match your search"
                  : "No book fields defined yet"}
              </p>
              {!searchQuery && (
                <span className="text-grimoire-text-dim text-xs">
                  Add fields in Settings → The Book
                </span>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredFields.map(([field, value]) => (
                <div
                  key={field}
                  className={`p-3 bg-black/20 border border-grimoire-border/50 rounded transition-all ${
                    onSelect
                      ? "cursor-pointer hover:bg-grimoire-gold/10 hover:border-grimoire-gold/50"
                      : ""
                  }`}
                  onClick={() => onSelect && handleSelect(field)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <code className="text-grimoire-gold font-grimoire text-xs">
                      {"${book." + field + "}"}
                    </code>
                    <button
                      className="relative p-1 rounded text-grimoire-text-dim hover:text-grimoire-gold hover:bg-grimoire-gold/10 transition-all"
                      onClick={(e) => handleCopy(field, e)}
                      title="Copy placeholder"
                    >
                      <Copy size={12} />
                      {copiedField === field && (
                        <span className="absolute -top-6 right-0 px-2 py-0.5 bg-grimoire-green text-white text-xs rounded whitespace-nowrap">
                          Copied!
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="text-grimoire-text text-sm">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {onSelect && filteredFields.length > 0 && (
          <div className="px-4 py-2 border-t border-grimoire-border/50 bg-black/20">
            <span className="text-grimoire-text-dim text-xs">
              Click a field to insert it
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
