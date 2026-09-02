import { randomUUID } from "node:crypto";
import { notifyAvailable } from "./discord";
import { getSeerrMediaTitle, getSeerrRequests } from "./seerr";
import { readStore, writeStore, type TrackedRequest } from "./store";

function isAvailable(request: Record<string, any>) {
  const status = request.media?.status;
  return Number(status) === 5 || String(status).toLowerCase() === "available";
}

async function importRequest(
  config: NonNullable<Awaited<ReturnType<typeof readStore>>["config"]>,
  request: Record<string, any>,
): Promise<TrackedRequest | null> {
  const media = request.media ?? {};
  const mediaType = (media.mediaType ?? request.mediaType) as "movie" | "tv";
  if (mediaType !== "movie" && mediaType !== "tv") return null;

  const mediaId = Number(media.tmdbId ?? request.mediaId ?? 0);
  let title = String(media.title ?? media.name ?? request.title ?? "").trim();
  if (!title && mediaId) {
    try {
      title = await getSeerrMediaTitle(config, mediaType, mediaId) ?? "";
    } catch {
      // Keep syncing even when a media detail lookup is unavailable.
    }
  }

  return {
    id: randomUUID(),
    seerrRequestId: Number(request.id),
    mediaId,
    mediaType,
    title: title || `${mediaType === "movie" ? "Movie" : "TV series"} #${mediaId || request.id}`,
    userId: "",
    channelId: "",
    createdAt: String(request.createdAt ?? new Date().toISOString()),
    status: isAvailable(request) ? "available" : "pending",
  };
}

export async function pollFulfilledRequests() {
  const store = await readStore();
  if (!store.config) return { checked: 0, synced: 0, notified: 0, notificationFailed: 0 };

  const remote = await getSeerrRequests(store.config);
  const remoteRequests = remote.results ?? [];
  let synced = 0;
  let notified = 0;
  let notificationFailed = 0;
  let changed = false;

  const knownIds = new Set(store.requests.map((request) => request.seerrRequestId));
  const newRequests = remoteRequests
    .filter((request) => !knownIds.has(Number(request.id)))
    .slice(0, 20);
  const imported = await Promise.all(newRequests.map((request) => importRequest(store.config!, request)));
  for (const request of imported) {
    if (!request) continue;
    store.requests.push(request);
    synced += 1;
    changed = true;
  }

  for (const item of store.requests.filter((request) => request.status === "pending")) {
    const match = remoteRequests.find((request) => Number(request.id) === item.seerrRequestId);
    if (!match || !isAvailable(match)) continue;
    if (item.channelId && item.userId) {
      try {
        await notifyAvailable(store.config, item.channelId, item.userId, item.title);
        notified += 1;
      } catch (error) {
        notificationFailed += 1;
        console.error(`ReelRelay could not notify Discord for request ${item.seerrRequestId}`, error);
      }
    }
    item.status = "available";
    changed = true;
  }

  if (changed) await writeStore(store);
  return { checked: remoteRequests.length, synced, notified, notificationFailed };
}
