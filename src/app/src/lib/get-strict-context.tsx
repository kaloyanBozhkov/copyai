import * as React from 'react';

export function getStrictContext<T>(name: string): [
  React.FC<{ value: T; children: React.ReactNode }>,
  () => T
] {
  const Context = React.createContext<T | null>(null);
  Context.displayName = name;

  const Provider: React.FC<{ value: T; children: React.ReactNode }> = ({
    value,
    children,
  }) => <Context.Provider value={value}>{children}</Context.Provider>;

  const useStrictContext = (): T => {
    const context = React.useContext(Context);
    if (context === null) {
      throw new Error(`${name} must be used within its Provider`);
    }
    return context;
  };

  return [Provider, useStrictContext];
}

