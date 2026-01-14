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
