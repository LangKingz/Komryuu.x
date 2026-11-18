export type extensiType = {
  id: string;
  name: string;
  description?: string;
  logo: string;
  type: "komik" | "anime" | "cinema";
  BaseUrl: string;
  UrlSearch?: string;
  api?: string;
  location?: string;
  status?: "active" | "inactive";
  nsfw?: boolean;
  createdAt: string;
  updatedAt?: string;
};
