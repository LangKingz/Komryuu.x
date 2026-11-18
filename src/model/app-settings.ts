export type AppSettings = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcement: string;
  externalApiKeyHash: string;
  rateLimitPerMinute: number;
  extensionCacheTtlSeconds: number;
  allowRegistration: boolean;
  showNsfw: boolean;
  defaultCategory: "komik" | "anime" | "cinema";
  minimumAppVersion: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  maintenanceMode: false,
  maintenanceMessage: "Aplikasi sedang dalam pemeliharaan. Silakan coba kembali nanti.",
  announcement: "",
  externalApiKeyHash: "",
  rateLimitPerMinute: 60,
  extensionCacheTtlSeconds: 30,
  allowRegistration: true,
  showNsfw: false,
  defaultCategory: "komik",
  minimumAppVersion: "1.0.0",
};

export function normalizeAppSettings(value: Record<string, unknown>): AppSettings {
  const defaultCategory =
    value.defaultCategory === "anime" || value.defaultCategory === "cinema"
      ? value.defaultCategory
      : "komik";

  return {
    maintenanceMode: value.maintenanceMode === true,
    maintenanceMessage:
      typeof value.maintenanceMessage === "string"
        ? value.maintenanceMessage
        : DEFAULT_APP_SETTINGS.maintenanceMessage,
    announcement: typeof value.announcement === "string" ? value.announcement : "",
    externalApiKeyHash:
      typeof value.externalApiKeyHash === "string" ? value.externalApiKeyHash : "",
    rateLimitPerMinute:
      typeof value.rateLimitPerMinute === "number" &&
      Number.isInteger(value.rateLimitPerMinute) &&
      value.rateLimitPerMinute >= 1 &&
      value.rateLimitPerMinute <= 10000
        ? value.rateLimitPerMinute
        : DEFAULT_APP_SETTINGS.rateLimitPerMinute,
    extensionCacheTtlSeconds:
      typeof value.extensionCacheTtlSeconds === "number" &&
      Number.isInteger(value.extensionCacheTtlSeconds) &&
      value.extensionCacheTtlSeconds >= 0 &&
      value.extensionCacheTtlSeconds <= 3600
        ? value.extensionCacheTtlSeconds
        : DEFAULT_APP_SETTINGS.extensionCacheTtlSeconds,
    allowRegistration: value.allowRegistration !== false,
    showNsfw: value.showNsfw === true,
    defaultCategory,
    minimumAppVersion:
      typeof value.minimumAppVersion === "string"
        ? value.minimumAppVersion
        : DEFAULT_APP_SETTINGS.minimumAppVersion,
  };
}
