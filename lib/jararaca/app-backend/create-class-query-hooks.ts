import {
  useQuery,
  UseQueryOptions,
  UseQueryResult,
  UseInfiniteQueryResult,
  UseInfiniteQueryOptions,
  useInfiniteQuery,
  InfiniteData,
} from "@tanstack/react-query";

import { useControllerFactory } from "./abc";
import { useQueryKeys } from "./query-keys-context";

export function createClassQueryHooks<
  ClassT extends new (...args: any[]) => any,
  Methods extends Array<keyof InstanceType<ClassT>>,
>(classType: ClassT, ...methods: Methods) {
  type OptionalUseQueryOptions<T> = Omit<
    UseQueryOptions<T>,
    "queryKey" | "queryFn"
  >;
  type PrefixedMethods = {
    [K in Methods[number] as `use${Capitalize<string & K>}`]: InstanceType<ClassT>[K] extends (
      ...args: infer Args
    ) => Promise<infer Result>
      ? Args extends []
        ? (options?: OptionalUseQueryOptions<Result>) => UseQueryResult<Result>
        : Args extends [infer FirstArg]
          ? (
              args: FirstArg,
              options?: OptionalUseQueryOptions<Result>,
            ) => UseQueryResult<Result>
          : (
              args: Args,
              options?: OptionalUseQueryOptions<Result>,
            ) => UseQueryResult<Result>
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

    const methodParamsLenPropertyDescriptor = Object.getOwnPropertyDescriptor(
      method,
      "length",
    );

    if (!methodParamsLenPropertyDescriptor)
      throw new Error("Method " + methodName + " is not a function");

    const methodParamLength = Number(methodParamsLenPropertyDescriptor.value);

    const hookName =
      `use${methodName.charAt(0).toUpperCase() + methodName.slice(1)}` as keyof PrefixedMethods;
    hooks[hookName] = function useQ(...args: any[]) {
      const cf = useControllerFactory(classType);
      const preKeys = useQueryKeys();

      const [options, finalArgs] =
        args.length > methodParamLength
          ? [args.pop(), args]
          : args.length === methodParamLength
            ? [{}, args]
            : [{}, args[0]];

      return useQuery({
        queryKey: [...preKeys, classType.name, methodName, finalArgs],
        queryFn: async ({ signal }) => {
          const result = await cf.create({ signal })[methodName](...finalArgs);
          return result;
        },
        ...options,
      });
    } as PrefixedMethods[keyof PrefixedMethods];
  });

  return hooks;
}

export type Manipulator<Args, ResultType, ParamType> = {
  manipulateArgs: (args: Args, pageParam: ParamType) => Args;
  getNextPageParam: (
    args: Args,
    lastPage: ResultType,
    allPages: Array<ResultType>,
    lastPageParam: ParamType,
    allPageParams: Array<ParamType>,
  ) => ParamType | undefined | null;
  initialPageParam: ParamType;
};

export function createClassInfiniteQueryHooks<
  ClassT extends new (...args: any[]) => any,
  Methods extends Partial<{
    [K in keyof InstanceType<ClassT>]: InstanceType<ClassT>[K] extends (
      ...args: any
    ) => Promise<infer ResultType>
      ? Manipulator<Parameters<InstanceType<ClassT>[K]>, ResultType, any>
      : never;
  }>,
>(classType: ClassT, methodMap: Methods) {
  type OptionalUseQueryOptions<T> = Omit<
    UseInfiniteQueryOptions<T>,
    "queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam"
  >;
  type PrefixedMethods = {
    [K in keyof Methods as `use${Capitalize<string & K>}`]: InstanceType<ClassT>[K] extends (
      ...args: infer Args
    ) => Promise<infer Result>
      ? Args extends []
        ? (
            options?: OptionalUseQueryOptions<Result>,
          ) => UseInfiniteQueryResult<InfiniteData<Result>>
        : Args extends [infer FirstArg]
          ? (
              args: FirstArg,
              options?: OptionalUseQueryOptions<Result>,
            ) => UseInfiniteQueryResult<InfiniteData<Result>>
          : (
              args: Args,
              options?: OptionalUseQueryOptions<Result>,
            ) => UseInfiniteQueryResult<InfiniteData<Result>>
      : never;
  };

  const hooks = {} as PrefixedMethods;

  Object.entries(methodMap).forEach(([methodName, manipulators]) => {
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
    hooks[hookName] = function useQ(...args: any[]) {
      const cf = useControllerFactory(classType);
      const preKeys = useQueryKeys();
      const diffArgs = Math.abs(methosData.value - args.length);
      const options = diffArgs > 1 ? [...args].pop() : {};
      const methodArgs = diffArgs == 0 ? args : args[0];
      return useInfiniteQuery({
        queryKey: [...preKeys, classType.name, methodName, methodArgs],
        queryFn: async ({ signal, pageParam }) => {
          const result = await cf
            .create({ signal })
            [methodName](...manipulators.manipulateArgs(methodArgs, pageParam));
          return result;
        },
        getNextPageParam: (...pArgs) =>
          manipulators.getNextPageParam(methodArgs, ...pArgs),
        initialPageParam: manipulators.initialPageParam,
        ...options,
      });
    } as PrefixedMethods[keyof PrefixedMethods];
  });

  return hooks;
}

export interface Paginated<PAGINATED_T> {
  items: Array<PAGINATED_T>;
  total: number;
  unpaginatedTotal: number;
  totalPages: number;
}

export interface PaginatedFilter {
  page?: number;
  pageSize?: number;
}

export function paginationModelManipulator<
  FuncArgs,
  Result extends Paginated<T>,
  T,
  FilterT extends PaginatedFilter,
>(
  getParam: (args: FuncArgs) => FilterT,
  manipulateArgs: (args: FuncArgs, pageParam: number) => FuncArgs,
): Manipulator<FuncArgs, Result, number> {
  return pageNumberManipulator(
    (args) => getParam(args).pageSize || 10,
    (result) => result.total,
    manipulateArgs,
  );
}

export function pageNumberManipulator<FuncArgs, Result>(
  getPageSize: (args: FuncArgs) => number,
  getTotal: (result: Result) => number,
  manipulateArgs: (args: FuncArgs, pageParam: number) => FuncArgs,
): Manipulator<FuncArgs, Result, number> {
  return {
    manipulateArgs(args, pageParam) {
      return manipulateArgs(args, pageParam);
    },
    getNextPageParam: (
      args: FuncArgs,
      lastPage: Result,
      _: Array<Result>,
      lastParam: number,
    ) => (getTotal(lastPage) < getPageSize(args) ? undefined : lastParam + 1),
    initialPageParam: 0,
  };
}

export function useClassQueryKey<
  ClassT extends new (...args: any[]) => any,
  MethodName extends keyof InstanceType<ClassT>,
>(
  classType: ClassT,
  methodName: MethodName,
  ...args: Parameters<InstanceType<ClassT>[MethodName]>
): unknown[] {
  const preKeys = useQueryKeys();
  return [...preKeys, classType.name, methodName, args];
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.getOwnPropertyNames(value).forEach((prop) => {
      const propValue = (value as any)[prop];
      if (
        propValue &&
        typeof propValue === "object" &&
        !Object.isFrozen(propValue)
      ) {
        deepFreeze(propValue);
      }
    });
  }
  return value;
}
