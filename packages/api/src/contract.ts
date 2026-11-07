import { z } from "zod";

/**
 * Chaque procédure déclare son entrée et sa sortie avec zod.
 * Le backend valide les deux ; l'interface en déduit les types.
 * Ajouter une fonctionnalité = ajouter une entrée ici + son handler côté backend.
 */

export const SystemInfo = z.object({
  appVersion: z.string(),
  mode: z.enum(["desktop", "web"]),
  databasePath: z.string(),
  schemaVersion: z.string(),
  sqliteVersion: z.string(),
  backupsDir: z.string().nullable(),
});
export type SystemInfo = z.infer<typeof SystemInfo>;

export const SettingKey = z.enum(["ui.privacyMode", "ui.lastRoute"]);
export type SettingKey = z.infer<typeof SettingKey>;

export const procedures = {
  "system.info": { input: z.void(), output: SystemInfo },
  "settings.get": {
    input: z.object({ key: SettingKey }),
    output: z.unknown(),
  },
  "settings.set": {
    input: z.object({ key: SettingKey, value: z.unknown() }),
    output: z.void(),
  },
} as const;

export type Procedures = typeof procedures;
export type ProcName = keyof Procedures;
export type ProcInput<N extends ProcName> = z.input<Procedures[N]["input"]>;
export type ProcOutput<N extends ProcName> = z.output<Procedures[N]["output"]>;
