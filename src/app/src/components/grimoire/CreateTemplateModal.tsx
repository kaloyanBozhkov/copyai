import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Scroll, Wand2, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import type { CustomTemplate } from "./types";

interface CreateTemplateModalProps {
  existingCategories: string[];
  onClose: () => void;
  onCreate: (template: Omit<CustomTemplate, "id" | "createdAt">) => void;
}

export function CreateTemplateModal({
  existingCategories,
  onClose,
  onCreate,
}: CreateTemplateModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [lines, setLines] = useState<string[]>([""]);
  const [previewArgs, setPreviewArgs] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Extract unique $N placeholders from all lines
  const extractedArgs = Array.from(
    new Set(
      lines
        .join("\n")
        .match(/\$(\d+)/g)
        ?.map((m) => parseInt(m.slice(1), 10)) || []
    )
  ).sort((a, b) => a - b);

  const handleAddLine = () => {
    setLines([...lines, ""]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleLineChange = (index: number, value: string) => {
    const newLines = [...lines];
    newLines[index] = value;
    setLines(newLines);
  };

  const getPreview = () => {
    let result = lines.join("\n");
    extractedArgs.forEach((argNum, i) => {
      const replacement = previewArgs[i] || `[arg${argNum}]`;
      result = result.split(`$${argNum}`).join(replacement);
    });
    return result;
  };

  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = category.trim().length > 0;
  const canCreate = lines.some((l) => l.trim().length > 0);

  const handleCreate = () => {
    if (!canCreate) return;
    onCreate({
      name: name.trim(),
      category: category.trim(),
      messageRecipe: lines.filter((l) => l.length > 0),
    });
  };

  return (
    <div className="grimoire-modal-overlay" onClick={onClose}>
      <div className="grimoire-modal" onClick={(e) => e.stopPropagation()}>
        <div className="grimoire-modal-header">
          <div className="grimoire-modal-title">
            <Sparkles size={18} />
            <span>Inscribe New Scroll</span>
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
                  Use <code>$0</code>, <code>$1</code>, etc. for placeholders that will
                  be replaced with arguments.
                </p>
              </div>

              <div className="grimoire-lines-editor">
                {lines.map((line, index) => (
                  <div key={index} className="grimoire-line-row">
                    <span className="grimoire-line-number">{index + 1}</span>
                    <input
                      type="text"
                      value={line}
                      onChange={(e) => handleLineChange(index, e.target.value)}
                      placeholder={`Line ${index + 1}...`}
                      className="grimoire-line-input"
                    />
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
              </div>

              {extractedArgs.length > 0 && (
                <div className="grimoire-args-detected">
                  <span>Detected placeholders:</span>
                  {extractedArgs.map((arg) => (
                    <code key={arg}>${arg}</code>
                  ))}
                </div>
              )}

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
                        {extractedArgs.map((argNum, i) => (
                          <input
                            key={argNum}
                            type="text"
                            placeholder={`$${argNum} value...`}
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
                  onClick={handleCreate}
                >
                  <Sparkles size={14} />
                  Inscribe Scroll
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

