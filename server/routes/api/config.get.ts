import { defineHandler } from "nitro";
import { readStore, safeConfig } from "../../utils/store";

export default defineHandler(async () => {
  const store = await readStore();
  return {
    config: safeConfig(store.config),
    requests: store.requests.slice(-8).reverse(),
    counts: {
      total: store.requests.length,
      pending: store.requests.filter((item) => item.status === "pending").length,
      available: store.requests.filter((item) => item.status === "available").length,
    },
  };
});
