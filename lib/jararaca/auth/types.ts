import { createContext, useContext } from "react";

export type Credentials = {
  accessToken: string;
  refreshToken: string;
};

export type Backend = {
  refreshCredentials: (refreshToken: string) => Promise<Credentials>;
};

export type NotLogged = {
  type: "not-logged";
};

export type Logged = {
  type: "logged";
  credentials: Credentials;
};
export type Loaging = {
  type: "loading";
};
export type ErrorState = {
  type: "error";
  error: unknown;
};

export type AuthContext = {
  loginState: Logged | NotLogged | Loaging | ErrorState;
  setCredentials: (credentials: Credentials) => void;
};

export function authContextFactory() {
  const authContext = createContext<AuthContext>({
    loginState: { type: "not-logged" },
    setCredentials: () => {},
  });

  return {
    useAuthContext() {
      return useContext(authContext);
    },
    Provider: authContext.Provider,
  };
}

export type AuthContextFactory = ReturnType<typeof authContextFactory>;
