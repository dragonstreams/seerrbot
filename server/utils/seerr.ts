import type { ReelRelayConfig } from "./store";

export type SeerrSearchResult = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  year?: string;
};

function baseUrl(config: ReelRelayConfig) {
  return config.seerrUrl.replace(/\/$/, "");
}

let cachedSession: { key: string; cookie: string; expiresAt: number } | undefined;

async function seerrSession(config: ReelRelayConfig, refresh = false) {
  const sessionKey = `${baseUrl(config)}:${config.seerrUsername}`;
  if (!refresh && cachedSession?.key === sessionKey && cachedSession.expiresAt > Date.now()) {
    return cachedSession.cookie;
  }

  const response = await fetch(`${baseUrl(config)}/api/v1/auth/local`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: config.seerrUsername, password: config.seerrPassword }),
    redirect: "manual",
  });

  if (!response.ok) throw new Error("Seerr rejected the username or password.");
  const cookies = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
    ?? [response.headers.get("set-cookie") ?? ""];
  const cookie = cookies.map((item) => item.split(";")[0]).filter(Boolean).join("; ");
  if (!cookie) throw new Error("Seerr did not create a login session.");
  cachedSession = { key: sessionKey, cookie, expiresAt: Date.now() + 10 * 60 * 1000 };
  return cookie;
}

async function seerrFetch<T>(config: ReelRelayConfig, path: string, init?: RequestInit, retry = true): Promise<T> {
  const cookie = await seerrSession(config);
  const response = await fetch(`${baseUrl(config)}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      cookie,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 401 && retry) {
    await seerrSession(config, true);
    return seerrFetch<T>(config, path, init, false);
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Seerr returned ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
  return response.json() as Promise<T>;
}

export async function testSeerr(config: ReelRelayConfig) {
  return seerrFetch<{ displayName?: string; email?: string }>(config, "/api/v1/auth/me");
}

export async function searchSeerr(config: ReelRelayConfig, query: string, type?: "movie" | "tv") {
  const data = await seerrFetch<{ results?: Array<Record<string, any>> }>(
    config,
    `/api/v1/search?query=${encodeURIComponent(query)}&page=1&language=en`,
  );
  return (data.results ?? [])
    .filter((item) => (item.mediaType === "movie" || item.mediaType === "tv") && (!type || item.mediaType === type))
    .slice(0, 10)
    .map((item): SeerrSearchResult => ({
      id: Number(item.id),
      mediaType: item.mediaType,
      title: String(item.title ?? item.name ?? "Untitled"),
      year: String(item.releaseDate ?? item.firstAirDate ?? "").slice(0, 4) || undefined,
    }));
}

export async function createSeerrRequest(config: ReelRelayConfig, mediaId: number, mediaType: "movie" | "tv") {
  return seerrFetch<{ id: number }>(config, "/api/v1/request", {
    method: "POST",
    body: JSON.stringify(mediaType === "tv"
      ? { mediaId, mediaType, seasons: "all" }
      : { mediaId, mediaType }),
  });
}

export async function getSeerrRequests(config: ReelRelayConfig) {
  return seerrFetch<{ results?: Array<Record<string, any>> }>(config, "/api/v1/request?take=100&skip=0&sort=added");
}

export async function getSeerrMediaDetails(
  config: ReelRelayConfig,
  mediaType: "movie" | "tv",
  mediaId: number,
) {
  return seerrFetch<{
    title?: string;
    name?: string;
    posterPath?: string;
    mediaInfo?: { status?: number | string };
  }>(config, `/api/v1/${mediaType}/${mediaId}`);
}

export async function getSeerrMediaTitle(
  config: ReelRelayConfig,
  mediaType: "movie" | "tv",
  mediaId: number,
) {
  const media = await getSeerrMediaDetails(config, mediaType, mediaId);
  return media.title ?? media.name;
}
