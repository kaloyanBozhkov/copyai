import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import { useElectronListener } from "../hooks/useElectronListener";
import { useElectronActions } from "../hooks/useElectronAction";

const INPUT_BASE_CLASS =
  "pl-[6px] w-full h-full border-none outline-none text-base font-light bg-transparent leading-none tracking-wide";
export default function CommandInput() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    searchValue,
    autocompleteValue,
    argsValue,
    isDevMode,
    tabsCount,
    setSearchValue,
    setAutocompleteValue,
    setArgsValue,
    incrementTabsCount,
    resetTabsCount,
  } = useAppStore();

  const { mouseEnter, mouseLeave, autocompleteRequest, inputValue } =
    useElectronActions();

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    const container = containerRef.current;
    if (!textarea || !container) return;

    const hasNewlines = textarea.value.includes("\n");
    if (hasNewlines) {
      const maxHeight = Math.min(
        textarea.scrollHeight,
        document.body.clientHeight - 50
      );
      textarea.style.height = "auto";
      textarea.style.height = `${maxHeight}px`;
      container.style.height = `${maxHeight}px`;
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.height = "30px";
      container.style.height = "30px";
      textarea.style.overflowY = "hidden";
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [searchValue]);

  useElectronListener("autocomplete-result", ({ key, args, isTabPress }) => {
    setAutocompleteValue(key);
    setArgsValue(`${key}${args.length > 0 ? ` [${args.join(", ")}]` : ""}`);
    if (isTabPress) {
      setSearchValue(key + " ");
    }
  });

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    resetTabsCount();
    setSearchValue(e.target.value);
    autocompleteRequest({ searchValue: e.target.value });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputValue(searchValue);
    }

    if (e.key === "Escape") {
      inputValue(null);
    }

    if (e.key === "Tab") {
      e.preventDefault();
      if (!autocompleteValue) return;
      incrementTabsCount();

      if (tabsCount + 1 > 1) {
        setSearchValue("");
        setAutocompleteValue("");
        setArgsValue("");
        return;
      }

      autocompleteRequest({ searchValue, isTabPress: true });
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (pastedText.includes("\n")) {
      setTimeout(autoResize, 0);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={mouseEnter}
      onMouseLeave={mouseLeave}
      className="relative w-[400px] h-[30px] pointer-events-auto bg-white rounded-[10px]"
    >
      <textarea
        ref={textareaRef}
        id="search"
        rows={1}
        autoFocus
        value={searchValue}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`${INPUT_BASE_CLASS} relative -top-px font-light z-20 pt-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.3)] rounded-[10px] pointer-events-auto resize-none overflow-hidden`}
      />
      <input
        id="autocomplete"
        type="text"
        disabled
        value={autocompleteValue}
        className={` absolute inset-0 ${INPUT_BASE_CLASS} z-10 opacity-60 pointer-events-none`}
      />
      <input
        id="argsInput"
        type="text"
        disabled
        value={argsValue}
        className={` absolute inset-0 ${INPUT_BASE_CLASS} z-0 opacity-60 pointer-events-none text-orange-500`}
      />
      {isDevMode && (
        <span className="absolute -top-5 z-10 right-0 text-[10px] text-gray-400 pointer-events-none">
          (dev)
        </span>
      )}
    </div>
  );
}
