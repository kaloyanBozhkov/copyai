import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Scroll, Wand2, Plus, Trash2, Eye, EyeOff, Book } from "lucide-react";
import { ipcRenderer } from "@/utils/electron";
import type { CustomTemplate, GrimoireSettings } from "./types";
import { BookFieldsModal } from "./BookFieldsModal";

interface CreateTemplateModalProps {
  existingCategories: string[];
  existingTemplate?: CustomTemplate; // For edit mode
  onClose: () => void;
  onCreate: (template: Omit<CustomTemplate, "id" | "createdAt">) => void;
  onUpdate?: (id: string, template: Omit<CustomTemplate, "id" | "createdAt">) => void;
}

export function CreateTemplateModal({
  existingCategories,
  existingTemplate,
  onClose,
  onCreate,
  onUpdate,
}: CreateTemplateModalProps) {
  const isEditMode = !!existingTemplate;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(existingTemplate?.name || "");
  const [category, setCategory] = useState(existingTemplate?.category || "");
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [lines, setLines] = useState<string[]>(existingTemplate?.messageRecipe || [""]);
  const [previewArgs, setPreviewArgs] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [bookFields, setBookFields] = useState<Record<string, string>>({});
  const [showBookModal, setShowBookModal] = useState(false);
  const [autocompleteLineIndex, setAutocompleteLineIndex] = useState<number | null>(null);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [activeInputRef, setActiveInputRef] = useState<HTMLInputElement | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    
    // Load book fields from settings
    const handleSettingsData = (_: unknown, data: GrimoireSettings) => {
      setBookFields(data.book);
    };
    
    ipcRenderer.on("grimoire-settings-data", handleSettingsData);
    ipcRenderer.send("grimoire-get-settings");
    
    return () => {
      ipcRenderer.removeListener("grimoire-settings-data", handleSettingsData);
    };
  }, []);

  // Extract unique placeholders from all lines (supports $0, ${0}, ${named})
  const extractedArgs = (() => {
    const text = lines.join("\n");
    const all: string[] = [];
    
    // Match $0, $1 etc (without braces)
    const numberedNoBraces = text.match(/\$(\d+)(?!\w)/g) || [];
    for (const m of numberedNoBraces) {
      const num = m.slice(1);
      if (!all.includes(num)) all.push(num);
    }
    
    // Match ${0}, ${1} etc (with braces, numbered)
    const numberedWithBraces = text.match(/\$\{(\d+)\}/g) || [];
    for (const m of numberedWithBraces) {
      const num = m.slice(2, -1);
      if (!all.includes(num)) all.push(num);
    }
    
    // Match ${named} placeholders
    const namedPlaceholders = text.match(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g) || [];
    for (const m of namedPlaceholders) {
      const name = m.slice(2, -1);
      if (!all.includes(name)) all.push(name);
    }
    
    return all;
  })();

  const handleAddLine = () => {
    setLines([...lines, ""]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleLineChange = (index: number, value: string, inputRef?: HTMLInputElement) => {
    const newLines = [...lines];
    newLines[index] = value;
    setLines(newLines);

    // Check for ${book. autocomplete
    if (inputRef) {
      const cursorPos = inputRef.selectionStart || 0;
      const textBeforeCursor = value.slice(0, cursorPos);
      const match = textBeforeCursor.match(/\$\{book\.(\w*)$/);
      
      if (match) {
        const searchTerm = match[1].toLowerCase();
        const suggestions = Object.keys(bookFields).filter((field) =>
          field.toLowerCase().startsWith(searchTerm)
        );
        setAutocompleteSuggestions(suggestions);
        setAutocompleteLineIndex(index);
        setActiveInputRef(inputRef);
      } else {
        setAutocompleteSuggestions([]);
        setAutocompleteLineIndex(null);
      }
    }
  };

  const handleAutocompleteSelect = (field: string) => {
    if (autocompleteLineIndex === null || !activeInputRef) return;

    const currentLine = lines[autocompleteLineIndex];
    const cursorPos = activeInputRef.selectionStart || 0;
    const textBeforeCursor = currentLine.slice(0, cursorPos);
    const textAfterCursor = currentLine.slice(cursorPos);
    
    // Find the ${book. part and replace it
    const match = textBeforeCursor.match(/\$\{book\.(\w*)$/);
    if (match) {
      const beforeBook = textBeforeCursor.slice(0, match.index);
      const newLine = `${beforeBook}\${book.${field}}${textAfterCursor}`;
      const newLines = [...lines];
      newLines[autocompleteLineIndex] = newLine;
      setLines(newLines);
      
      // Move cursor after the inserted field
      setTimeout(() => {
        const newCursorPos = beforeBook.length + `\${book.${field}}`.length;
        activeInputRef.setSelectionRange(newCursorPos, newCursorPos);
        activeInputRef.focus();
      }, 0);
    }
    
    setAutocompleteSuggestions([]);
    setAutocompleteLineIndex(null);
  };

  const handleBookModalSelect = (field: string) => {
    if (activeInputRef && autocompleteLineIndex !== null) {
      // Insert at cursor position
      const currentLine = lines[autocompleteLineIndex];
      const cursorPos = activeInputRef.selectionStart || 0;
      const before = currentLine.slice(0, cursorPos);
      const after = currentLine.slice(cursorPos);
      const newLine = `${before}\${book.${field}}${after}`;
      const newLines = [...lines];
      newLines[autocompleteLineIndex] = newLine;
      setLines(newLines);
      
      setTimeout(() => {
        const newCursorPos = before.length + `\${book.${field}}`.length;
        activeInputRef.setSelectionRange(newCursorPos, newCursorPos);
        activeInputRef.focus();
      }, 0);
    }
  };

  const getPreview = () => {
    let result = lines.join("\n");
    
    // First, replace ${book.field} placeholders with actual values
    for (const [field, value] of Object.entries(bookFields)) {
      result = result.split(`\${book.${field}}`).join(value);
    }
    
    // Then replace user arguments (numbered and named)
    extractedArgs.forEach((arg, i) => {
      const isNumbered = /^\d+$/.test(arg);
      const replacement = previewArgs[i] || `[${isNumbered ? `$${arg}` : arg}]`;
      
      if (isNumbered) {
        // Replace both $N and ${N} formats
        result = result.split(`$${arg}`).join(replacement);
        result = result.split(`\${${arg}}`).join(replacement);
      } else {
        // Replace ${named} format
        result = result.split(`\${${arg}}`).join(replacement);
      }
    });
    return result;
  };

  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = category.trim().length > 0;
  const canCreate = lines.some((l) => l.trim().length > 0);

  const handleSubmit = () => {
    if (!canCreate) return;
    const templateData = {
      name: name.trim(),
      category: category.trim(),
      messageRecipe: lines.filter((l) => l.length > 0),
    };
    
    if (isEditMode && existingTemplate && onUpdate) {
      onUpdate(existingTemplate.id, templateData);
    } else {
      onCreate(templateData);
    }
  };

  return (
    <div className="grimoire-modal-overlay" onClick={onClose}>
      <div className="grimoire-modal" onClick={(e) => e.stopPropagation()}>
        <div className="grimoire-modal-header">
          <div className="grimoire-modal-title">
            <Sparkles size={18} />
            <span>{isEditMode ? "Edit Scroll" : "Inscribe New Scroll"}</span>
          </div>
          <button className="grimoire-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="grimoire-modal-progress">
          <div className={`grimoire-progress-step ${step >= 1 ? "active" : ""}`}>
            <span className="grimoire-step-number">1</span>
            <span className="grimoire-step-label">Name</span>
          </div>
          <div className={`grimoire-progress-line ${step >= 2 ? "active" : ""}`} />
          <div className={`grimoire-progress-step ${step >= 2 ? "active" : ""}`}>
            <span className="grimoire-step-number">2</span>
            <span className="grimoire-step-label">Category</span>
          </div>
          <div className={`grimoire-progress-line ${step >= 3 ? "active" : ""}`} />
          <div className={`grimoire-progress-step ${step >= 3 ? "active" : ""}`}>
            <span className="grimoire-step-number">3</span>
            <span className="grimoire-step-label">Content</span>
          </div>
        </div>

        <div className="grimoire-modal-content">
          {/* Step 1: Name */}
          {step === 1 && (
            <div className="grimoire-step-content">
              <div className="grimoire-step-icon">
                <Wand2 size={32} />
              </div>
              <h3>Name Your Scroll</h3>
              <p>
                Choose a memorable name for your incantation. Use snake_case for
                multi-word names.
              </p>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\s+/g, "_"))}
                placeholder="my_awesome_scroll"
                className="grimoire-name-input"
                onKeyDown={(e) => e.key === "Enter" && canProceedStep1 && setStep(2)}
              />
              <div className="grimoire-step-actions">
                <button
                  className="grimoire-next-btn"
                  disabled={!canProceedStep1}
                  onClick={() => setStep(2)}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Category */}
          {step === 2 && (
            <div className="grimoire-step-content">
              <div className="grimoire-step-icon">
                <Scroll size={32} />
              </div>
              <h3>Choose a Category</h3>
              <p>
                Organize your scroll within a category. Select existing or create new.
              </p>

              <div className="grimoire-category-toggle">
                <button
                  className={!isNewCategory ? "active" : ""}
                  onClick={() => setIsNewCategory(false)}
                >
                  Existing
                </button>
                <button
                  className={isNewCategory ? "active" : ""}
                  onClick={() => setIsNewCategory(true)}
                >
                  New Category
                </button>
              </div>

              {isNewCategory ? (
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value.replace(/\s+/g, "_"))}
                  placeholder="new_category"
                  className="grimoire-name-input"
                  onKeyDown={(e) => e.key === "Enter" && canProceedStep2 && setStep(3)}
                />
              ) : (
                <div className="grimoire-category-grid">
                  {existingCategories.map((cat) => (
                    <button
                      key={cat}
                      className={`grimoire-category-option ${
                        category === cat ? "selected" : ""
                      }`}
                      onClick={() => setCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              <div className="grimoire-step-actions">
                <button className="grimoire-back-btn" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  className="grimoire-next-btn"
                  disabled={!canProceedStep2}
                  onClick={() => setStep(3)}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Content */}
          {step === 3 && (
            <div className="grimoire-step-content wide">
              <div className="grimoire-content-header">
                <h3>Write Your Incantation</h3>
                <p>
                  Use <code>$0</code>, <code>${"${0}"}</code> for numbered or{" "}
                  <code>${"${name}"}</code> for named placeholders.
                </p>
              </div>

              <div className="grimoire-lines-editor">
                {lines.map((line, index) => (
                  <div key={index} className="grimoire-line-row">
                    <span className="grimoire-line-number">{index + 1}</span>
                    <div className="grimoire-line-input-wrapper">
                      <input
                        type="text"
                        value={line}
                        onChange={(e) => {
                          handleLineChange(index, e.target.value, e.target);
                          setActiveInputRef(e.target);
                          setAutocompleteLineIndex(index);
                        }}
                        onFocus={(e) => {
                          setActiveInputRef(e.target);
                          setAutocompleteLineIndex(index);
                        }}
                        placeholder={`Line ${index + 1}...`}
                        className="grimoire-line-input"
                      />
                      {autocompleteLineIndex === index && autocompleteSuggestions.length > 0 && (
                        <div className="grimoire-autocomplete-dropdown">
                          {autocompleteSuggestions.map((field) => (
                            <button
                              key={field}
                              className="grimoire-autocomplete-item"
                              onClick={() => handleAutocompleteSelect(field)}
                            >
                              <code>{"${book." + field + "}"}</code>
                              <span className="grimoire-autocomplete-value">
                                {bookFields[field]}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {lines.length > 1 && (
                      <button
                        className="grimoire-line-remove"
                        onClick={() => handleRemoveLine(index)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button className="grimoire-add-line" onClick={handleAddLine}>
                  <Plus size={14} />
                  Add Line
                </button>
                <button
                  className="grimoire-book-reference-btn"
                  onClick={() => setShowBookModal(true)}
                  title="View all book fields"
                >
                  <Book size={14} />
                  View Book Fields
                </button>
              </div>

              {extractedArgs.length > 0 && (
                <div className="grimoire-args-detected">
                  <span>Detected placeholders:</span>
                  {extractedArgs.map((arg) => (
                    <code key={arg}>
                      {/^\d+$/.test(arg) ? `$${arg}` : `\${${arg}}`}
                    </code>
                  ))}
                </div>
              )}

              {(() => {
                const text = lines.join("\n");
                const bookMatches = text.match(/\$\{book\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g) || [];
                const bookFieldsUsed = [...new Set(bookMatches.map((m) => m.slice(7, -1)))]; // Remove ${book. and }
                return bookFieldsUsed.length > 0 ? (
                  <div className="grimoire-args-detected grimoire-book-fields-detected">
                    <span>Book fields used:</span>
                    {bookFieldsUsed.map((field) => (
                      <code key={field} title={bookFields[field] || "Not defined"}>
                        {"${book." + field + "}"}
                        <span className="grimoire-book-field-preview">
                          = {bookFields[field] || "(not defined)"}
                        </span>
                      </code>
                    ))}
                  </div>
                ) : null;
              })()}

              <div className="grimoire-preview-section">
                <button
                  className="grimoire-preview-toggle"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showPreview ? "Hide Preview" : "Show Preview"}
                </button>

                {showPreview && (
                  <>
                    {extractedArgs.length > 0 && (
                      <div className="grimoire-preview-args">
                        {extractedArgs.map((arg, i) => (
                          <input
                            key={arg}
                            type="text"
                            placeholder={`${/^\d+$/.test(arg) ? `$${arg}` : arg} value...`}
                            value={previewArgs[i] || ""}
                            onChange={(e) => {
                              const newArgs = [...previewArgs];
                              newArgs[i] = e.target.value;
                              setPreviewArgs(newArgs);
                            }}
                          />
                        ))}
                      </div>
                    )}
                    <pre className="grimoire-preview-output">{getPreview()}</pre>
                  </>
                )}
              </div>

              <div className="grimoire-step-actions">
                <button className="grimoire-back-btn" onClick={() => setStep(2)}>
                  Back
                </button>
                <button
                  className="grimoire-create-final-btn"
                  disabled={!canCreate}
                  onClick={handleSubmit}
                >
                  <Sparkles size={14} />
                  {isEditMode ? "Update Scroll" : "Inscribe Scroll"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showBookModal && (
        <BookFieldsModal
          bookFields={bookFields}
          onClose={() => setShowBookModal(false)}
          onSelect={handleBookModalSelect}
        />
      )}
    </div>
  );
}

