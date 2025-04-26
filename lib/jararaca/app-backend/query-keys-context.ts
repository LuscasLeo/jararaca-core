import { createContext, useContext } from "react";

const context = createContext<any[]>([]);

export const useQueryKeys = () => {
  return useContext(context);
};

export const QueryKeysProvider = context.Provider;
