import {
  useMutation,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";

import { useControllerFactory } from "./abc";

export function createClassMutationHooks<
  ClassT extends new (...args: any[]) => any,
  Methods extends Array<keyof InstanceType<ClassT>>,
>(classType: ClassT, ...methods: Methods) {
  type OptionalUseMutationOptions<T> = Omit<
    UseMutationOptions<T>,
    "mutationFn"
  >;
  type PrefixedMethods = {
    [K in Methods[number] as `use${Capitalize<string & K>}`]: InstanceType<ClassT>[K] extends (
      ...args: infer Args
    ) => Promise<infer Result>
      ? Args extends []
        ? (
            options?: OptionalUseMutationOptions<Result>,
          ) => UseMutationResult<Result>
        : Args extends [infer FirstArg]
          ? (
              options?: OptionalUseMutationOptions<Result>,
            ) => UseMutationResult<Result, unknown, FirstArg>
          : (
              options?: OptionalUseMutationOptions<Result>,
            ) => UseMutationResult<Result, unknown, Args>
      : never;
  };

  const hooks = {} as PrefixedMethods;

  methods.forEach((methodName) => {
    if (typeof methodName !== "string") {
      throw new Error("Method " + String(methodName) + " is not a string");
    }

    const method = classType.prototype[methodName];

    if (typeof method !== "function") {
      throw new Error("Method " + methodName + " is not a function");
    }

    const methosData = Object.getOwnPropertyDescriptor(method, "length");

    if (!methosData)
      throw new Error("Method " + methodName + " is not a function");

    const hookName =
      `use${methodName.charAt(0).toUpperCase() + methodName.slice(1)}` as keyof PrefixedMethods;
    hooks[hookName] = function useM(options?: OptionalUseMutationOptions<any>) {
      const cf = useControllerFactory(classType);
      return useMutation({
        mutationFn: async (args: any) => {
          if (methosData.value <= 1) {
            const instance = cf.create();
            const method = instance[methodName];
            const result = await method(args);
            return result;
          }
          const instance = cf.create();
          const method = instance[methodName];
          const result = await method(...args);
          return result;
        },
        ...options,
      });
    } as PrefixedMethods[keyof PrefixedMethods];
  });

  return hooks;
}
