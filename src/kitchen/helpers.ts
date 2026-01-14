type NestedCommands<U> = Record<string, U | Record<string, U>>;

export const flattenObjectDot = <U>(obj: Record<string, NestedCommands<U>>) => {
  return Object.keys(obj).reduce((acc, category) => {
    const categoryObj = obj[category];
    
    return {
      ...acc,
      ...Object.keys(categoryObj).reduce((acc, key) => {
        const value = categoryObj[key];
        
        // Check if this is a nested subcategory (object but not an array)
        if (value && typeof value === 'object' && !Array.isArray(value) && 'constructor' in value && value.constructor === Object) {
          // It's a subcategory, flatten one more level
          const subcategory = value as Record<string, U>;
          return {
            ...acc,
            ...Object.keys(subcategory).reduce((acc, command) => {
              return {
                ...acc,
                [`${category}.${key}.${command}`]: subcategory[command],
                // Also create shortcut without category for backwards compatibility
                [`${key}.${command}`]: subcategory[command],
              };
            }, {} as Record<string, U>),
          };
        } else {
          // It's a command executor
          return {
            ...acc,
            [`${category}.${key}`]: value as U,
            // also shortcut command name
            [key]: value as U,
          };
        }
      }, {} as Record<string, U>),
    };
  }, {} as Record<string, U>);
};

export const countUniqueArgs = (message: string) => {
  const matches = message.match(/\$[0-9]+/g) || []; // returns array or empty
  const uniqueMatches = new Set(matches);
  const uniqueCount = uniqueMatches.size;
  return uniqueCount;
};

/**
 * Extract all placeholders from a template string
 * Supports: $0, $1, ${0}, ${1}, ${named}, ${param_name}
 * Returns array of unique placeholder names in order of appearance
 */
export const extractPlaceholders = (text: string): string[] => {
  // Match $0, $1 etc (without braces)
  const numberedNoBraces = text.match(/\$(\d+)(?!\w)/g) || [];
  // Match ${0}, ${1} etc (with braces, numbered)
  const numberedWithBraces = text.match(/\$\{(\d+)\}/g) || [];
  // Match ${named} placeholders (with braces, named - letters, numbers, underscores)
  const namedPlaceholders = text.match(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g) || [];

  // Extract just the names/numbers
  const all: string[] = [];
  
  // Process numbered without braces: $0 -> "0"
  for (const m of numberedNoBraces) {
    const num = m.slice(1); // Remove $
    if (!all.includes(num)) all.push(num);
  }
  
  // Process numbered with braces: ${0} -> "0"
  for (const m of numberedWithBraces) {
    const num = m.slice(2, -1); // Remove ${ and }
    if (!all.includes(num)) all.push(num);
  }
  
  // Process named: ${param} -> "param"
  for (const m of namedPlaceholders) {
    const name = m.slice(2, -1); // Remove ${ and }
    if (!all.includes(name)) all.push(name);
  }

  return all;
};

/**
 * Replace placeholders in text with provided values
 * Supports: $0, ${0}, ${named}
 * @param text - Template text
 * @param values - Object mapping placeholder names to values, or array for numbered
 */
export const replacePlaceholders = (
  text: string,
  values: Record<string, string> | string[]
): string => {
  let result = text;
  
  if (Array.isArray(values)) {
    // Array mode: replace $0, ${0}, $1, ${1}, etc.
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      // Replace both $N and ${N} formats
      result = result.split(`$${i}`).join(val);
      result = result.split(`\${${i}}`).join(val);
    }
  } else {
    // Object mode: replace all named and numbered placeholders
    for (const [key, val] of Object.entries(values)) {
      // Replace ${name} format
      result = result.split(`\${${key}}`).join(val);
      // If key is a number, also replace $N format
      if (/^\d+$/.test(key)) {
        result = result.split(`$${key}`).join(val);
      }
    }
  }
  
  return result;
};
