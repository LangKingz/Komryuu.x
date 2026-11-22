export type CustomHeaders = {
  referer?: string;
  userAgent?: string;
  cookie?: string;
};

export type extensiType = {
  id: string;
  name: string;
  description?: string;
  logo: string;
  type: "komik" | "anime" | "cinema";
  BaseUrl: string;
  baseUrl?: string;
  mirrorUrls?: string[];
  UrlSearch?: string;
  api?: string;
  location?: string;
  status?: "active" | "inactive";
  isActive?: boolean;
  isVipOnly?: boolean;
  customHeaders?: CustomHeaders;
  nsfw?: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type Extensi = extensiType;
