export interface HasCreationTimestamp {
  createdAt: string
}

/** Returns a copy ordered by creation time, newest first. */
export function sortNewestFirst<T extends HasCreationTimestamp>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
