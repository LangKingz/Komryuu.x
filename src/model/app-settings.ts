export type BroadcastBanner = {
  isActive: boolean;
  title: string;
  message: string;
  type: string;
};

export type AppUpdate = {
  minAppVersion: string;
  latestAppVersion: string;
  forceUpdate: boolean;
  downloadUrl: string;
  changelog: string;
};

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
  broadcastBanner: BroadcastBanner;
  appUpdate: AppUpdate;
};

export const DEFAULT_BROADCAST_BANNER: BroadcastBanner = {
  isActive: false,
  title: "",
  message: "",
  type: "info",
};

export const DEFAULT_APP_UPDATE: AppUpdate = {
  minAppVersion: "1.0.0",
  latestAppVersion: "1.0.0",
  forceUpdate: false,
  downloadUrl: "/aplikasi/Komryuu.apk",
  changelog: "",
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
  broadcastBanner: DEFAULT_BROADCAST_BANNER,
  appUpdate: DEFAULT_APP_UPDATE,
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
    broadcastBanner: {
      isActive:
        typeof value.broadcastBanner === "object" &&
        value.broadcastBanner !== null &&
        "isActive" in value.broadcastBanner
          ? (value.broadcastBanner as Record<string, unknown>).isActive === true
          : false,
      title:
        typeof value.broadcastBanner === "object" &&
        value.broadcastBanner !== null &&
        typeof (value.broadcastBanner as Record<string, unknown>).title === "string"
          ? ((value.broadcastBanner as Record<string, unknown>).title as string)
          : (typeof value.announcement === "string" && value.announcement ? "Pengumuman" : ""),
      message:
        typeof value.broadcastBanner === "object" &&
        value.broadcastBanner !== null &&
        typeof (value.broadcastBanner as Record<string, unknown>).message === "string"
          ? ((value.broadcastBanner as Record<string, unknown>).message as string)
          : (typeof value.announcement === "string" ? value.announcement : ""),
      type:
        typeof value.broadcastBanner === "object" &&
        value.broadcastBanner !== null &&
        typeof (value.broadcastBanner as Record<string, unknown>).type === "string"
          ? ((value.broadcastBanner as Record<string, unknown>).type as string)
          : "info",
    },
    appUpdate: {
      minAppVersion:
        typeof value.appUpdate === "object" &&
        value.appUpdate !== null &&
        typeof (value.appUpdate as Record<string, unknown>).minAppVersion === "string"
          ? ((value.appUpdate as Record<string, unknown>).minAppVersion as string)
          : (typeof value.minimumAppVersion === "string" ? value.minimumAppVersion : DEFAULT_APP_UPDATE.minAppVersion),
      latestAppVersion:
        typeof value.appUpdate === "object" &&
        value.appUpdate !== null &&
        typeof (value.appUpdate as Record<string, unknown>).latestAppVersion === "string"
          ? ((value.appUpdate as Record<string, unknown>).latestAppVersion as string)
          : (typeof value.minimumAppVersion === "string" ? value.minimumAppVersion : DEFAULT_APP_UPDATE.latestAppVersion),
      forceUpdate:
        typeof value.appUpdate === "object" &&
        value.appUpdate !== null &&
        "forceUpdate" in value.appUpdate
          ? (value.appUpdate as Record<string, unknown>).forceUpdate === true
          : false,
      downloadUrl:
        typeof value.appUpdate === "object" &&
        value.appUpdate !== null &&
        typeof (value.appUpdate as Record<string, unknown>).downloadUrl === "string" &&
        (value.appUpdate as Record<string, unknown>).downloadUrl
          ? ((value.appUpdate as Record<string, unknown>).downloadUrl as string)
          : "/aplikasi/Komryuu.apk",
      changelog:
        typeof value.appUpdate === "object" &&
        value.appUpdate !== null &&
        typeof (value.appUpdate as Record<string, unknown>).changelog === "string"
          ? ((value.appUpdate as Record<string, unknown>).changelog as string)
          : "",
    },
  };
}
