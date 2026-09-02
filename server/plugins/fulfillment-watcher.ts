import { defineNitroPlugin } from "nitro";
import { pollFulfilledRequests } from "../utils/poller";

export default defineNitroPlugin(() => {
  const timer = setInterval(() => {
    pollFulfilledRequests().catch((error) => {
      console.error("ReelRelay fulfillment check failed", error);
    });
  }, 2 * 60 * 1000);
  timer.unref();
});
