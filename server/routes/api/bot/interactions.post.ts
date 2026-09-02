import { defineHandler } from "nitro";
import { createError, getRequestHeaders, readRawBody } from "nitro/h3";
import { editInteractionResponse, verifyDiscordRequest } from "../../../utils/discord";
import { createSeerrRequest, searchSeerr } from "../../../utils/seerr";
import { readStore, writeStore, type ReelRelayConfig } from "../../../utils/store";

const response = (data: Record<string, unknown>, type = 4) => ({ type, data });

async function completeRequest(
  config: ReelRelayConfig,
  interaction: any,
  rawValue: string,
  mediaType?: "movie" | "tv",
) {
  try {
    const encoded = rawValue.match(/^(movie|tv):(\d+):(.+)$/);
    let picked: { id: number; mediaType: "movie" | "tv"; title: string } | undefined;
    if (encoded) {
      picked = { mediaType: encoded[1] as "movie" | "tv", id: Number(encoded[2]), title: encoded[3] };
    } else {
      picked = (await searchSeerr(config, rawValue, mediaType))[0];
    }

    if (!picked) {
      await editInteractionResponse(
        config.discordApplicationId,
        interaction.token,
        `I couldn't find **${rawValue}**. Try a more specific title.`,
      );
      return;
    }

    const created = await createSeerrRequest(config, picked.id, picked.mediaType);
    const store = await readStore();
    store.requests.push({
      id: crypto.randomUUID(),
      seerrRequestId: created.id,
      mediaId: picked.id,
      mediaType: picked.mediaType,
      title: picked.title,
      userId: interaction.member?.user?.id ?? interaction.user?.id,
      channelId: interaction.channel_id,
      createdAt: new Date().toISOString(),
      status: "pending",
    });
    await writeStore(store);
    await editInteractionResponse(
      config.discordApplicationId,
      interaction.token,
      `🍿 **${picked.title}** has been requested! I'll ping you here when it's ready.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    try {
      await editInteractionResponse(
        config.discordApplicationId,
        interaction.token,
        `I couldn't place that request: ${message}`,
      );
    } catch (replyError) {
      console.error("ReelRelay could not complete the Discord interaction", replyError);
    }
  }
}

export default defineHandler(async (event) => {
  const store = await readStore();
  if (!store.config) throw createError({ statusCode: 503, statusMessage: "ReelRelay is not configured." });

  const headers = getRequestHeaders(event);
  const raw = await readRawBody(event) ?? "";
  if (!verifyDiscordRequest(
    store.config.discordPublicKey,
    headers["x-signature-ed25519"] ?? "",
    headers["x-signature-timestamp"] ?? "",
    raw,
  )) throw createError({ statusCode: 401, statusMessage: "Invalid Discord signature." });

  const interaction = JSON.parse(raw);
  if (interaction.type === 1) return { type: 1 };

  const options = interaction.data?.options ?? [];
  const titleOption = options.find((item: any) => item.name === "title");
  const typeOption = options.find((item: any) => item.name === "type");
  const mediaType = typeOption?.value as "movie" | "tv" | undefined;

  if (interaction.type === 4) {
    const query = String(titleOption?.value ?? "").trim();
    if (query.length < 2) return response({ choices: [] }, 8);
    try {
      const results = await searchSeerr(store.config, query, mediaType);
      return response({ choices: results.map((item) => ({
        name: `${item.title}${item.year ? ` (${item.year})` : ""} · ${item.mediaType === "movie" ? "Movie" : "TV"}`.slice(0, 100),
        value: `${item.mediaType}:${item.id}:${item.title}`.slice(0, 100),
      })) }, 8);
    } catch {
      return response({ choices: [] }, 8);
    }
  }

  if (interaction.type !== 2 || interaction.data?.name !== "request") {
    return response({ content: "That command is not supported.", flags: 64 });
  }

  const rawValue = String(titleOption?.value ?? "");
  void completeRequest(store.config, interaction, rawValue, mediaType);

  return response({ flags: 64 }, 5);
});
