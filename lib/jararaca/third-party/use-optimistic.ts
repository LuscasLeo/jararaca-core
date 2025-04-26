import { startTransition, useCallback, useEffect, useState } from "react";

/**
 * A hook for handling optimistic UI updates during asynchronous operations.
 *
 * @param stateObserver - The initial state
 * @returns A tuple containing the current state, a function to update the state optimistically, and a pending flag
 */
export function useOptimistic<State>(
  stateObserver: State,
): [State, (updater: (state: State) => State | State) => void] {
  const [state, setState] = useState<State>(stateObserver);

  const updateState = useCallback(
    (updater: (state: State) => State | State) => {
      setState((prevState) => {
        const newState = updater(prevState);
        return newState instanceof Function ? newState(prevState) : newState;
      });
    },
    [],
  );

  useEffect(() => {
    startTransition(() => setState(stateObserver));
  }, [stateObserver]);

  return [state, updateState];
}
