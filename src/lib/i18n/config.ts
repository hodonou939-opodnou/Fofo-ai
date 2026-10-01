export const locales = ["fr", "fon"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";
