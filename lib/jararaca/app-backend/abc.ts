import { createContext, useContext, useMemo } from "react";

import { AxiosInstance, AxiosRequestConfig } from "axios";

export abstract class HttpService {
  constructor(protected readonly httpBackend: HttpBackend) {}
}
export interface HttpBackendRequest {
  method: string;
  path: string;
  pathParams: { [key: string]: any };
  headers: { [key: string]: string };
  query: { [key: string]: unknown };
  body: unknown;
  responseType?: ResponseType;
}
export interface HttpBackend {
  request<T>(request: HttpBackendRequest): Promise<T>;
}

function createContextKit<T>(name?: string, defaultValue?: T) {
  const ThisContext = createContext<T | null>(defaultValue || null);

  function useKit() {
    const backend = useContext(ThisContext);
    if (backend === null) {
      throw new Error("No backend context found for " + name);
    }

    return backend;
  }

  const Provider = ThisContext.Provider;

  return {
    Provider,
    useKit,
  };
}

export function recursiveCamelToSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(recursiveCamelToSnakeCase);
  } else if (typeof obj === "object" && obj !== null && "constructor" in obj && obj.constructor === Object) {
    return Object.keys(obj).reduce((acc, key) => {
      const newKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      return { ...acc, [newKey]: recursiveCamelToSnakeCase(obj[key]) };
    }, {});
  } else {
    return obj;
  }
}

export function recursiveSnakeToCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(recursiveSnakeToCamelCase);
  } else if (typeof obj === "object" && obj !== null && "constructor" in obj && obj.constructor === Object) {
    return Object.keys(obj).reduce((acc, key) => {
      const newKey = key.replace(/_[a-z]/g, (letter) => letter[1].toUpperCase());
      return { ...acc, [newKey]: recursiveSnakeToCamelCase(obj[key]) };
    }, {});
  } else {
    return obj;
  }
}

const oneFileFormData = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
};

export function setupAxiosCasesTransformerInterceptors(axiosInstance: AxiosInstance) {
  axiosInstance.interceptors.request.use((request) => {
    if (request.data) {
      request.data = recursiveCamelToSnakeCase(request.data);
    }

    return request;
  });

  axiosInstance.interceptors.response.use((response) => {
    if (response.data) {
      response.data = recursiveSnakeToCamelCase(response.data);
    }

    return response;
  });
}

export const createAxiosHttpBackend = (axiosInstance: AxiosInstance, customOptions: AxiosRequestConfig = {}): HttpBackend => ({
  async request<T>(request: HttpBackendRequest): Promise<T> {
    return await axiosInstance
      .request<T>({
        method: request.method,
        url: Object.entries(request.pathParams).reduce((url, [key, value]) => url.replace(`:${key}`, encodeURIComponent(value)), request.path),
        headers: {
          ...request.headers,
          ...((request.body instanceof FormData || request.body instanceof File) && {
            "Content-Type": "multipart/form-data",
          }),
        },
        params: request.query,
        data: request.body instanceof File ? oneFileFormData(request.body) : request.body,
        ...customOptions,
      })
      .then((response) => response.data);
  },
});

export const { Provider: BackendProvider, useKit: useBackend } = createContextKit<HttpBackend>("backend");

export const { Provider: AxiosProvider, useKit: useAxios } = createContextKit<AxiosInstance>("axios");

export const { Provider: AxiosConfigProvider, useKit: useAxiosConfig } = createContextKit<AxiosRequestConfig>("axios-config", {});

export type ControllerFactory<T> = {
  create(options?: AxiosRequestConfig): T;
};

export function useControllerFactory<C extends new (...args: ConstructorParameters<typeof HttpService>) => InstanceType<C>>(controllerKey: C): ControllerFactory<InstanceType<C>> {
  const axiosInstance = useAxios();
  const axiosDefaults = useAxiosConfig();
  return useMemo(
    () => ({
      create: (options) => {
        const backend: HttpBackend = {
          request: async (request) => {
            return await createAxiosHttpBackend(axiosInstance, {
              ...axiosDefaults,
              ...options,
            }).request(request);
          },
        };

        return prevendUboundThis(new controllerKey(backend) as any);
      },
    }),
    [axiosDefaults, axiosInstance, controllerKey]
  );
}

function prevendUboundThis<T extends object>(instance: T): T {
  const self = instance;

  return new Proxy(instance, {
    get(_, prop) {
      const value = self[prop as keyof T];

      if (typeof value === "function") {
        return value.bind(self);
      }

      return self[prop as keyof T];
    },
  });
}

export type ResponseType = "arraybuffer" | "blob" | "document" | "json" | "text" | "stream" | "formdata";

export interface HttpBackendRequest {
  method: string;
  path: string;
  pathParams: { [key: string]: any };
  headers: { [key: string]: string };
  query: { [key: string]: unknown };
  body: unknown;
  responseType?: ResponseType;
}

export interface HttpBackend {
  request<T>(request: HttpBackendRequest): Promise<T>;
}
