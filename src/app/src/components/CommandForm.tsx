import { useState, useEffect, useRef, useCallback } from "react";
import { useElectronListener, type FormField } from "../hooks/useElectronListener";
import { ipcRenderer } from "@/utils/electron";

export const CommandForm = () => {
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useElectronListener("command-form-init", ({ title, fields }) => {
    setTitle(title);
    setFields(fields);
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.name] = f.defaultValue || "";
    }
    setValues(initial);
  });

  useEffect(() => {
    if (fields.length > 0 && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [fields]);

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = useCallback(() => {
    // Check required fields
    for (const f of fields) {
      if (f.required !== false && !values[f.name]?.trim()) {
        return;
      }
    }
    ipcRenderer.send("command-form-submit", values);
  }, [fields, values]);

  const handleCancel = useCallback(() => {
    ipcRenderer.send("command-form-submit", null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSubmit, handleCancel]
  );

  if (fields.length === 0) return null;

  return (
    <div
      className="pointer-events-auto w-[400px] rounded-xl bg-[#1a1a2e] border border-[#2a2a4a] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
      onMouseEnter={() => ipcRenderer.send("form-mouse-enter")}
      onMouseLeave={() => ipcRenderer.send("form-mouse-leave")}
    >
      <div className="px-5 pt-4 pb-3 border-b border-[#2a2a4a]">
        <h2 className="text-[#c9a227] text-sm font-semibold tracking-wide">
          {title}
        </h2>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3" onKeyDown={handleKeyDown}>
        {fields.map((field, i) => (
          <div key={field.name} className="flex flex-col gap-1">
            <label className="text-[#8888aa] text-xs font-medium">
              {field.label}
            </label>
            {field.type === "select" ? (
              <select
                ref={i === 0 ? (el) => { firstInputRef.current = el; } : undefined}
                value={values[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="bg-[#12121f] text-[#e8dfc8] text-sm px-3 py-2 rounded-lg border border-[#2a2a4a] focus:border-[#c9a227] focus:outline-none transition-colors"
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                ref={i === 0 ? (el) => { firstInputRef.current = el; } : undefined}
                type={field.type}
                value={values[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                className="bg-[#12121f] text-[#e8dfc8] text-sm px-3 py-2 rounded-lg border border-[#2a2a4a] focus:border-[#c9a227] focus:outline-none transition-colors placeholder:text-[#555]"
              />
            )}
          </div>
        ))}
      </div>

      <div className="px-5 pb-4 flex justify-end gap-2">
        <button
          onClick={handleCancel}
          className="px-4 py-1.5 text-xs text-[#8888aa] hover:text-[#e8dfc8] rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-1.5 text-xs bg-[#c9a227] hover:bg-[#d4af37] text-[#1a1a2e] font-semibold rounded-lg transition-colors"
        >
          Connect
        </button>
      </div>
    </div>
  );
};
