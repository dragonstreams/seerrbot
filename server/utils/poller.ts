import { notifyAvailable } from "./discord";
import { getSeerrRequests } from "./seerr";
import { readStore, writeStore } from "./store";

export async function pollFulfilledRequests() {
  const store = await readStore();
  if (!store.config || !store.requests.some((request) => request.status === "pending")) {
    return { checked: store.requests.length, notified: 0 };
  }

  const remote = await getSeerrRequests(store.config);
  let notified = 0;
  for (const item of store.requests.filter((request) => request.status === "pending")) {
    const match = (remote.results ?? []).find((request: any) => Number(request.id) === item.seerrRequestId);
    const available = Number(match?.media?.status) === 5 || String(match?.media?.status).toLowerCase() === "available";
    if (!available) continue;
    await notifyAvailable(store.config, item.channelId, item.userId, item.title);
    item.status = "available";
    notified += 1;
  }
  await writeStore(store);
  return { checked: store.requests.length, notified };
}
