import { defineHandler } from "nitro";
import { createError, getRequestHeaders, readBody } from "nitro/h3";
import { readStore, safeConfig, writeStore, type ReelRelayConfig } from "../../utils/store";

export default defineHandler(async (event) => {
  const body = await readBody<Partial<ReelRelayConfig>>(event);
  const store = await readStore();
  const suppliedSecret = getRequestHeaders(event)["x-admin-secret"];

  if (store.config?.adminSecret && suppliedSecret !== store.config.adminSecret) {
    throw createError({ statusCode: 401, statusMessage: "Dashboard secret is incorrect." });
  }

  const next: ReelRelayConfig = {
    seerrUrl: body.seerrUrl?.trim() || store.config?.seerrUrl || "https://requests.nimrod.to",
    seerrUsername: body.seerrUsername?.trim() || store.config?.seerrUsername || "",
    seerrPassword: body.seerrPassword || store.config?.seerrPassword || "",
    discordApplicationId: body.discordApplicationId?.trim() || store.config?.discordApplicationId || "",
    discordPublicKey: body.discordPublicKey?.trim() || store.config?.discordPublicKey || "",
    discordBotToken: body.discordBotToken || store.config?.discordBotToken || "",
    discordGuildId: body.discordGuildId?.trim() || store.config?.discordGuildId || "",
    adminSecret: body.adminSecret || store.config?.adminSecret || "",
  };

  if (!next.adminSecret || next.adminSecret.length < 8) {
    throw createError({ statusCode: 400, statusMessage: "Use a dashboard secret with at least 8 characters." });
  }
  if (!/^https:\/\//.test(next.seerrUrl)) {
    throw createError({ statusCode: 400, statusMessage: "Seerr URL must use HTTPS." });
  }

  await writeStore({ ...store, config: next });
  return { config: safeConfig(next) };
});
