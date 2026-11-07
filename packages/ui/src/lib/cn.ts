import { twMerge } from "tailwind-merge";

/** Concatène des classes Tailwind en résolvant les conflits (la dernière l'emporte : `w-full` puis `w-48` → `w-48`). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(" "));
}
