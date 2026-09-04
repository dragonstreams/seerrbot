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

export async function verifyDiscordGuild(config: ReelRelayConfig) {
  if (!config.discordGuildId) return;
  try {
    await discordFetch(config, `/guilds/${config.discordGuildId}`);
  } catch {
    throw new Error("The bot is not installed in that Discord server. Use Invite bot, authorize it, then publish the command again.");
  }
}

export async function registerCommands(config: ReelRelayConfig) {
  await verifyDiscordGuild(config);
  const path = config.discordGuildId
    ? `/applications/${config.discordApplicationId}/guilds/${config.discordGuildId}/commands`
    : `/applications/${config.discordApplicationId}/commands`;
  return discordFetch(config, path, {
    method: "PUT",
    body: JSON.stringify([{
      name: "seerr",
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

export async function editInteractionResponse(
  applicationId: string,
  interactionToken: string,
  content: string,
  posterUrl?: string,
  components: Array<Record<string, unknown>> = [],
) {
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: [] },
        embeds: posterUrl ? [{ image: { url: posterUrl } }] : [],
        components,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Discord could not update the command response (${response.status}).`);
  }
}

export async function notifyAvailable(config: ReelRelayConfig, channelId: string, userId: string, title: string) {
  try {
    await discordFetch(config, `/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: `🎬 <@${userId}> **${title}** is now available. Snacks ready?`,
        allowed_mentions: { users: [userId] },
      }),
    });
    return { delivery: "channel" as const };
  } catch (channelError) {
    try {
      const directMessage = await discordFetch<{ id: string }>(config, "/users/@me/channels", {
        method: "POST",
        body: JSON.stringify({ recipient_id: userId }),
      });
      await discordFetch(config, `/channels/${directMessage.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: `🎬 **${title}** is now available. Snacks ready?`,
          allowed_mentions: { parse: [] },
        }),
      });
      return { delivery: "dm" as const };
    } catch (directMessageError) {
      const channelReason = channelError instanceof Error ? channelError.message : "channel delivery failed";
      const directReason = directMessageError instanceof Error ? directMessageError.message : "DM delivery failed";
      throw new Error(`${channelReason}; DM fallback: ${directReason}`);
    }
  }
}
