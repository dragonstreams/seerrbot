import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type ReelRelayConfig = {
  seerrUrl: string;
  seerrUsername: string;
  seerrPassword: string;
  discordApplicationId: string;
  discordPublicKey: string;
  discordBotToken: string;
  discordGuildId: string;
  adminSecret: string;
};

export type TrackedRequest = {
  id: string;
  seerrRequestId: number;
  mediaId: number;
  mediaType: "movie" | "tv";
  title: string;
  userId: string;
  channelId: string;
  createdAt: string;
  status: "pending" | "available";
};

type StoreData = { config?: ReelRelayConfig; requests: TrackedRequest[] };

const storePath = join(process.cwd(), ".data", "reelrelay.enc");
const keyPath = join(process.cwd(), ".data", "reelrelay.key");

async function getKey() {
  await mkdir(dirname(storePath), { recursive: true });
  let seed: string;
  try {
    seed = await readFile(keyPath, "utf8");
  } catch {
    seed = randomBytes(32).toString("hex");
    await writeFile(keyPath, seed, { mode: 0o600 });
  }
  return scryptSync(seed, "reelrelay-local-store", 32);
}

export async function readStore(): Promise<StoreData> {
  try {
    const raw = JSON.parse(await readFile(storePath, "utf8"));
    const key = await getKey();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(raw.iv, "hex"));
    decipher.setAuthTag(Buffer.from(raw.tag, "hex"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(raw.data, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plain);
  } catch {
    return { requests: [] };
  }
}

export async function writeStore(value: StoreData) {
  const key = await getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  await writeFile(storePath, JSON.stringify({
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: encrypted.toString("base64"),
  }), { mode: 0o600 });
}

export function safeConfig(config?: ReelRelayConfig) {
  if (!config) return null;
  return {
    seerrUrl: config.seerrUrl,
    seerrUsername: config.seerrUsername,
    discordApplicationId: config.discordApplicationId,
    discordGuildId: config.discordGuildId,
    hasSeerrPassword: Boolean(config.seerrPassword),
    hasDiscordToken: Boolean(config.discordBotToken),
    hasPublicKey: Boolean(config.discordPublicKey),
    configured: Boolean(config.seerrUsername && config.seerrPassword && config.discordBotToken && config.discordPublicKey),
  };
}
