import { useState, useEffect } from "react";
import { Copy, Trash2, Zap, Scroll, BookOpen, Code, Tag, Play, Edit2 } from "lucide-react";
import { ipcRenderer } from "@/utils/electron";
import type { CommandInfo, CustomTemplate, CustomSpell } from "./types";
import { ActionButton } from "../atoms/ActionButton.atom";

interface CommandDetailProps {
  command: CommandInfo | null;
  customTemplate: CustomTemplate | null;
  customSpell: CustomSpell | null;
  onDeleteCustomTemplate: (id: string) => void;
  onEditCustomTemplate: (template: CustomTemplate) => void;
  onDeleteCustomSpell: (id: string) => void;
  onEditCustomSpell: (spell: CustomSpell) => void;
}

export function CommandDetail({
  command,
  customTemplate,
  customSpell,
  onDeleteCustomTemplate,
  onEditCustomTemplate,
  onDeleteCustomSpell,
  onEditCustomSpell,
}: CommandDetailProps) {
  const [testArgs, setTestArgs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [spellResult, setSpellResult] = useState<{ success: boolean; message?: string; error?: string; copiedContent?: string } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset state when selection changes
  useEffect(() => {
    setTestArgs([]);
    setTestResult(null);
    setSpellResult(null);
    setCopied(false);
  }, [command, customTemplate, customSpell]);

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

  // Listen for spell execution results
  useEffect(() => {
    const handler = (_: unknown, result: { success: boolean; message?: string; error?: string }) => {
      setSpellResult(result);
      setIsExecuting(false);
    };
    ipcRenderer.on("grimoire-spell-result", handler);
    return () => {
      ipcRenderer.removeListener("grimoire-spell-result", handler);
    };
  }, []);

  const handleCopyKey = () => {
    const key = command?.fullKey || customTemplate?.name || (customSpell ? `spell.${customSpell.category}.${customSpell.name}` : "");
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

  const handleCastSpell = () => {
    if (command && command.type === "exec") {
      setIsExecuting(true);
      setSpellResult(null);
      ipcRenderer.send("grimoire-execute-spell", {
        commandKey: command.fullKey,
        args: testArgs,
      });
    }
  };

  const handleCastCustomSpell = () => {
    if (customSpell) {
      setIsExecuting(true);
      setSpellResult(null);
      ipcRenderer.send("grimoire-execute-spell", {
        commandKey: `spell.${customSpell.category}.${customSpell.name}`,
        args: testArgs,
      });
    }
  };

  const handleCopyResult = () => {
    if (testResult) {
      navigator.clipboard.writeText(testResult);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (customTemplate) {
      onDeleteCustomTemplate(customTemplate.id);
      setShowDeleteConfirm(false);
    } else if (customSpell) {
      onDeleteCustomSpell(customSpell.id);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // Empty state
  if (!command && !customTemplate && !customSpell) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-grimoire-bg-secondary/20 to-grimoire-bg/40">
        <div className="text-center space-y-4">
          <BookOpen size={48} className="mx-auto text-grimoire-text-dim opacity-50" />
          <h3 className="text-grimoire-text font-fantasy text-xl font-semibold">
            Select an Incantation
          </h3>
          <p className="text-grimoire-text-dim text-sm max-w-sm">
            Choose a spell or scroll from the grimoire to view its arcane details
          </p>
        </div>
      </div>
    );
  }

  const isTemplate = command?.type === "template" || customTemplate !== null;
  const isCustomTemplate = customTemplate !== null;
  const isCustomSpell = customSpell !== null;
  const title = command?.name || customTemplate?.name || customSpell?.name || "";
  const fullKey = command?.fullKey || (customTemplate ? `custom.${customTemplate.category}.${customTemplate.name}` : customSpell ? `spell.${customSpell.category}.${customSpell.name}` : "");
  const category = command?.category || customTemplate?.category || customSpell?.category || "";
  const description = command?.description || customTemplate?.description || customSpell?.description;
  const args = command?.args ?? (customTemplate ? extractArgsFromRecipe(customTemplate.messageRecipe) : customSpell ? extractArgsFromSystemMessage(customSpell.systemMessageTemplate) : []);
  const recipe = command?.messageRecipe || customTemplate?.messageRecipe;

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-grimoire-bg-secondary/20 to-grimoire-bg/40">
      {/* Header */}
      <div className="border-b border-grimoire-border bg-gradient-to-b from-grimoire-bg-secondary/40 to-transparent px-6 py-4 space-y-3">
        {/* Type & Actions */}
        <div className="flex items-center gap-3">
          {isCustomTemplate ? (
            <Scroll className="w-5 h-5 text-grimoire-purple-bright" />
          ) : isCustomSpell ? (
            <Zap className="w-5 h-5 text-grimoire-accent-bright" />
          ) : isTemplate ? (
            <Scroll className="w-5 h-5 text-grimoire-gold" />
          ) : (
            <Zap className="w-5 h-5 text-grimoire-accent-bright" />
          )}
          <span
            className={`px-3 py-1 rounded text-xs font-fantasy font-semibold ${
              isCustomTemplate
                ? "bg-grimoire-purple/20 text-grimoire-purple-bright border border-grimoire-purple/50"
                : isCustomSpell
                ? "bg-grimoire-accent/20 text-grimoire-accent-bright border border-grimoire-accent/50"
                : isTemplate
                ? "bg-grimoire-gold/20 text-grimoire-gold border border-grimoire-gold/50"
                : "bg-grimoire-accent/20 text-grimoire-accent-bright border border-grimoire-accent/50"
            }`}
          >
            {isCustomTemplate ? "Custom Scroll" : isCustomSpell ? "Custom AI Spell" : isTemplate ? "Scroll" : "Spell"}
          </span>
          {(isCustomTemplate || isCustomSpell) && (
            <div className="flex gap-2 ml-auto">
              <button
                className="p-2 rounded bg-grimoire-accent/20 border border-grimoire-accent/50 text-grimoire-accent-bright hover:bg-grimoire-accent/30 transition-all"
                onClick={() => isCustomTemplate ? onEditCustomTemplate(customTemplate!) : onEditCustomSpell(customSpell!)}
                title={isCustomTemplate ? "Edit this custom scroll" : "Edit this custom spell"}
              >
                <Edit2 size={14} />
              </button>
              <button
                className="p-2 rounded bg-grimoire-red/20 border border-grimoire-red/50 text-grimoire-red hover:bg-grimoire-red/30 transition-all"
                onClick={handleDeleteClick}
                title={isCustomTemplate ? "Delete this custom scroll" : "Delete this custom spell"}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className={`text-2xl font-fantasy font-bold ${
          isCustomTemplate ? "text-grimoire-purple-bright" : isCustomSpell ? "text-grimoire-accent-bright" : "text-grimoire-gold"
        }`}>
          {title}
        </h2>

        {/* Key */}
        <div className="flex items-center gap-2 bg-black/30 border border-grimoire-border rounded p-2">
          <Code size={14} className="text-grimoire-text-dim" />
          <code className="flex-1 text-grimoire-text text-sm font-grimoire">
            {fullKey}
          </code>
          <button
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              copied
                ? "bg-grimoire-green/20 text-grimoire-green border border-grimoire-green/50"
                : "bg-grimoire-gold/20 text-grimoire-gold border border-grimoire-gold/50 hover:bg-grimoire-gold/30"
            }`}
            onClick={handleCopyKey}
          >
            <Copy size={14} />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Description */}
        {description && (
          <p className="text-grimoire-text-dim text-sm italic">
            {description}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-6">
        {/* Category */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-grimoire-gold font-fantasy text-sm font-semibold">
            <Tag size={14} />
            <span>Category</span>
          </div>
          <div className="text-grimoire-text text-sm">
            {category}
            {command?.subcategory && (
              <span className="text-grimoire-text-dim"> → {command.subcategory}</span>
            )}
          </div>
        </div>

        {/* Parameters */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-grimoire-gold font-fantasy text-sm font-semibold">
            <BookOpen size={14} />
            <span>Parameters</span>
          </div>
          {args.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {args.map((arg, i) => (
                <code
                  key={i}
                  className="px-3 py-1.5 bg-grimoire-accent/20 border border-grimoire-accent/50 text-grimoire-accent-bright rounded text-xs font-grimoire"
                >
                  {arg}
                </code>
              ))}
            </div>
          ) : (
            <div className="text-grimoire-text-dim text-sm italic">No parameters required</div>
          )}
        </div>

        {/* Template Recipe Preview */}
        {recipe && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-grimoire-gold font-fantasy text-sm font-semibold">
              <Scroll size={14} />
              <span>Scroll Contents</span>
            </div>
            <pre className="p-4 bg-black/40 border border-grimoire-border rounded text-grimoire-text text-xs font-grimoire overflow-x-auto whitespace-pre-wrap break-words">
              {recipe.join("\n")}
            </pre>
          </div>
        )}

        {/* Template Testing */}
        {(isTemplate || isCustomTemplate) && recipe && (
          <div className="space-y-3 p-4 bg-gradient-to-br from-grimoire-accent/10 to-transparent border border-grimoire-accent/30 rounded">
            <div className="flex items-center gap-2 text-grimoire-accent-bright font-fantasy text-sm font-semibold">
              <Play size={14} />
              <span>Test Incantation</span>
            </div>

            {args.length > 0 ? (
              <div className="space-y-2">
                {args.map((arg, i) => (
                  <div key={i} className="space-y-1">
                    <label className="text-xs text-grimoire-text-dim font-grimoire">
                      {arg}
                    </label>
                    <input
                      type="text"
                      value={testArgs[i] || ""}
                      onChange={(e) => {
                        const newArgs = [...testArgs];
                        newArgs[i] = e.target.value;
                        setTestArgs(newArgs);
                      }}
                      placeholder="Enter value..."
                      className="w-full px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-accent-bright focus:ring-1 focus:ring-grimoire-accent-bright transition-all"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-grimoire-text-dim text-sm italic">
                No parameters - output will be static text
              </div>
            )}

            <ActionButton
              variant="accent"
              className="w-full text-sm"
              onClick={handleTestTemplate}
              icon={<Play size={14} />}
            >
              Cast Spell
            </ActionButton>

            {testResult && (
              <div className="space-y-2 p-3 bg-black/40 border border-grimoire-gold/50 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-grimoire-gold font-fantasy font-semibold">
                    Result
                  </span>
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-grimoire-text-dim hover:text-grimoire-gold hover:bg-grimoire-gold/10 transition-all"
                    onClick={handleCopyResult}
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                </div>
                <pre className="text-grimoire-text text-xs font-grimoire whitespace-pre-wrap break-words">
                  {testResult}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Spell Execution UI for exec commands */}
        {!isTemplate && command?.type === "exec" && (
          <div className="space-y-3 p-4 bg-gradient-to-br from-grimoire-accent/10 to-transparent border border-grimoire-accent/30 rounded">
            <div className="flex items-center gap-2 text-grimoire-accent-bright font-fantasy text-sm font-semibold">
              <Zap size={14} />
              <span>Cast Spell</span>
            </div>

            {args.length > 0 ? (
              <div className="space-y-2">
                {args.map((arg, i) => (
                  <div key={i} className="space-y-1">
                    <label className="text-xs text-grimoire-text-dim font-grimoire">
                      {arg}
                    </label>
                    <input
                      type="text"
                      value={testArgs[i] || ""}
                      onChange={(e) => {
                        const newArgs = [...testArgs];
                        newArgs[i] = e.target.value;
                        setTestArgs(newArgs);
                      }}
                      placeholder="Enter value..."
                      className="w-full px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-accent-bright focus:ring-1 focus:ring-grimoire-accent-bright transition-all"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-grimoire-text-dim text-sm italic">
                No parameters required
              </div>
            )}

            <ActionButton
              variant="accent"
              className="w-full text-sm"
              onClick={handleCastSpell}
              isLoading={isExecuting}
              icon={<Zap size={14} />}
            >
              Cast Spell
            </ActionButton>

            {spellResult && (
              <div className={`space-y-2 p-3 border rounded ${
                spellResult.success 
                  ? "bg-grimoire-green/10 border-grimoire-green/50" 
                  : "bg-grimoire-red/10 border-grimoire-red/50"
              }`}>
                <span className={`text-xs font-fantasy font-semibold ${
                  spellResult.success ? "text-grimoire-green" : "text-grimoire-red"
                }`}>
                  {spellResult.success ? "✓ Success" : "✗ Failed"}
                </span>
                <p className="text-grimoire-text text-xs">
                  {spellResult.success ? spellResult.message : spellResult.error}
                </p>
                {spellResult.copiedContent && (
                  <div className="mt-2 pt-2 border-t border-grimoire-green/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-grimoire-green font-fantasy">Copied to clipboard:</span>
                      <button
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-grimoire-text-dim hover:text-grimoire-gold hover:bg-grimoire-gold/10 transition-all"
                        onClick={() => navigator.clipboard.writeText(spellResult.copiedContent!)}
                      >
                        <Copy size={10} />
                        Copy
                      </button>
                    </div>
                    <pre className="text-grimoire-text text-xs font-grimoire bg-black/30 p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap break-words">
                      {spellResult.copiedContent}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start gap-2 pt-2 border-t border-grimoire-border/50">
              <Zap size={12} className="text-grimoire-text-dim mt-0.5 shrink-0" />
              <span className="text-grimoire-text-dim text-xs">
                This spell executes code and may interact with external services.
              </span>
            </div>
          </div>
        )}

        {/* Custom AI Spell Execution */}
        {isCustomSpell && customSpell && (
          <>
            {/* System Message Preview */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-grimoire-accent-bright font-fantasy text-sm font-semibold">
                <Code size={14} />
                <span>System Message Template</span>
              </div>
              <pre className="p-4 bg-black/40 border border-grimoire-border rounded text-grimoire-text text-xs font-grimoire overflow-x-auto whitespace-pre-wrap break-words max-h-48">
                {customSpell.systemMessageTemplate}
              </pre>
              <div className="text-xs text-grimoire-text-dim">
                Retries: {customSpell.retryCount}
              </div>
            </div>

            {/* Cast Section */}
            <div className="space-y-3 p-4 bg-gradient-to-br from-grimoire-accent/10 to-transparent border border-grimoire-accent/30 rounded">
              <div className="flex items-center gap-2 text-grimoire-accent-bright font-fantasy text-sm font-semibold">
                <Zap size={14} />
                <span>Cast AI Spell</span>
              </div>

              {args.length > 0 ? (
                <div className="space-y-2">
                  {args.map((arg, i) => (
                    <div key={i} className="space-y-1">
                      <label className="text-xs text-grimoire-text-dim font-grimoire">
                        {arg}
                      </label>
                      <input
                        type="text"
                        value={testArgs[i] || ""}
                        onChange={(e) => {
                          const newArgs = [...testArgs];
                          newArgs[i] = e.target.value;
                          setTestArgs(newArgs);
                        }}
                        placeholder="Enter value..."
                        className="w-full px-3 py-2 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-sm placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-accent-bright focus:ring-1 focus:ring-grimoire-accent-bright transition-all"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-grimoire-text-dim text-sm italic">
                  No input parameters required
                </div>
              )}

              <ActionButton
                variant="accent"
                className="w-full text-sm"
                onClick={handleCastCustomSpell}
                isLoading={isExecuting}
                icon={<Zap size={14} />}
              >
                Cast AI Spell
              </ActionButton>

              {spellResult && (
                <div className={`space-y-2 p-3 border rounded ${
                  spellResult.success 
                    ? "bg-grimoire-green/10 border-grimoire-green/50" 
                    : "bg-grimoire-red/10 border-grimoire-red/50"
                }`}>
                  <span className={`text-xs font-fantasy font-semibold ${
                    spellResult.success ? "text-grimoire-green" : "text-grimoire-red"
                  }`}>
                    {spellResult.success ? "✓ Success" : "✗ Failed"}
                  </span>
                  <p className="text-grimoire-text text-xs">
                    {spellResult.success ? spellResult.message : spellResult.error}
                  </p>
                  {spellResult.copiedContent && (
                    <div className="mt-2 pt-2 border-t border-grimoire-green/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-grimoire-green font-fantasy">Copied to clipboard:</span>
                        <button
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-grimoire-text-dim hover:text-grimoire-gold hover:bg-grimoire-gold/10 transition-all"
                          onClick={() => navigator.clipboard.writeText(spellResult.copiedContent!)}
                        >
                          <Copy size={10} />
                          Copy
                        </button>
                      </div>
                      <pre className="text-grimoire-text text-xs font-grimoire bg-black/30 p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap break-words">
                        {spellResult.copiedContent}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start gap-2 pt-2 border-t border-grimoire-border/50">
                <Zap size={12} className="text-grimoire-text-dim mt-0.5 shrink-0" />
                <span className="text-grimoire-text-dim text-xs">
                  This AI spell will call the LLM with your inputs and return the response.
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (customTemplate || customSpell) && (
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
                Delete {customTemplate ? "Custom Scroll" : "Custom AI Spell"}
              </h3>
            </div>
            <div className="px-6 py-6 space-y-4">
              <p className="text-grimoire-text text-sm">
                Are you sure you want to delete the {customTemplate ? "scroll" : "spell"}{" "}
                <span className={`font-fantasy font-semibold ${customTemplate ? "text-grimoire-purple-bright" : "text-grimoire-accent-bright"}`}>
                  "{customTemplate?.name || customSpell?.name}"
                </span>
                ?
              </p>
              <p className="text-grimoire-text-dim text-sm">
                This action cannot be undone. The {customTemplate ? "scroll" : "spell"} will be permanently removed from your
                grimoire.
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
                Delete {customTemplate ? "Scroll" : "Spell"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Extract placeholders from recipe - supports $0, ${0}, ${named}
 */
function extractArgsFromRecipe(recipe: string[]): string[] {
  const text = recipe.join("\n");
  return extractPlaceholdersFromText(text);
}

/**
 * Extract placeholders from system message template
 */
function extractArgsFromSystemMessage(text: string): string[] {
  return extractPlaceholdersFromText(text);
}

/**
 * Common placeholder extraction logic
 */
function extractPlaceholdersFromText(text: string): string[] {
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

  // Match ${named} placeholders (exclude book. and alchemy. prefixes)
  const namedPlaceholders = text.match(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g) || [];
  for (const m of namedPlaceholders) {
    const name = m.slice(2, -1);
    if (!name.startsWith("book.") && !name.startsWith("alchemy.") && !all.includes(name)) {
      all.push(name);
    }
  }

  // Return formatted arg definitions
  return all.map((p) => (/^\d+$/.test(p) ? `$${p}: string` : `${p}: string`));
}
