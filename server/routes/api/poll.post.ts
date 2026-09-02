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

  try {
    const result = await pollFulfilledRequests();
    const updates = [
      result.synced ? `synced ${result.synced} request${result.synced === 1 ? "" : "s"}` : "",
      result.notified ? `sent ${result.notified} notification${result.notified === 1 ? "" : "s"}` : "",
      result.notificationFailed ? `${result.notificationFailed} Discord notification${result.notificationFailed === 1 ? "" : "s"} failed` : "",
    ].filter(Boolean);
    const failureDetail = result.notificationErrors[0];
    return {
      ok: true,
      ...result,
      message: failureDetail
        ? `${updates.join("; ")}. ${failureDetail}`
        : updates.length
          ? `${updates.join("; ")}.`
          : `Checked ${result.checked} Seerr request${result.checked === 1 ? "" : "s"}; everything is up to date.`,
    };
  } catch (error) {
    console.error("ReelRelay status check failed", error);
    throw createError({
      statusCode: 502,
      statusMessage: error instanceof Error ? error.message : "Could not synchronize with Seerr.",
    });
  }
});
