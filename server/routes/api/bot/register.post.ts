import { defineHandler } from "nitro";
import { createError, getRequestHeaders } from "nitro/h3";
import { registerCommands } from "../../../utils/discord";
import { readStore } from "../../../utils/store";

export default defineHandler(async (event) => {
  const store = await readStore();
  if (!store.config) throw createError({ statusCode: 400, statusMessage: "Save setup first." });
  if (getRequestHeaders(event)["x-admin-secret"] !== store.config.adminSecret) {
    throw createError({ statusCode: 401, statusMessage: "Dashboard secret is incorrect." });
  }
  if (!store.config.discordApplicationId || !store.config.discordBotToken) {
    throw createError({ statusCode: 400, statusMessage: "Discord application ID and bot token are required." });
  }
  await registerCommands(store.config);
  return { ok: true, message: `The /request command is live${store.config.discordGuildId ? " in your server" : " globally"}.` };
});
