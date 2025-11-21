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
