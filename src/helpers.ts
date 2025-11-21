export const flattenObjectDot = <U>(obj: Record<string, Record<string, U>>) => {
  return Object.keys(obj).reduce((acc, category) => {
    return {
      ...acc,
      ...Object.keys(obj[category]).reduce((acc, command) => {
        return {
          ...acc,
          [`${category}.${command}`]: obj[category][command],
          // also shortcut command name
          [command]: obj[category][command],
        };
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
