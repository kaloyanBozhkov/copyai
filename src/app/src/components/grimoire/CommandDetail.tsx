import { useState, useEffect } from "react";
import { Copy, Trash2, Zap, Scroll, BookOpen, Code, Tag, Play, Edit2 } from "lucide-react";
import { ipcRenderer } from "@/utils/electron";
import type { CommandInfo, CustomTemplate } from "./types";

interface CommandDetailProps {
  command: CommandInfo | null;
  customTemplate: CustomTemplate | null;
  onDeleteCustomTemplate: (id: string) => void;
  onEditCustomTemplate: (template: CustomTemplate) => void;
}

export function CommandDetail({
  command,
  customTemplate,
  onDeleteCustomTemplate,
  onEditCustomTemplate,
}: CommandDetailProps) {
  const [testArgs, setTestArgs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset state when selection changes
  useEffect(() => {
    setTestArgs([]);
    setTestResult(null);
    setCopied(false);
  }, [command, customTemplate]);

  // Listen for template execution results
  useEffect(() => {
    const handler = (_: unknown, result: string) => {
      setTestResult(result);
    };
    ipcRenderer.on("grimoire-template-result", handler);
    return () => {
      ipcRenderer.removeListener("grimoire-template-result", handler);
    };
  }, []);

  const handleCopyKey = () => {
    const key = command?.fullKey || customTemplate?.name || "";
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestTemplate = () => {
    const recipe = command?.messageRecipe || customTemplate?.messageRecipe;
    if (recipe) {
      ipcRenderer.send("grimoire-execute-template", {
        messageRecipe: recipe,
        args: testArgs,
      });
    }
  };

  const handleCopyResult = () => {
    if (testResult) {
      navigator.clipboard.writeText(testResult);
    }
  };

  // Empty state
  if (!command && !customTemplate) {
    return (
      <div className="grimoire-detail">
        <div className="grimoire-detail-empty">
          <BookOpen size={48} className="grimoire-empty-icon" />
          <h3>Select an Incantation</h3>
          <p>Choose a spell or scroll from the grimoire to view its arcane details</p>
        </div>
      </div>
    );
  }

  const isTemplate = command?.type === "template" || customTemplate !== null;
  const isCustom = customTemplate !== null;
  const title = command?.name || customTemplate?.name || "";
  const fullKey = command?.fullKey || `custom.${customTemplate?.category}.${customTemplate?.name}`;
  const category = command?.category || customTemplate?.category || "";
  const args = command?.args || extractArgsFromRecipe(customTemplate?.messageRecipe || []);
  const recipe = command?.messageRecipe || customTemplate?.messageRecipe;

  return (
    <div className="grimoire-detail">
      <div className="grimoire-detail-header">
        <div className="grimoire-detail-type">
          {isTemplate ? (
            <Scroll className="grimoire-type-icon template" />
          ) : (
            <Zap className="grimoire-type-icon exec" />
          )}
          <span className={`grimoire-type-label ${isTemplate ? "template" : "exec"}`}>
            {isCustom ? "Custom Scroll" : isTemplate ? "Scroll" : "Spell"}
          </span>
          {isCustom && (
            <>
              <button
                className="grimoire-edit-btn"
                onClick={() => onEditCustomTemplate(customTemplate!)}
                title="Edit this custom scroll"
              >
                <Edit2 size={14} />
              </button>
              <button
                className="grimoire-delete-btn"
                onClick={() => onDeleteCustomTemplate(customTemplate!.id)}
                title="Delete this custom scroll"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>

        <h2 className="grimoire-detail-title">{title}</h2>

        <div className="grimoire-detail-key">
          <Code size={14} />
          <code>{fullKey}</code>
          <button
            className={`grimoire-copy-btn ${copied ? "copied" : ""}`}
            onClick={handleCopyKey}
          >
            <Copy size={14} />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="grimoire-detail-body">
        {/* Category */}
        <div className="grimoire-info-section">
          <div className="grimoire-info-label">
            <Tag size={14} />
            <span>Category</span>
          </div>
          <div className="grimoire-info-value">
            {category}
            {command?.subcategory && ` → ${command.subcategory}`}
          </div>
        </div>

        {/* Arguments */}
        <div className="grimoire-info-section">
          <div className="grimoire-info-label">
            <BookOpen size={14} />
            <span>Parameters</span>
          </div>
          {args.length > 0 ? (
            <div className="grimoire-args-list">
              {args.map((arg, i) => (
                <div key={i} className="grimoire-arg-item">
                  <code className="grimoire-arg-name">{arg}</code>
                </div>
              ))}
            </div>
          ) : (
            <div className="grimoire-info-value muted">No parameters required</div>
          )}
        </div>

        {/* Template Recipe Preview */}
        {recipe && (
          <div className="grimoire-info-section">
            <div className="grimoire-info-label">
              <Scroll size={14} />
              <span>Scroll Contents</span>
            </div>
            <pre className="grimoire-recipe-preview">{recipe.join("\n")}</pre>
          </div>
        )}

        {/* Template Testing */}
        {(isTemplate || isCustom) && recipe && (
          <div className="grimoire-test-section">
            <div className="grimoire-info-label">
              <Play size={14} />
              <span>Test Incantation</span>
            </div>

            {args.length > 0 ? (
              <div className="grimoire-test-inputs">
                {args.map((arg, i) => (
                  <div key={i} className="grimoire-test-input">
                    <label>{arg}</label>
                    <input
                      type="text"
                      value={testArgs[i] || ""}
                      onChange={(e) => {
                        const newArgs = [...testArgs];
                        newArgs[i] = e.target.value;
                        setTestArgs(newArgs);
                      }}
                      placeholder={`Enter value...`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grimoire-info-value muted">
                No parameters - output will be static text
              </div>
            )}

            <button className="grimoire-test-btn" onClick={handleTestTemplate}>
              <Play size={14} />
              Cast Spell
            </button>

            {testResult && (
              <div className="grimoire-test-result">
                <div className="grimoire-test-result-header">
                  <span>Result</span>
                  <button onClick={handleCopyResult}>
                    <Copy size={12} />
                    Copy
                  </button>
                </div>
                <pre>{testResult}</pre>
              </div>
            )}
          </div>
        )}

        {/* Exec-only info */}
        {!isTemplate && (
          <div className="grimoire-exec-notice">
            <Zap size={14} />
            <span>
              This spell executes code and may interact with external services.
              Use from the command input to cast.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Extract placeholders from recipe - supports $0, ${0}, ${named}
 */
function extractArgsFromRecipe(recipe: string[]): string[] {
  const text = recipe.join("\n");
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

  // Return formatted arg definitions
  return all.map((p) => 
    /^\d+$/.test(p) ? `$${p}: string` : `${p}: string`
  );
}

