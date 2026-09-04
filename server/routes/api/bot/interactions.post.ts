import { defineHandler } from "nitro";
import { createError, getRequestHeaders, readRawBody } from "nitro/h3";
import { editInteractionResponse, verifyDiscordRequest } from "../../../utils/discord";
import { createSeerrRequest, getSeerrMediaDetails, searchSeerr } from "../../../utils/seerr";
import { readStore, writeStore, type ReelRelayConfig } from "../../../utils/store";

const response = (data: Record<string, unknown>, type = 4) => ({ type, data });

function posterUrl(path?: string) {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : undefined;
}

function isAlreadyAvailable(status?: number | string) {
  return Number(status) === 5 || String(status).toLowerCase() === "available";
}

async function prepareRequest(
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

    const details = await getSeerrMediaDetails(config, picked.mediaType, picked.id).catch(() => null);
    const title = details?.title ?? details?.name ?? picked.title;
    if (isAlreadyAvailable(details?.mediaInfo?.status)) {
      await editInteractionResponse(
        config.discordApplicationId,
        interaction.token,
        "This Item is already available",
        posterUrl(details?.posterPath),
      );
      return;
    }
    await editInteractionResponse(
      config.discordApplicationId,
      interaction.token,
      `Request **${title}**? Nothing will be sent to Seerr until you confirm.`,
      posterUrl(details?.posterPath),
      [{
        type: 1,
        components: [{
          type: 2,
          style: 3,
          label: "Confirm request",
          custom_id: `reelrelay_confirm:${picked.mediaType}:${picked.id}`,
        }],
      }],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await editInteractionResponse(
      config.discordApplicationId,
      interaction.token,
      `I couldn't prepare that request: ${message}`,
    );
  }
}

async function submitConfirmedRequest(
  config: ReelRelayConfig,
  interaction: any,
  mediaType: "movie" | "tv",
  mediaId: number,
) {
  try {
    const details = await getSeerrMediaDetails(config, mediaType, mediaId);
    if (isAlreadyAvailable(details.mediaInfo?.status)) {
      await editInteractionResponse(
        config.discordApplicationId,
        interaction.token,
        "This Item is already available",
        posterUrl(details.posterPath),
      );
      return;
    }
    const created = await createSeerrRequest(config, mediaId, mediaType);
    const title = details.title ?? details.name ?? `${mediaType === "movie" ? "Movie" : "TV series"} #${mediaId}`;
    const store = await readStore();
    store.requests.push({
      id: crypto.randomUUID(),
      seerrRequestId: created.id,
      mediaId,
      mediaType,
      title,
      userId: interaction.member?.user?.id ?? interaction.user?.id,
      channelId: interaction.channel_id,
      createdAt: new Date().toISOString(),
      status: "pending",
      notificationStatus: "pending",
      notificationAttempts: 0,
    });
    await writeStore(store);
    await editInteractionResponse(
      config.discordApplicationId,
      interaction.token,
      `🍿 **${title}** has been requested! I'll ping you here when it's ready.`,
      posterUrl(details.posterPath),
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

  if (interaction.type === 3) {
    const confirmation = String(interaction.data?.custom_id ?? "").match(/^reelrelay_confirm:(movie|tv):(\d+)$/);
    if (!confirmation) return response({ content: "That action is no longer available.", flags: 64 });
    void submitConfirmedRequest(
      store.config,
      interaction,
      confirmation[1] as "movie" | "tv",
      Number(confirmation[2]),
    );
    return response({ content: "Submitting request…", components: [] }, 7);
  }

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

  if (interaction.type !== 2 || interaction.data?.name !== "seerr") {
    return response({ content: "That command is not supported.", flags: 64 });
  }

  const rawValue = String(titleOption?.value ?? "");
  void prepareRequest(store.config, interaction, rawValue, mediaType);
  return response({ flags: 64 }, 5);
});
