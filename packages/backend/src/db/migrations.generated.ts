// Fichier généré par scripts/embed-migrations.mjs — ne pas modifier à la main.
export const migrations: ReadonlyArray<{ tag: string; sql: string }> = [
  {
    "tag": "0000_absent_rumiko_fujikawa",
    "sql": "CREATE TABLE `settings` (\n\t`key` text PRIMARY KEY NOT NULL,\n\t`value` text NOT NULL,\n\t`updated_at` text NOT NULL\n);\n"
  }
];
