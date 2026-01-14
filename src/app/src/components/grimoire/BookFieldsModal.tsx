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
    <div className="grimoire-modal-overlay" onClick={onClose}>
      <div
        className="grimoire-modal grimoire-book-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grimoire-modal-header">
          <div className="grimoire-modal-title">
            <Book size={18} />
            <span>Book Fields Reference</span>
          </div>
          <button className="grimoire-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="grimoire-book-modal-search">
          <Search size={16} className="grimoire-book-search-icon" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="grimoire-book-search-input"
            autoFocus
          />
        </div>

        <div className="grimoire-book-modal-content">
          {filteredFields.length === 0 ? (
            <div className="grimoire-book-modal-empty">
              <Book size={32} className="muted" />
              <p>
                {searchQuery
                  ? "No fields match your search"
                  : "No book fields defined yet"}
              </p>
              {!searchQuery && (
                <span className="grimoire-book-modal-hint">
                  Add fields in Settings → The Book
                </span>
              )}
            </div>
          ) : (
            <div className="grimoire-book-fields-list">
              {filteredFields.map(([field, value]) => (
                <div
                  key={field}
                  className={`grimoire-book-field-item ${onSelect ? "selectable" : ""}`}
                  onClick={() => onSelect && handleSelect(field)}
                >
                  <div className="grimoire-book-field-item-header">
                    <code className="grimoire-book-field-ref">
                      {"${book." + field + "}"}
                    </code>
                    <button
                      className="grimoire-book-field-copy"
                      onClick={(e) => handleCopy(field, e)}
                      title="Copy placeholder"
                    >
                      <Copy size={12} />
                      {copiedField === field && (
                        <span className="grimoire-copied-label">Copied!</span>
                      )}
                    </button>
                  </div>
                  <div className="grimoire-book-field-value">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {onSelect && filteredFields.length > 0 && (
          <div className="grimoire-book-modal-footer">
            <span className="grimoire-book-modal-hint">
              Click a field to insert it
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

