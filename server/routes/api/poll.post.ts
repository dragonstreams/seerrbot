import { defineHandler } from "nitro";
import { createError, getRequestHeaders } from "nitro/h3";
import { pollFulfilledRequests } from "../../utils/poller";
import { readStore } from "../../utils/store";

export default defineHandler(async (event) => {
  const store = await readStore();
  if (!store.config) throw createError({ statusCode: 400, statusMessage: "Save setup first." });
  const secret = getRequestHeaders(event)["x-admin-secret"];
  const auth = getRequestHeaders(event).authorization?.replace(/^Bearer\s+/i, "");
  if (secret !== store.config.adminSecret && auth !== store.config.adminSecret) {
    throw createError({ statusCode: 401, statusMessage: "Dashboard secret is incorrect." });
  }

  const result = await pollFulfilledRequests();
  return {
    ok: true,
    ...result,
    message: result.notified
      ? `Sent ${result.notified} notification${result.notified === 1 ? "" : "s"}.`
      : "Everything is up to date.",
  };
});
