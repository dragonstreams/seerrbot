import { defineHandler } from "nitro";
import { createError, getRequestHeaders, readBody } from "nitro/h3";
import { verifyDiscordGuild } from "../../utils/discord";
import { testSeerr } from "../../utils/seerr";
import { readStore } from "../../utils/store";

export default defineHandler(async (event) => {
  const { target } = await readBody<{ target: "seerr" | "discord" }>(event);
  const store = await readStore();
  if (!store.config) throw createError({ statusCode: 400, statusMessage: "Save setup first." });
  if (getRequestHeaders(event)["x-admin-secret"] !== store.config.adminSecret) {
    throw createError({ statusCode: 401, statusMessage: "Dashboard secret is incorrect." });
  }

  if (target === "seerr") {
    const user = await testSeerr(store.config);
    return { ok: true, message: `Connected${user.displayName ? ` as ${user.displayName}` : " to Seerr"}.` };
  }

  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { authorization: `Bot ${store.config.discordBotToken}` },
  });
  if (!response.ok) throw createError({ statusCode: 400, statusMessage: "Discord rejected the bot token." });
  const bot = await response.json() as { username: string };
  try {
    await verifyDiscordGuild(store.config);
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : "The bot is not installed in the configured server.",
    });
  }
  return { ok: true, message: `Connected as ${bot.username}${store.config.discordGuildId ? " and found the server" : ""}.` };
});
