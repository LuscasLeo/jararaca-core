import {
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useEffect,
  useState,
} from "react";

import { isAxiosError } from "axios";
import { enqueueSnackbar } from "notistack";

import { AuthContextFactory, Backend, Credentials } from "./types";
import { useAxios } from "../app-backend/abc";

export type AuthContextProviderProps = PropsWithChildren<{
  LoadingComponent: React.ReactNode;
  Provider: AuthContextFactory["Provider"];
  backend: Backend;
  credentialsState: [
    Credentials | null,
    Dispatch<SetStateAction<Credentials | null>>,
  ];
}>;

export function AuthContextProvider({
  children,
  Provider,
  backend,
  credentialsState: [credentials, setCredentials],
  LoadingComponent,
}: AuthContextProviderProps) {
  const currentAxios = useAxios();

  const [injected, setInjected] = useState(false);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setInjected(true));
    if (credentials) {
      const { accessToken, refreshToken } = credentials;

      currentAxios.defaults.headers.Authorization = `Bearer ${accessToken}`;

      const id = currentAxios.interceptors.response.use(
        (response) => response,
        async (error) => {
          if (
            !isAxiosError(error) ||
            error.response?.status !== 401 ||
            error.response?.headers["scope"] !== "auth" ||
            error.response?.headers["error"] !== "invalid_token" ||
            !refreshToken ||
            !error.config
          ) {
            throw error;
          }

          const config = error.config;

          try {
            enqueueSnackbar("Reestabelecendo sessão.");
            const response = await backend.refreshCredentials(refreshToken);
            setCredentials(response);
            currentAxios.defaults.headers.Authorization = `Bearer ${response.accessToken}`;
            config.headers.Authorization = `Bearer ${response.accessToken}`;
            return currentAxios(config);
          } catch (err) {
            if (!isAxiosError(err) || err.response?.status === 401) {
              setCredentials(null);
              enqueueSnackbar("Sua sessão expirou. Faça login novamente.", {
                variant: "error",
              });
            } else {
              console.error("Error refreshing credentials:", err);
            }
            throw error;
          }
        },
      );
      return () => {
        currentAxios.interceptors.response.eject(id);
        cancelAnimationFrame(timer);
      };
    }
  }, [currentAxios, backend, credentials, setCredentials]);

  return (
    (!injected && LoadingComponent) || (
      <Provider
        value={{
          loginState: credentials
            ? { type: "logged", credentials }
            : { type: "not-logged" },
          setCredentials,
        }}
      >
        {children}
      </Provider>
    )
  );
}
