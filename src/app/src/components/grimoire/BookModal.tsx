import { useState, useMemo } from "react";
import { X, Book, Plus, Trash2, Search, Info } from "lucide-react";
import { ipcRenderer } from "@/utils/electron";

interface BookModalProps {
  bookFields: Record<string, string>;
  onClose: () => void;
}

export function BookModal({ bookFields: initialBookFields, onClose }: BookModalProps) {
  const [bookFields, setBookFields] = useState(initialBookFields);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingField, setDeletingField] = useState<{ name: string; value: string } | null>(null);

  const filteredFields = useMemo(() => {
    if (!searchQuery) return Object.entries(bookFields);
    const q = searchQuery.toLowerCase();
    return Object.entries(bookFields).filter(
      ([field, value]) =>
        field.toLowerCase().includes(q) || value.toLowerCase().includes(q)
    );
  }, [bookFields, searchQuery]);

  const handleAddField = () => {
    if (!newFieldName.trim()) return;
    const field = newFieldName.trim().replace(/\s+/g, "_");
    ipcRenderer.send("grimoire-set-book-field", { field, value: newFieldValue });
    setBookFields({ ...bookFields, [field]: newFieldValue });
    setNewFieldName("");
    setNewFieldValue("");
  };

  const handleUpdateField = (field: string, value: string) => {
    ipcRenderer.send("grimoire-set-book-field", { field, value });
    setBookFields({ ...bookFields, [field]: value });
  };

  const handleDeleteClick = (field: string, value: string) => {
    setDeletingField({ name: field, value });
  };

  const handleConfirmDelete = () => {
    if (deletingField) {
      ipcRenderer.send("grimoire-remove-book-field", deletingField.name);
      const updated = { ...bookFields };
      delete updated[deletingField.name];
      setBookFields(updated);
      setDeletingField(null);
    }
  };

  const handleCancelDelete = () => {
    setDeletingField(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-gradient-to-br from-grimoire-bg-secondary to-grimoire-bg border border-grimoire-border rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-grimoire-border bg-gradient-to-r from-grimoire-accent/10 to-transparent">
          <div className="flex items-center gap-3">
            <Book size={20} className="text-grimoire-accent-bright" />
            <h2 className="font-fantasy text-grimoire-accent-bright font-bold text-xl">
              The Book
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
        <div className="px-6 py-4 border-b border-grimoire-border/50 bg-gradient-to-br from-grimoire-accent/5 to-transparent">
          <div className="flex items-start gap-3">
            <Info size={16} className="text-grimoire-accent-bright mt-0.5 flex-shrink-0" />
            <p className="text-grimoire-text-dim text-sm">
              Define custom fields that can be referenced in templates using{" "}
              <code className="px-1.5 py-0.5 bg-black/30 rounded text-grimoire-accent-bright font-grimoire text-xs">
                ${"{book.fieldname}"}
              </code>{" "}
              syntax. These are static values stored locally.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-grimoire-border/50">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-grimoire-text-dim pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text placeholder:text-grimoire-text-dim text-sm focus:outline-none focus:border-grimoire-accent focus:ring-1 focus:ring-grimoire-accent transition-all"
            />
          </div>
        </div>

        {/* Fields List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
          {filteredFields.length === 0 && Object.keys(bookFields).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Book size={48} className="text-grimoire-text-dim mb-4 opacity-50" />
              <p className="text-grimoire-text-dim text-sm mb-1">No fields defined yet</p>
              <span className="text-grimoire-text-dim text-xs">
                Add your first field below
              </span>
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search size={48} className="text-grimoire-text-dim mb-4 opacity-50" />
              <p className="text-grimoire-text-dim text-sm">No fields match your search</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFields.map(([field, value]) => (
                <div
                  key={field}
                  className="p-4 bg-black/20 border border-grimoire-border rounded space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <code className="text-grimoire-accent-bright font-grimoire text-sm">
                      ${"{book." + field + "}"}
                    </code>
                    <button
                      className="p-1.5 rounded text-grimoire-text-dim hover:text-grimoire-red hover:bg-grimoire-red/10 transition-all"
                      onClick={() => handleDeleteClick(field, value)}
                      title="Remove field"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleUpdateField(field, e.target.value)}
                    placeholder="Enter value..."
                    className="w-full px-3 py-2 bg-black/30 border border-grimoire-border/50 rounded text-grimoire-text text-sm placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-accent focus:ring-1 focus:ring-grimoire-accent transition-all"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Field */}
        <div className="px-6 py-4 border-t border-grimoire-border bg-gradient-to-br from-grimoire-accent/10 to-transparent">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-grimoire-accent-bright font-fantasy text-sm font-semibold">
              <Plus size={14} />
              <span>Add New Field</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value.replace(/\s+/g, "_"))}
                placeholder="field_name"
                className="flex-1 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-grimoire placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-accent focus:ring-1 focus:ring-grimoire-accent transition-all"
                onKeyDown={(e) => e.key === "Enter" && newFieldName.trim() && handleAddField()}
              />
              <input
                type="text"
                value={newFieldValue}
                onChange={(e) => setNewFieldValue(e.target.value)}
                placeholder="Value"
                className="flex-1 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-accent focus:ring-1 focus:ring-grimoire-accent transition-all"
                onKeyDown={(e) => e.key === "Enter" && newFieldName.trim() && handleAddField()}
              />
              <button
                className="flex items-center gap-2 px-4 py-2 rounded bg-grimoire-accent/20 border border-grimoire-accent/50 text-grimoire-accent-bright font-fantasy text-sm font-semibold hover:bg-grimoire-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                onClick={handleAddField}
                disabled={!newFieldName.trim()}
              >
                <Plus size={14} />
                Add
              </button>
            </div>
            {newFieldName && (
              <div className="text-grimoire-text-dim text-xs">
                Will be available as:{" "}
                <code className="px-1.5 py-0.5 bg-black/30 rounded text-grimoire-accent-bright font-grimoire">
                  ${"{book." + newFieldName + "}"}
                </code>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto" onClick={handleCancelDelete}>
          <div className="w-full max-w-md bg-gradient-to-br from-grimoire-bg-secondary to-grimoire-bg border-2 border-grimoire-red/50 rounded-lg shadow-2xl overflow-hidden pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-grimoire-red/30 bg-gradient-to-r from-grimoire-red/20 to-transparent">
              <h3 className="font-fantasy text-grimoire-red font-bold text-lg flex items-center gap-2">
                <Trash2 size={20} />
                Delete Book Field
              </h3>
            </div>
            <div className="px-6 py-6 space-y-4">
              <p className="text-grimoire-text text-sm">
                Are you sure you want to delete the field{" "}
                <code className="px-1.5 py-0.5 bg-grimoire-accent/20 rounded font-grimoire font-semibold text-grimoire-accent-bright">
                  ${"{book." + deletingField.name + "}"}
                </code>
                ?
              </p>
              <p className="text-grimoire-text-dim text-sm">
                This action cannot be undone. Any templates using this field will show empty values.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-grimoire-border bg-black/20 flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded bg-black/30 border border-grimoire-border text-grimoire-text-dim hover:text-grimoire-text hover:bg-black/40 transition-all"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-grimoire-red/80 border border-grimoire-red text-white font-fantasy font-semibold hover:bg-grimoire-red transition-all"
                onClick={handleConfirmDelete}
              >
                <Trash2 size={14} className="inline-block mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

