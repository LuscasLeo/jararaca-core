type Identifiable<T> = {
  id: string;
  data: T;
};

export type UnifiedIdentifiable<T> = T & { id: Identifiable<T>["id"] };

export function unifyIdentifiable<T>(
  obj: Identifiable<T>,
): UnifiedIdentifiable<T> {
  return {
    ...obj,
    ...obj.data,
  };
}
