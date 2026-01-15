import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Scroll, Wand2, Plus, Trash2, Eye, EyeOff, Book } from "lucide-react";
import type { CustomTemplate } from "./types";
import { BookFieldsModal } from "./BookFieldsModal";

interface CreateTemplateModalProps {
  existingCategories: string[];
  bookFields: Record<string, string>;
  existingTemplate?: CustomTemplate;
  onClose: () => void;
  onCreate: (template: Omit<CustomTemplate, "id" | "createdAt">) => void;
  onUpdate?: (id: string, template: Omit<CustomTemplate, "id" | "createdAt">) => void;
}

export function CreateTemplateModal({
  existingCategories,
  bookFields,
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
  const [showBookModal, setShowBookModal] = useState(false);
  const [autocompleteLineIndex, setAutocompleteLineIndex] = useState<number | null>(null);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [activeInputRef, setActiveInputRef] = useState<HTMLInputElement | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Extract placeholders
  const extractedArgs = (() => {
    const text = lines.join("\n");
    const all: string[] = [];

    const numberedNoBraces = text.match(/\$(\d+)(?!\w)/g) || [];
    for (const m of numberedNoBraces) {
      const num = m.slice(1);
      if (!all.includes(num)) all.push(num);
    }

    const numberedWithBraces = text.match(/\$\{(\d+)\}/g) || [];
    for (const m of numberedWithBraces) {
      const num = m.slice(2, -1);
      if (!all.includes(num)) all.push(num);
    }

    const namedPlaceholders = text.match(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g) || [];
    for (const m of namedPlaceholders) {
      const name = m.slice(2, -1);
      if (!all.includes(name)) all.push(name);
    }

    return all;
  })();

  const handleAddLine = () => setLines([...lines, ""]);
  const handleRemoveLine = (index: number) => {
    if (lines.length > 1) setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, value: string, inputRef?: HTMLInputElement) => {
    const newLines = [...lines];
    newLines[index] = value;
    setLines(newLines);

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

    const match = textBeforeCursor.match(/\$\{book\.(\w*)$/);
    if (match) {
      const beforeBook = textBeforeCursor.slice(0, match.index);
      const newLine = `${beforeBook}\${book.${field}}${textAfterCursor}`;
      const newLines = [...lines];
      newLines[autocompleteLineIndex] = newLine;
      setLines(newLines);

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

    for (const [field, value] of Object.entries(bookFields)) {
      result = result.split(`\${book.${field}}`).join(value);
    }

    extractedArgs.forEach((arg, i) => {
      const isNumbered = /^\d+$/.test(arg);
      const replacement = previewArgs[i] || `[${isNumbered ? `$${arg}` : arg}]`;

      if (isNumbered) {
        result = result.split(`$${arg}`).join(replacement);
        result = result.split(`\${${arg}}`).join(replacement);
      } else {
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
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl max-h-[90vh] bg-gradient-to-br from-grimoire-bg-secondary to-grimoire-bg border border-grimoire-border rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-grimoire-border bg-gradient-to-r from-grimoire-gold/10 to-transparent">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-grimoire-gold" />
              <span className="font-fantasy text-grimoire-gold font-semibold">
                {isEditMode ? "Edit Scroll" : "Inscribe New Scroll"}
              </span>
            </div>
            <button
              className="p-1 rounded text-grimoire-text-dim hover:text-grimoire-text hover:bg-white/10 transition-all"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          {/* Progress Stepper */}
          <div className="flex items-center justify-center gap-2 px-6 py-4 border-b border-grimoire-border/50">
            <div className={`flex items-center ${step >= 1 ? "text-grimoire-gold" : "text-grimoire-text-dim"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= 1 ? "bg-grimoire-gold/20 border-2 border-grimoire-gold" : "bg-black/30 border border-grimoire-border"
              }`}>
                1
              </div>
              <span className="ml-2 text-xs font-fantasy">Name</span>
            </div>
            <div className={`w-8 h-px ${step >= 2 ? "bg-grimoire-gold" : "bg-grimoire-border"}`} />
            <div className={`flex items-center ${step >= 2 ? "text-grimoire-gold" : "text-grimoire-text-dim"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= 2 ? "bg-grimoire-gold/20 border-2 border-grimoire-gold" : "bg-black/30 border border-grimoire-border"
              }`}>
                2
              </div>
              <span className="ml-2 text-xs font-fantasy">Category</span>
            </div>
            <div className={`w-8 h-px ${step >= 3 ? "bg-grimoire-gold" : "bg-grimoire-border"}`} />
            <div className={`flex items-center ${step >= 3 ? "text-grimoire-gold" : "text-grimoire-text-dim"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= 3 ? "bg-grimoire-gold/20 border-2 border-grimoire-gold" : "bg-black/30 border border-grimoire-border"
              }`}>
                3
              </div>
              <span className="ml-2 text-xs font-fantasy">Content</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {step === 1 && (
              <div className="flex flex-col items-center text-center space-y-4">
                <Wand2 size={32} className="text-grimoire-gold" />
                <h3 className="text-xl font-fantasy font-bold text-grimoire-text">
                  Name Your Scroll
                </h3>
                <p className="text-grimoire-text-dim text-sm max-w-md">
                  Choose a memorable name for your incantation. Use snake_case for multi-word names.
                </p>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/\s+/g, "_"))}
                  placeholder="my_awesome_scroll"
                  className="w-full max-w-sm px-4 py-3 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-center placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-gold-dim focus:ring-2 focus:ring-grimoire-gold-dim transition-all"
                  onKeyDown={(e) => e.key === "Enter" && canProceedStep1 && setStep(2)}
                />
                <button
                  className="px-6 py-2 bg-grimoire-gold/20 border border-grimoire-gold text-grimoire-gold font-fantasy font-semibold rounded hover:bg-grimoire-gold/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  disabled={!canProceedStep1}
                  onClick={() => setStep(2)}
                >
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col items-center text-center space-y-4">
                <Scroll size={32} className="text-grimoire-gold" />
                <h3 className="text-xl font-fantasy font-bold text-grimoire-text">
                  Choose a Category
                </h3>
                <p className="text-grimoire-text-dim text-sm max-w-md">
                  Organize your scroll within a category. Select existing or create new.
                </p>

                <div className="flex gap-2 bg-black/20 rounded p-1 border border-grimoire-border/50">
                  <button
                    className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                      !isNewCategory
                        ? "bg-grimoire-gold/20 text-grimoire-gold"
                        : "text-grimoire-text-dim hover:text-grimoire-text"
                    }`}
                    onClick={() => setIsNewCategory(false)}
                  >
                    Existing
                  </button>
                  <button
                    className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                      isNewCategory
                        ? "bg-grimoire-gold/20 text-grimoire-gold"
                        : "text-grimoire-text-dim hover:text-grimoire-text"
                    }`}
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
                    className="w-full max-w-sm px-4 py-3 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-center placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-gold-dim focus:ring-2 focus:ring-grimoire-gold-dim transition-all"
                    onKeyDown={(e) => e.key === "Enter" && canProceedStep2 && setStep(3)}
                  />
                ) : (
                  <div className="grid grid-cols-3 gap-2 w-full max-w-lg">
                    {existingCategories.map((cat) => (
                      <button
                        key={cat}
                        className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                          category === cat
                            ? "bg-grimoire-gold/20 text-grimoire-gold border border-grimoire-gold/50"
                            : "bg-black/20 text-grimoire-text-dim border border-grimoire-border/50 hover:text-grimoire-text hover:bg-black/30"
                        }`}
                        onClick={() => setCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    className="px-6 py-2 bg-black/30 border border-grimoire-border text-grimoire-text-dim font-fantasy font-semibold rounded hover:text-grimoire-text hover:bg-black/40 transition-all"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </button>
                  <button
                    className="px-6 py-2 bg-grimoire-gold/20 border border-grimoire-gold text-grimoire-gold font-fantasy font-semibold rounded hover:bg-grimoire-gold/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    disabled={!canProceedStep2}
                    onClick={() => setStep(3)}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-fantasy font-bold text-grimoire-text mb-1">
                      Write Your Incantation
                    </h3>
                    <p className="text-grimoire-text-dim text-sm">
                      Use <code className="px-1 py-0.5 bg-black/30 rounded text-grimoire-gold text-xs">$0</code>,{" "}
                      <code className="px-1 py-0.5 bg-black/30 rounded text-grimoire-gold text-xs">${"{0}"}</code> for numbered or{" "}
                      <code className="px-1 py-0.5 bg-black/30 rounded text-grimoire-gold text-xs">${"{name}"}</code> for named placeholders.
                      Reference book fields with{" "}
                      <code className="px-1 py-0.5 bg-black/30 rounded text-grimoire-accent-bright text-xs">${"{book.field}"}</code>.
                    </p>
                  </div>
                  <button
                    className="flex items-center gap-2 px-3 py-2 rounded bg-grimoire-accent/10 border border-grimoire-accent/50 text-grimoire-accent-bright hover:bg-grimoire-accent/20 text-sm whitespace-nowrap transition-all flex-shrink-0"
                    onClick={() => {
                      setAutocompleteLineIndex(lines.length - 1);
                      setActiveInputRef(document.querySelector(`input[placeholder="Line ${lines.length}..."]`) as HTMLInputElement);
                      setShowBookModal(true);
                    }}
                  >
                    <Book size={14} />
                    View Book
                  </button>
                </div>

                <div className="space-y-2">
                  {lines.map((line, index) => (
                    <div key={index} className="flex items-center gap-2 relative">
                      <span className="text-grimoire-text-dim text-xs w-6">{index + 1}</span>
                      <input
                        type="text"
                        value={line}
                        onChange={(e) => handleLineChange(index, e.target.value, e.target)}
                        placeholder={`Line ${index + 1}...`}
                        className="flex-1 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-grimoire placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-gold-dim focus:ring-1 focus:ring-grimoire-gold-dim transition-all"
                      />
                      {lines.length > 1 && (
                        <button
                          className="p-2 rounded text-grimoire-text-dim hover:text-grimoire-red hover:bg-grimoire-red/10 transition-all"
                          onClick={() => handleRemoveLine(index)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}

                      {/* Autocomplete dropdown */}
                      {autocompleteLineIndex === index && autocompleteSuggestions.length > 0 && (
                        <div className="absolute top-full left-6 right-0 mt-1 z-10 bg-grimoire-bg-secondary border border-grimoire-gold/50 rounded shadow-xl max-h-32 overflow-y-auto">
                          {autocompleteSuggestions.map((field) => (
                            <button
                              key={field}
                              className="w-full px-3 py-2 flex items-center justify-between text-sm hover:bg-grimoire-gold/10 transition-colors"
                              onClick={() => handleAutocompleteSelect(field)}
                            >
                              <code className="text-grimoire-gold font-grimoire text-xs">
                                ${"{book." + field + "}"}
                              </code>
                              <span className="text-grimoire-text-dim text-xs">
                                {bookFields[field]}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-black/20 border border-grimoire-border text-grimoire-text-dim hover:text-grimoire-text hover:bg-black/30 text-sm transition-all"
                    onClick={handleAddLine}
                  >
                    <Plus size={14} />
                    Add Line
                  </button>
                </div>

                {extractedArgs.length > 0 && (
                  <div className="p-3 bg-grimoire-gold/10 border border-grimoire-gold/30 rounded">
                    <span className="text-grimoire-gold font-fantasy text-xs font-semibold block mb-2">
                      Detected placeholders:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {extractedArgs.map((arg) => (
                        <code
                          key={arg}
                          className="px-2 py-1 bg-grimoire-gold/20 border border-grimoire-gold/50 rounded text-grimoire-gold text-xs font-grimoire"
                        >
                          {/^\d+$/.test(arg) ? `$${arg}` : `\${${arg}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const text = lines.join("\n");
                  const bookMatches = text.match(/\$\{book\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g) || [];
                  const bookFieldsUsed = [...new Set(bookMatches.map((m) => m.slice(7, -1)))];
                  return bookFieldsUsed.length > 0 ? (
                    <div className="p-3 bg-grimoire-accent/10 border border-grimoire-accent/30 rounded">
                      <span className="text-grimoire-accent-bright font-fantasy text-xs font-semibold block mb-2">
                        Book fields used:
                      </span>
                      <div className="space-y-1">
                        {bookFieldsUsed.map((field) => (
                          <div key={field} className="flex items-center justify-between px-3 py-1.5 bg-grimoire-accent/20 border border-grimoire-accent/50 rounded">
                            <code className="text-grimoire-accent-bright text-xs font-grimoire">
                              {"${book." + field + "}"}
                            </code>
                            <span className="text-grimoire-text-dim text-xs">
                              {bookFields[field] || "(not defined)"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="space-y-2">
                  <button
                    className="flex items-center gap-2 text-sm text-grimoire-text-dim hover:text-grimoire-text transition-all"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showPreview ? "Hide Preview" : "Show Preview"}
                  </button>

                  {showPreview && (
                    <>
                      {extractedArgs.length > 0 && (
                        <div className="space-y-2">
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
                              className="w-full px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-gold-dim transition-all"
                            />
                          ))}
                        </div>
                      )}
                      <pre className="p-4 bg-black/40 border border-grimoire-gold/50 rounded text-grimoire-text text-xs font-grimoire overflow-x-auto whitespace-pre-wrap break-words">
                        {getPreview()}
                      </pre>
                    </>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-grimoire-border">
                  <button
                    className="px-6 py-2 bg-black/30 border border-grimoire-border text-grimoire-text-dim font-fantasy font-semibold rounded hover:text-grimoire-text hover:bg-black/40 transition-all"
                    onClick={() => setStep(2)}
                  >
                    Back
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-b from-grimoire-gold to-grimoire-gold/80 border border-grimoire-gold-bright text-grimoire-bg font-fantasy font-bold rounded hover:from-grimoire-gold-bright hover:to-grimoire-gold hover:shadow-[0_0_20px_rgba(201,162,39,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
      </div>

      {showBookModal && (
        <BookFieldsModal
          bookFields={bookFields}
          onClose={() => setShowBookModal(false)}
          onSelect={handleBookModalSelect}
        />
      )}
    </>
  );
}
