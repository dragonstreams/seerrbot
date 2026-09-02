import { createPublicKey, verify } from "node:crypto";
import type { ReelRelayConfig } from "./store";

export function verifyDiscordRequest(publicKey: string, signature: string, timestamp: string, body: string) {
  try {
    const der = Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(publicKey, "hex"),
    ]);
    const key = createPublicKey({ key: der, format: "der", type: "spki" });
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

async function discordFetch<T>(config: ReelRelayConfig, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      authorization: `Bot ${config.discordBotToken}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(`Discord returned ${response.status}: ${(await response.text()).slice(0, 160)}`);
  return (response.status === 204 ? {} : await response.json()) as T;
}

export async function registerCommands(config: ReelRelayConfig) {
  const path = config.discordGuildId
    ? `/applications/${config.discordApplicationId}/guilds/${config.discordGuildId}/commands`
    : `/applications/${config.discordApplicationId}/commands`;
  return discordFetch(config, path, {
    method: "PUT",
    body: JSON.stringify([{
      name: "request",
      description: "Request a movie or TV series from Seerr",
      options: [
        { name: "title", description: "Start typing a title", type: 3, required: true, autocomplete: true },
        { name: "type", description: "Movie or TV series", type: 3, required: true, choices: [
          { name: "Movie", value: "movie" },
          { name: "TV series", value: "tv" },
        ] },
      ],
    }]),
  });
}

export async function notifyAvailable(config: ReelRelayConfig, channelId: string, userId: string, title: string) {
  return discordFetch(config, `/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: `🎬 <@${userId}> **${title}** is now available. Snacks ready?`,
      allowed_mentions: { users: [userId] },
    }),
  });
}
