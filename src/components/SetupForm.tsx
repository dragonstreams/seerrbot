import { useEffect, useState } from "react";
import { Bot, Check, Eye, EyeOff, KeyRound, Link2, Loader2, Save, Server, ShieldCheck, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export type SafeConfig = {
  seerrUrl: string;
  seerrUsername: string;
  discordApplicationId: string;
  discordGuildId: string;
  hasSeerrPassword: boolean;
  hasDiscordToken: boolean;
  hasPublicKey: boolean;
  configured: boolean;
};

type Props = { config: SafeConfig | null; onSaved: () => void };

const initial = {
  seerrUrl: "https://requests.nimrod.to",
  seerrUsername: "",
  seerrPassword: "",
  discordApplicationId: "",
  discordPublicKey: "",
  discordBotToken: "",
  discordGuildId: "",
  adminSecret: "",
};

export function SetupForm({ config, onSaved }: Props) {
  const [form, setForm] = useState(initial);
  const [showSecrets, setShowSecrets] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    setForm((current) => ({
      ...current,
      seerrUrl: config.seerrUrl,
      seerrUsername: config.seerrUsername,
      discordApplicationId: config.discordApplicationId,
      discordGuildId: config.discordGuildId,
      adminSecret: sessionStorage.getItem("reelrelay-secret") ?? "",
    }));
  }, [config]);

  const change = (name: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  async function call(path: string, body?: object) {
    const result = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-secret": form.adminSecret },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await result.json().catch(() => ({}));
    if (!result.ok) throw new Error(data.statusMessage ?? data.message ?? "Something went wrong.");
    return data;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save");
    try {
      await call("/api/config", form);
      sessionStorage.setItem("reelrelay-secret", form.adminSecret);
      toast.success("Setup saved securely");
      setForm((current) => ({ ...current, seerrPassword: "", discordBotToken: "" }));
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save setup");
    } finally { setBusy(null); }
  }

  async function action(name: "seerr" | "discord" | "register") {
    setBusy(name);
    try {
      const data = name === "register"
        ? await call("/api/bot/register")
        : await call("/api/test", { target: name });
      toast.success(data.message);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection failed");
    } finally { setBusy(null); }
  }

  const secretType = showSecrets ? "text" : "password";
  return (
    <form onSubmit={save} className="space-y-6">
      <section className="panel p-5 sm:p-6">
        <div className="section-heading"><span className="icon-box coral"><Link2 size={19} /></span><div><h2>Connect Seerr</h2><p>Sign in exactly like you do on the website—no API key needed.</p></div></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Seerr URL" icon={<Server size={15} />}><Input value={form.seerrUrl} onChange={change("seerrUrl")} placeholder="https://requests.nimrod.to" required /></Field>
          <Field label="Username or email"><Input value={form.seerrUsername} onChange={change("seerrUsername")} placeholder="you@example.com" required /></Field>
          <Field label="Password"><Input type={secretType} value={form.seerrPassword} onChange={change("seerrPassword")} placeholder={config?.hasSeerrPassword ? "Saved securely ••••••••" : "Seerr password"} /></Field>
          <div className="flex items-end"><Button type="button" variant="outline" className="w-full rounded-xl border-white/10 bg-white/[.04]" onClick={() => action("seerr")} disabled={!!busy}><TestTube2 size={16} /> Test Seerr</Button></div>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <div className="section-heading"><span className="icon-box"><Bot size={19} /></span><div><h2>Connect Discord</h2><p>Paste the credentials from your Discord application.</p></div></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Application ID"><Input value={form.discordApplicationId} onChange={change("discordApplicationId")} placeholder="123456789012345678" required /></Field>
          <Field label="Server ID (recommended)"><Input value={form.discordGuildId} onChange={change("discordGuildId")} placeholder="Instant command updates" /></Field>
          <Field label="Public key"><Input type={secretType} value={form.discordPublicKey} onChange={change("discordPublicKey")} placeholder={config?.hasPublicKey ? "Saved securely ••••••••" : "Discord public key"} /></Field>
          <Field label="Bot token"><Input type={secretType} value={form.discordBotToken} onChange={change("discordBotToken")} placeholder={config?.hasDiscordToken ? "Saved securely ••••••••" : "Discord bot token"} /></Field>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" className="rounded-xl border-white/10 bg-white/[.04]" onClick={() => action("discord")} disabled={!!busy}><TestTube2 size={16} /> Test Discord</Button>
          <Button type="button" variant="outline" className="rounded-xl border-white/10 bg-white/[.04]" onClick={() => action("register")} disabled={!!busy}><Bot size={16} /> Publish /request</Button>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <div className="section-heading"><span className="icon-box mint"><ShieldCheck size={19} /></span><div><h2>Protect the dashboard</h2><p>This secret locks setup changes and manual status checks.</p></div></div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Dashboard secret" className="flex-1"><Input type={secretType} value={form.adminSecret} onChange={change("adminSecret")} placeholder="At least 8 characters" minLength={8} required /></Field>
          <Button type="button" variant="ghost" className="rounded-xl text-slate-300" onClick={() => setShowSecrets((value) => !value)}>{showSecrets ? <EyeOff size={16} /> : <Eye size={16} />} {showSecrets ? "Hide" : "Show"}</Button>
          <Button type="submit" className="rounded-xl bg-[#9f9fa3] px-6 text-[#171820] hover:bg-[#b7b7ba]" disabled={!!busy}>{busy === "save" ? <Loader2 className="animate-spin" size={17} /> : config?.configured ? <Check size={17} /> : <Save size={17} />}{config?.configured ? "Save changes" : "Save setup"}</Button>
        </div>
      </section>
    </form>
  );
}

function Field({ label, icon, children, className = "" }: { label: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-slate-400">{icon}{label}</Label>{children}</div>;
}
