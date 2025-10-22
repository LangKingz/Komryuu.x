export type extensiType = {
  id: string;
  name: string;
  description?: string;
  logo: string;
  type: "komik" | "anime" | "cinema";
  BaseUrl: string;
  UrlSearch?: string;
  location?: string;
  createdAt: string;
};
