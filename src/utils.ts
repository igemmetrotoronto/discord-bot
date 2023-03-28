import prodConfig from "../config.prod.json" assert { type: "json" };
import devConfig from "../config.dev.json" assert { type: "json" };

export const environment =
  process.env.NODE_ENV === "production" ? "production" : "development";

export const config = environment === "development" ? devConfig : prodConfig;
