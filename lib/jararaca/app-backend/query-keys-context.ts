import { createContext, useContext } from "react";

const QueryKeysContext = createContext<any[]>([]);

export const useQueryKeys = () => {
  return useContext(QueryKeysContext);
};

export const QueryKeysProvider = QueryKeysContext.Provider;
