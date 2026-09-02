import { defineHandler } from "nitro";

export default defineHandler(() => ({
  ok: true,
  service: "reelrelay",
  timestamp: new Date().toISOString(),
}));
