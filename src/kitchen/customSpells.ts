import fs from "fs";
import path from "path";
import os from "os";
import { CommandExecutor } from "./commandExecutor";
import {
  extractPlaceholders,
  extractAlchemyPlaceholders,
  replacePlaceholders,
} from "./helpers";
import { getBook, getAlchemy, executePotion } from "./grimoireSettings";
import { getLLMResponse } from "@koko420/ai-tools";
import { retry } from "@koko420/shared";
import z from "zod";

const CUSTOM_SPELLS_FILE = path.join(
  os.homedir(),
  ".copyai-custom-spells.json"
);

export interface CustomSpell {
  id: string;
  name: string;
  category: string;
  description?: string;
  systemMessageTemplate: string;
  retryCount: number;
  createdAt: number;
}

interface CustomSpellsData {
  spells: CustomSpell[];
}

let spellsCache: CustomSpell[] | null = null;

const changeListeners: Array<() => void> = [];

export const onCustomSpellsChange = (callback: () => void) => {
  changeListeners.push(callback);
  return () => {
    const index = changeListeners.indexOf(callback);
    if (index > -1) changeListeners.splice(index, 1);
  };
};

const notifyChange = () => {
  changeListeners.forEach((cb) => cb());
};

const loadSpells = (): CustomSpell[] => {
  if (spellsCache) return spellsCache;

  try {
    if (fs.existsSync(CUSTOM_SPELLS_FILE)) {
      const data = fs.readFileSync(CUSTOM_SPELLS_FILE, "utf-8");
      const parsed: CustomSpellsData = JSON.parse(data);
      spellsCache = parsed.spells || [];
      return spellsCache;
    }
  } catch (error) {
    console.error("Failed to load custom spells:", error);
  }

  spellsCache = [];
  return spellsCache;
};

const saveSpells = (spells: CustomSpell[]): void => {
  try {
    const data: CustomSpellsData = { spells };
    fs.writeFileSync(
      CUSTOM_SPELLS_FILE,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    spellsCache = spells;
    notifyChange();
  } catch (error) {
    console.error("Failed to save custom spells:", error);
  }
};

export const getCustomSpells = (): CustomSpell[] => {
  return loadSpells();
};

export const addCustomSpell = (
  spell: Omit<CustomSpell, "id" | "createdAt">
): CustomSpell => {
  const spells = loadSpells();
  const newSpell: CustomSpell = {
    ...spell,
    id: `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  spells.push(newSpell);
  saveSpells(spells);
  return newSpell;
};

export const removeCustomSpell = (id: string): boolean => {
  const spells = loadSpells();
  const filtered = spells.filter((s) => s.id !== id);
  if (filtered.length !== spells.length) {
    saveSpells(filtered);
    return true;
  }
  return false;
};

export const updateCustomSpell = (
  id: string,
  updates: Partial<Omit<CustomSpell, "id" | "createdAt">>
): CustomSpell | null => {
  const spells = loadSpells();
  const index = spells.findIndex((s) => s.id === id);
  if (index === -1) return null;

  spells[index] = { ...spells[index], ...updates };
  saveSpells(spells);
  return spells[index];
};

export const clearSpellsCache = (): void => {
  spellsCache = null;
};

const spellToExecutor = (spell: CustomSpell): CommandExecutor => {
  const placeholders = extractPlaceholders(spell.systemMessageTemplate);
  const alchemyPlaceholders = extractAlchemyPlaceholders(
    spell.systemMessageTemplate
  );

  const argDefs = placeholders.map((p) =>
    /^\d+$/.test(p) ? `$${p}: string` : `${p}: string`
  );

  const buildFn = async (args?: string[]) => {
    const bookValues = getBook();

    // Fetch alchemy values
    const alchemyValues: Record<string, string> = {};
    if (alchemyPlaceholders.length > 0) {
      const allPotions = getAlchemy();
      await Promise.all(
        alchemyPlaceholders.map(async (potionName) => {
          const potion = allPotions.find((p) => p.name === potionName);
          if (potion) {
            try {
              const value = await executePotion(potion);
              alchemyValues[`alchemy.${potionName}`] = value;
            } catch (error) {
              console.error(`Failed to execute potion ${potionName}:`, error);
              alchemyValues[`alchemy.${potionName}`] = `[Error: ${error}]`;
            }
          } else {
            alchemyValues[`alchemy.${potionName}`] =
              `[Potion not found: ${potionName}]`;
          }
        })
      );
    }

    const combinedValues = { ...bookValues, ...alchemyValues };

    // Build values map from args
    const valuesMap: Record<string, string> = {};
    if (args && args.length > 0) {
      placeholders.forEach((placeholder, index) => {
        if (args[index] !== undefined) {
          valuesMap[placeholder] = args[index];
        }
      });
    }

    // Build system message with injected args
    const systemMessage = replacePlaceholders(
      spell.systemMessageTemplate,
      valuesMap,
      combinedValues
    );

    const schema = z.object({
      response: z.string(),
    });

    const result = await retry(
      () =>
        getLLMResponse({
          systemMessage:
            systemMessage +
            `\n<important>
          - You must return valid JSON with the shape: { response: "" }.
          - Do not nest { response: "{ "response": "" "}" } in your response.
          - Keep your response as human readable as possible, as such prefer strings with nice formatting.
          </important>`,
          userMessage: [], // args injected in system message. Args come from user input
          schema,
        }),
      spell.retryCount,
      false
    );

    return result.response;
  };

  return [buildFn, ...argDefs];
};

export const getCustomSpellsAsExecutors = (): Record<
  string,
  CommandExecutor
> => {
  const spells = loadSpells();
  const result: Record<string, CommandExecutor> = {};

  for (const spell of spells) {
    const executor = spellToExecutor(spell);
    
    // Full key: spell.category.name
    const fullKey = `spell.${spell.category}.${spell.name}`;
    result[fullKey] = executor;
    
    // Medium key: category.name (without spell. prefix)
    const mediumKey = `${spell.category}.${spell.name}`;
    result[mediumKey] = executor;
    
    // Short key: just name
    result[spell.name] = executor;
  }

  return result;
};
