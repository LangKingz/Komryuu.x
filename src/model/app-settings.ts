export type AnnouncementType = "info" | "warning" | "update";

export type Announcement = {
  active: boolean;
  title: string;
  message: string;
  type: AnnouncementType;
};

export type BroadcastBanner = {
  isActive: boolean;
  title: string;
  message: string;
  type: string;
};

export type AppUpdate = {
  minAppVersion: string;
  latestAppVersion: string;
  latestVersion?: string;
  minVersionCode: number;
  forceUpdate: boolean;
  downloadUrl: string;
  apkUrl?: string;
  changelog: string;
};

export type AppReleaseChannel = "stable" | "beta";

export type AppReleaseItem = {
  id: string;
  versionName: string;
  versionCode: number;
  apkUrl: string;
  fileSize: string;
  channel: AppReleaseChannel;
  forceUpdate: boolean;
  changelog: string;
  releasedAt: string;
};

export type FeatureState = "enabled" | "admin_only" | "coming_soon";

export const DEFAULT_FEATURE_FLAGS: Record<string, FeatureState> = {
  cinemaMode: "admin_only",
  dohProxy: "enabled",
  floatingReadBall: "enabled",
  cloudSync: "enabled",
};

export type AppSettings = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  latestVersion?: string;
  minVersionCode?: number;
  forceUpdate?: boolean;
  changelog?: string;
  apkUrl?: string;
  announcement: string;
  appAnnouncement?: Announcement;
  externalApiKeyHash: string;
  rateLimitPerMinute: number;
  extensionCacheTtlSeconds: number;
  allowRegistration: boolean;
  showNsfw: boolean;
  defaultCategory: "komik" | "anime" | "cinema";
  minimumAppVersion: string;
  broadcastBanner: BroadcastBanner;
  appUpdate: AppUpdate;
  releases?: AppReleaseItem[];
  activeReleaseId?: string;
  featureFlags: Record<string, FeatureState>;
};

export const DEFAULT_BROADCAST_BANNER: BroadcastBanner = {
  isActive: false,
  title: "",
  message: "",
  type: "info",
};

export const DEFAULT_ANNOUNCEMENT: Announcement = {
  active: false,
  title: "",
  message: "",
  type: "info",
};

export const DEFAULT_APP_UPDATE: AppUpdate = {
  minAppVersion: "1.0.0",
  latestAppVersion: "1.2.0",
  latestVersion: "1.2.0",
  minVersionCode: 1,
  forceUpdate: false,
  downloadUrl: "/aplikasi/Komryuu.apk",
  apkUrl: "/aplikasi/Komryuu.apk",
  changelog: "",
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  maintenanceMode: false,
  maintenanceMessage: "Aplikasi sedang dalam pemeliharaan. Silakan coba kembali nanti.",
  latestVersion: "1.2.0",
  minVersionCode: 1,
  forceUpdate: false,
  changelog: "",
  apkUrl: "/aplikasi/Komryuu.apk",
  announcement: "",
  appAnnouncement: DEFAULT_ANNOUNCEMENT,
  externalApiKeyHash: "",
  rateLimitPerMinute: 60,
  extensionCacheTtlSeconds: 30,
  allowRegistration: true,
  showNsfw: false,
  defaultCategory: "komik",
  minimumAppVersion: "1.0.0",
  broadcastBanner: DEFAULT_BROADCAST_BANNER,
  appUpdate: DEFAULT_APP_UPDATE,
  releases: [],
  activeReleaseId: "",
  featureFlags: { ...DEFAULT_FEATURE_FLAGS },
};

export function normalizeAppSettings(value: Record<string, unknown>): AppSettings {
  const defaultCategory =
    value.defaultCategory === "anime" || value.defaultCategory === "cinema"
      ? value.defaultCategory
      : "komik";

  const rawUpdate = (typeof value.appUpdate === "object" && value.appUpdate !== null)
    ? (value.appUpdate as Record<string, unknown>)
    : {};

  const latestVersion =
    typeof rawUpdate.latestVersion === "string" && rawUpdate.latestVersion
      ? rawUpdate.latestVersion
      : typeof rawUpdate.latestAppVersion === "string" && rawUpdate.latestAppVersion
        ? rawUpdate.latestAppVersion
        : typeof value.latestVersion === "string" && value.latestVersion
          ? value.latestVersion
          : DEFAULT_APP_UPDATE.latestAppVersion;

  const minVersionCode =
    typeof rawUpdate.minVersionCode === "number" && !isNaN(rawUpdate.minVersionCode)
      ? rawUpdate.minVersionCode
      : typeof value.minVersionCode === "number" && !isNaN(value.minVersionCode)
        ? value.minVersionCode
        : DEFAULT_APP_UPDATE.minVersionCode;

  const forceUpdate =
    rawUpdate.forceUpdate === true || value.forceUpdate === true;

  const apkUrl =
    typeof rawUpdate.apkUrl === "string" && rawUpdate.apkUrl
      ? rawUpdate.apkUrl
      : typeof rawUpdate.downloadUrl === "string" && rawUpdate.downloadUrl
        ? rawUpdate.downloadUrl
        : typeof value.apkUrl === "string" && value.apkUrl
          ? value.apkUrl
          : DEFAULT_APP_UPDATE.downloadUrl;

  const changelog =
    typeof rawUpdate.changelog === "string"
      ? rawUpdate.changelog
      : typeof value.changelog === "string"
        ? value.changelog
        : "";

  const minAppVersion =
    typeof rawUpdate.minAppVersion === "string"
      ? rawUpdate.minAppVersion
      : typeof value.minimumAppVersion === "string"
        ? value.minimumAppVersion
        : DEFAULT_APP_UPDATE.minAppVersion;

  const rawBanner = (typeof value.broadcastBanner === "object" && value.broadcastBanner !== null)
    ? (value.broadcastBanner as Record<string, unknown>)
    : {};
  const rawAnnouncement = (typeof value.announcement === "object" && value.announcement !== null)
    ? (value.announcement as Record<string, unknown>)
    : {};

  const bannerActive =
    rawBanner.isActive === true || rawBanner.active === true || rawAnnouncement.active === true;

  const bannerTitle =
    typeof rawBanner.title === "string" ? rawBanner.title :
      typeof rawAnnouncement.title === "string" ? rawAnnouncement.title :
        "";

  const bannerMessage =
    typeof rawBanner.message === "string" ? rawBanner.message :
      typeof rawAnnouncement.message === "string" ? rawAnnouncement.message :
        typeof value.announcement === "string" ? value.announcement :
          "";

  const rawType = String(rawBanner.type || rawAnnouncement.type || "info").toLowerCase();
  const bannerType: "info" | "warning" | "update" =
    rawType === "warning" || rawType === "urgent" ? "warning" :
      rawType === "update" ? "update" : "info";

  // Parse releases array
  const rawReleases = Array.isArray(value.releases) ? value.releases : [];
  const releases: AppReleaseItem[] = rawReleases
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
    .map((r) => ({
      id: typeof r.id === "string" && r.id ? r.id : crypto.randomUUID?.() || String(Date.now()),
      versionName: typeof r.versionName === "string" ? r.versionName : "1.0.0",
      versionCode: typeof r.versionCode === "number" && !isNaN(r.versionCode) ? r.versionCode : 1,
      apkUrl: typeof r.apkUrl === "string" && r.apkUrl ? r.apkUrl : "/aplikasi/Komryuu.apk",
      fileSize: typeof r.fileSize === "string" ? r.fileSize : "",
      channel: (r.channel === "beta" ? "beta" : "stable") as AppReleaseChannel,
      forceUpdate: r.forceUpdate === true,
      changelog: typeof r.changelog === "string" ? r.changelog : "",
      releasedAt: typeof r.releasedAt === "string" ? r.releasedAt : new Date().toISOString(),
    }))
    .filter((r) => r.versionName && r.apkUrl);

  const activeReleaseId = typeof value.activeReleaseId === "string" ? value.activeReleaseId : "";

  const featureFlags: Record<string, FeatureState> = { ...DEFAULT_FEATURE_FLAGS };
  if (typeof value.featureFlags === "object" && value.featureFlags !== null && !Array.isArray(value.featureFlags)) {
    for (const [k, v] of Object.entries(value.featureFlags as Record<string, unknown>)) {
      if (v === "enabled" || v === "admin_only" || v === "coming_soon") {
        featureFlags[k] = v;
      }
    }
  }

  return {
    maintenanceMode: value.maintenanceMode === true,
    maintenanceMessage:
      typeof value.maintenanceMessage === "string"
        ? value.maintenanceMessage
        : DEFAULT_APP_SETTINGS.maintenanceMessage,
    latestVersion,
    minVersionCode,
    forceUpdate,
    changelog,
    apkUrl,
    announcement: bannerMessage,
    appAnnouncement: {
      active: bannerActive,
      title: bannerTitle,
      message: bannerMessage,
      type: bannerType,
    },
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
    minimumAppVersion: minAppVersion,
    broadcastBanner: {
      isActive: bannerActive,
      title: bannerTitle,
      message: bannerMessage,
      type: bannerType,
    },
    appUpdate: {
      minAppVersion,
      latestAppVersion: latestVersion,
      latestVersion,
      minVersionCode,
      forceUpdate,
      downloadUrl: apkUrl,
      apkUrl,
      changelog,
    },
    releases,
    activeReleaseId,
    featureFlags,
  };
}
