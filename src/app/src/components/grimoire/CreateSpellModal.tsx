import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Wand2, Eye, EyeOff, Book, Beaker, Zap } from "lucide-react";
import type { CustomSpell, AlchemyPotion } from "./types";
import { BookFieldsModal } from "./BookFieldsModal";
import { AlchemyFieldsModal } from "./AlchemyFieldsModal";
import { ActionButton } from "../atoms/ActionButton.atom";

interface CreateSpellModalProps {
  existingCategories: string[];
  bookFields: Record<string, string>;
  alchemyPotions: AlchemyPotion[];
  existingSpell?: CustomSpell;
  onClose: () => void;
  onCreate: (spell: Omit<CustomSpell, "id" | "createdAt">) => void;
  onUpdate?: (id: string, spell: Omit<CustomSpell, "id" | "createdAt">) => void;
}

export function CreateSpellModal({
  existingCategories,
  bookFields,
  alchemyPotions,
  existingSpell,
  onClose,
  onCreate,
  onUpdate,
}: CreateSpellModalProps) {
  const isEditMode = !!existingSpell;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(existingSpell?.name || "");
  const [category, setCategory] = useState(existingSpell?.category || "");
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [systemMessage, setSystemMessage] = useState(existingSpell?.systemMessageTemplate || "");
  const [retryCount, setRetryCount] = useState(existingSpell?.retryCount || 3);
  const [showPreview, setShowPreview] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showAlchemyModal, setShowAlchemyModal] = useState(false);
  
  // Autocomplete state
  const [autocompleteType, setAutocompleteType] = useState<"book" | "alchemy" | null>(null);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const bookKeys = Object.keys(bookFields);
  const alchemyKeys = alchemyPotions.map((p) => p.name);

  const handleSystemMessageChange = (value: string, e?: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSystemMessage(value);
    
    // Use event target for cursor position (more reliable than ref during onChange)
    const target = e?.target || textareaRef.current;
    if (!target) {
      setAutocompleteType(null);
      setAutocompleteSuggestions([]);
      return;
    }
    
    const cursorPos = target.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    
    // Check for ${book. autocomplete
    const bookMatch = textBeforeCursor.match(/\$\{book\.(\w*)$/);
    if (bookMatch && bookKeys.length > 0) {
      const searchTerm = bookMatch[1].toLowerCase();
      const suggestions = searchTerm 
        ? bookKeys.filter((key) => key.toLowerCase().startsWith(searchTerm))
        : bookKeys; // Show all if just "${book."
      setAutocompleteType("book");
      setAutocompleteSuggestions(suggestions);
      return;
    }
    
    // Check for ${alchemy. autocomplete
    const alchemyMatch = textBeforeCursor.match(/\$\{alchemy\.(\w*)$/);
    if (alchemyMatch && alchemyKeys.length > 0) {
      const searchTerm = alchemyMatch[1].toLowerCase();
      const suggestions = searchTerm
        ? alchemyKeys.filter((key) => key.toLowerCase().startsWith(searchTerm))
        : alchemyKeys; // Show all if just "${alchemy."
      setAutocompleteType("alchemy");
      setAutocompleteSuggestions(suggestions);
      return;
    }
    
    setAutocompleteType(null);
    setAutocompleteSuggestions([]);
  };

  const handleAutocompleteSelect = (key: string) => {
    if (!textareaRef.current || !autocompleteType) return;
    
    const cursorPos = textareaRef.current.selectionStart || systemMessage.length;
    const textBeforeCursor = systemMessage.slice(0, cursorPos);
    const textAfterCursor = systemMessage.slice(cursorPos);
    
    const pattern = autocompleteType === "book" 
      ? /\$\{book\.(\w*)$/ 
      : /\$\{alchemy\.(\w*)$/;
    const match = textBeforeCursor.match(pattern);
    
    if (match) {
      const beforeMatch = textBeforeCursor.slice(0, match.index);
      const prefix = autocompleteType === "book" ? "book" : "alchemy";
      const newValue = `${beforeMatch}\${${prefix}.${key}}${textAfterCursor}`;
      setSystemMessage(newValue);
    }
    
    setAutocompleteType(null);
    setAutocompleteSuggestions([]);
    textareaRef.current?.focus();
  };

  // Extract placeholders from system message
  const extractedArgs = (() => {
    const all: string[] = [];
    const numberedNoBraces = systemMessage.match(/\$(\d+)(?!\w)/g) || [];
    for (const m of numberedNoBraces) {
      const num = m.slice(1);
      if (!all.includes(num)) all.push(num);
    }
    const numberedWithBraces = systemMessage.match(/\$\{(\d+)\}/g) || [];
    for (const m of numberedWithBraces) {
      const num = m.slice(2, -1);
      if (!all.includes(num)) all.push(num);
    }
    const namedPlaceholders = systemMessage.match(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g) || [];
    for (const m of namedPlaceholders) {
      const name = m.slice(2, -1);
      // Exclude book. and alchemy. prefixed ones
      if (!name.startsWith("book.") && !name.startsWith("alchemy.") && !all.includes(name)) {
        all.push(name);
      }
    }
    return all;
  })();

  const handleBookModalSelect = (field: string) => {
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart || systemMessage.length;
      const before = systemMessage.slice(0, cursorPos);
      const after = systemMessage.slice(cursorPos);
      setSystemMessage(`${before}\${book.${field}}${after}`);
    }
    setShowBookModal(false);
  };

  const handleAlchemyModalSelect = (potionName: string) => {
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart || systemMessage.length;
      const before = systemMessage.slice(0, cursorPos);
      const after = systemMessage.slice(cursorPos);
      setSystemMessage(`${before}\${alchemy.${potionName}}${after}`);
    }
    setShowAlchemyModal(false);
  };

  const getPreview = () => {
    let result = systemMessage;
    for (const [field, value] of Object.entries(bookFields)) {
      result = result.split(`\${book.${field}}`).join(value);
    }
    return result;
  };

  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = category.trim().length > 0;
  const canCreate = systemMessage.trim().length > 0;

  const handleSubmit = () => {
    if (!canCreate) return;
    const spellData = {
      name: name.trim(),
      category: category.trim(),
      systemMessageTemplate: systemMessage,
      retryCount,
    };

    if (isEditMode && existingSpell && onUpdate) {
      onUpdate(existingSpell.id, spellData);
    } else {
      onCreate(spellData);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl max-h-[90vh] bg-gradient-to-br from-grimoire-bg-secondary to-grimoire-bg border border-grimoire-accent rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-grimoire-accent/50 bg-gradient-to-r from-grimoire-accent/10 to-transparent">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-grimoire-accent-bright" />
              <span className="font-fantasy text-grimoire-accent-bright font-semibold">
                {isEditMode ? "Edit AI Spell" : "Forge New AI Spell"}
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
            <div className={`flex items-center ${step >= 1 ? "text-grimoire-accent-bright" : "text-grimoire-text-dim"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= 1 ? "bg-grimoire-accent/20 border-2 border-grimoire-accent-bright" : "bg-black/30 border border-grimoire-border"
              }`}>
                1
              </div>
              <span className="ml-2 text-xs font-fantasy">Name</span>
            </div>
            <div className={`w-8 h-px ${step >= 2 ? "bg-grimoire-accent-bright" : "bg-grimoire-border"}`} />
            <div className={`flex items-center ${step >= 2 ? "text-grimoire-accent-bright" : "text-grimoire-text-dim"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= 2 ? "bg-grimoire-accent/20 border-2 border-grimoire-accent-bright" : "bg-black/30 border border-grimoire-border"
              }`}>
                2
              </div>
              <span className="ml-2 text-xs font-fantasy">Category</span>
            </div>
            <div className={`w-8 h-px ${step >= 3 ? "bg-grimoire-accent-bright" : "bg-grimoire-border"}`} />
            <div className={`flex items-center ${step >= 3 ? "text-grimoire-accent-bright" : "text-grimoire-text-dim"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= 3 ? "bg-grimoire-accent/20 border-2 border-grimoire-accent-bright" : "bg-black/30 border border-grimoire-border"
              }`}>
                3
              </div>
              <span className="ml-2 text-xs font-fantasy">Configure</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {step === 1 && (
              <div className="flex flex-col items-center text-center space-y-4">
                <Wand2 size={32} className="text-grimoire-accent-bright" />
                <h3 className="text-xl font-fantasy font-bold text-grimoire-text">
                  Name Your Spell
                </h3>
                <p className="text-grimoire-text-dim text-sm max-w-md">
                  Choose a memorable name for your AI-powered incantation. Use snake_case for multi-word names.
                </p>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/\s+/g, "_"))}
                  placeholder="my_awesome_spell"
                  className="w-full max-w-sm px-4 py-3 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-center placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-accent focus:ring-2 focus:ring-grimoire-accent transition-all"
                  onKeyDown={(e) => e.key === "Enter" && canProceedStep1 && setStep(2)}
                />
                <ActionButton
                  variant="accent"
                  disabled={!canProceedStep1}
                  onClick={() => setStep(2)}
                >
                  Continue
                </ActionButton>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col items-center text-center space-y-4">
                <Sparkles size={32} className="text-grimoire-accent-bright" />
                <h3 className="text-xl font-fantasy font-bold text-grimoire-text">
                  Choose a Category
                </h3>
                <p className="text-grimoire-text-dim text-sm max-w-md">
                  Organize your spell within a category. Select existing or create new.
                </p>

                <div className="flex gap-2 bg-black/20 rounded p-1 border border-grimoire-border/50">
                  <button
                    className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                      !isNewCategory
                        ? "bg-grimoire-accent/20 text-grimoire-accent-bright"
                        : "text-grimoire-text-dim hover:text-grimoire-text"
                    }`}
                    onClick={() => setIsNewCategory(false)}
                  >
                    Existing
                  </button>
                  <button
                    className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                      isNewCategory
                        ? "bg-grimoire-accent/20 text-grimoire-accent-bright"
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
                    className="w-full max-w-sm px-4 py-3 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-center placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-accent focus:ring-2 focus:ring-grimoire-accent transition-all"
                    onKeyDown={(e) => e.key === "Enter" && canProceedStep2 && setStep(3)}
                  />
                ) : (
                  <div className="grid grid-cols-3 gap-2 w-full max-w-lg">
                    {existingCategories.map((cat) => (
                      <button
                        key={cat}
                        className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                          category === cat
                            ? "bg-grimoire-accent/20 text-grimoire-accent-bright border border-grimoire-accent/50"
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
                  <ActionButton variant="ghost" onClick={() => setStep(1)}>
                    Back
                  </ActionButton>
                  <ActionButton
                    variant="accent"
                    disabled={!canProceedStep2}
                    onClick={() => setStep(3)}
                  >
                    Continue
                  </ActionButton>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-fantasy font-bold text-grimoire-text mb-1">
                    Configure Your AI Spell
                  </h3>
                  <p className="text-grimoire-text-dim text-sm">
                    Write the system message that instructs the AI. Use{" "}
                    <code className="px-1 py-0.5 bg-black/30 rounded text-grimoire-accent-bright text-xs">$0</code>,{" "}
                    <code className="px-1 py-0.5 bg-black/30 rounded text-grimoire-accent-bright text-xs">${"{name}"}</code> for input placeholders.
                  </p>
                </div>

                {/* System Message */}
                <div className="space-y-2">
                  <label className="text-grimoire-text font-fantasy text-sm font-semibold">
                    System Message Template
                  </label>
                  <p className="text-grimoire-text-dim text-xs">
                    Type <code className="px-1 py-0.5 bg-black/30 rounded text-grimoire-accent-bright font-grimoire">${"{book."}</code> or{" "}
                    <code className="px-1 py-0.5 bg-black/30 rounded text-grimoire-purple-bright font-grimoire">${"{alchemy."}</code> for autocomplete
                  </p>
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={systemMessage}
                      onChange={(e) => handleSystemMessageChange(e.target.value, e)}
                      onBlur={() => setTimeout(() => setAutocompleteType(null), 150)}
                      placeholder="You are a professional assistant. The user will provide $0 and you must..."
                      className="w-full h-40 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-grimoire placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-accent focus:ring-1 focus:ring-grimoire-accent transition-all resize-y"
                    />
                  </div>
                  {/* Autocomplete dropdown - rendered outside relative container to avoid overflow clipping */}
                  {autocompleteType && autocompleteSuggestions.length > 0 && (
                    <div className={`mt-1 bg-grimoire-bg-secondary border rounded shadow-xl max-h-40 overflow-y-auto ${
                      autocompleteType === "book" ? "border-grimoire-accent/50" : "border-grimoire-purple/50"
                    }`}>
                      <div className="px-3 py-1.5 border-b border-grimoire-border text-xs text-grimoire-text-dim font-fantasy">
                        {autocompleteType === "book" ? "📖 Book Fields" : "🧪 Alchemy Potions"}
                      </div>
                      {autocompleteSuggestions.map((key) => (
                        <button
                          key={key}
                          className={`w-full px-3 py-2 flex items-center gap-2 text-sm transition-colors text-left ${
                            autocompleteType === "book"
                              ? "hover:bg-grimoire-accent/10"
                              : "hover:bg-grimoire-purple/10"
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleAutocompleteSelect(key)}
                        >
                          {autocompleteType === "book" ? (
                            <Book size={12} className="text-grimoire-accent-bright" />
                          ) : (
                            <Beaker size={12} className="text-grimoire-purple-bright" />
                          )}
                          <code className={`font-grimoire text-xs ${
                            autocompleteType === "book"
                              ? "text-grimoire-accent-bright"
                              : "text-grimoire-purple-bright"
                          }`}>
                            ${`{${autocompleteType}.${key}}`}
                          </code>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-grimoire-accent/10 border border-grimoire-accent/50 text-grimoire-accent-bright hover:bg-grimoire-accent/20 text-sm transition-all"
                      onClick={() => setShowBookModal(true)}
                    >
                      <Book size={14} />
                      Insert Book Field
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-grimoire-purple/10 border border-grimoire-purple/50 text-grimoire-purple-bright hover:bg-grimoire-purple/20 text-sm transition-all"
                      onClick={() => setShowAlchemyModal(true)}
                    >
                      <Beaker size={14} />
                      Insert Potion
                    </button>
                  </div>
                </div>

                {/* Retry Count */}
                <div className="space-y-2">
                  <label className="text-grimoire-text font-fantasy text-sm font-semibold">
                    Retry Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={retryCount}
                    onChange={(e) => setRetryCount(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                    className="w-24 px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm font-grimoire focus:outline-none focus:border-grimoire-accent focus:ring-1 focus:ring-grimoire-accent transition-all"
                  />
                </div>

                {/* Detected placeholders */}
                {extractedArgs.length > 0 && (
                  <div className="p-3 bg-grimoire-accent/10 border border-grimoire-accent/30 rounded">
                    <span className="text-grimoire-accent-bright font-fantasy text-xs font-semibold block mb-2">
                      Detected input placeholders:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {extractedArgs.map((arg) => (
                        <code
                          key={arg}
                          className="px-2 py-1 bg-grimoire-accent/20 border border-grimoire-accent/50 rounded text-grimoire-accent-bright text-xs font-grimoire"
                        >
                          {/^\d+$/.test(arg) ? `$${arg}` : `\${${arg}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview */}
                <div className="space-y-2">
                  <button
                    className="flex items-center gap-2 text-sm text-grimoire-text-dim hover:text-grimoire-text transition-all"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showPreview ? "Hide Preview" : "Show Preview"}
                  </button>

                  {showPreview && (
                    <pre className="p-4 bg-black/40 border border-grimoire-accent/50 rounded text-grimoire-text text-xs font-grimoire overflow-x-auto whitespace-pre-wrap break-words">
                      {getPreview()}
                    </pre>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-grimoire-border">
                  <ActionButton variant="ghost" onClick={() => setStep(2)}>
                    Back
                  </ActionButton>
                  <ActionButton
                    variant="accent"
                    className="flex-1"
                    disabled={!canCreate}
                    onClick={handleSubmit}
                    icon={<Zap size={14} />}
                  >
                    {isEditMode ? "Update Spell" : "Forge Spell"}
                  </ActionButton>
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

      {showAlchemyModal && (
        <AlchemyFieldsModal
          potions={alchemyPotions}
          onClose={() => setShowAlchemyModal(false)}
          onSelect={handleAlchemyModalSelect}
        />
      )}
    </>
  );
}

