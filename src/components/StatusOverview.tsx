import { Bot, CheckCircle2, Clock3, Film, RefreshCw, Sparkles, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { SafeConfig } from "./SetupForm";

export type TrackedRequest = { id: string; title: string; mediaType: "movie" | "tv"; status: "pending" | "available"; createdAt: string };

type Props = {
  config: SafeConfig | null;
  requests: TrackedRequest[];
  counts: { total: number; pending: number; available: number };
  onRefresh: () => void;
};

export function StatusOverview({ config, requests, counts, onRefresh }: Props) {
  async function checkNow() {
    const response = await fetch("/api/poll", { method: "POST", headers: { "x-admin-secret": sessionStorage.getItem("reelrelay-secret") ?? "" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(data.statusMessage ?? "Status check failed");
    toast.success(data.message);
    onRefresh();
  }

  return <div className="space-y-5">
    <section className="hero-panel overflow-hidden">
      <img src="/assets/cinema-background.png" alt="Abstract cinema frames" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-[#171820]/55" />
      <div className="relative z-10 max-w-xl p-6 sm:p-8">
        <span className="eyebrow"><Sparkles size={13} /> Your watchlist wingman</span>
        <h1>Requests in.<br/><span>Movie night on.</span></h1>
        <p>Let friends request films and series in Discord. ReelRelay handles Seerr and sends the “it’s ready” ping.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className={`status-pill ${config?.configured ? "online" : "offline"}`}><span />{config?.configured ? "Bot ready" : "Setup needed"}</span>
          <span className="status-pill"><Clock3 size={14} /> Fulfillment watcher</span>
        </div>
      </div>
    </section>

    <div className="grid grid-cols-3 gap-3">
      <Metric label="All requests" value={counts.total} icon={<Film />} />
      <Metric label="In the queue" value={counts.pending} icon={<Clock3 />} accent="coral" />
      <Metric label="Ready to watch" value={counts.available} icon={<CheckCircle2 />} accent="mint" />
    </div>

    <section className="panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="text-lg font-bold">Recent requests</h2><p className="mt-1 text-sm text-slate-400">The latest titles sent through Discord.</p></div>
        <Button variant="outline" size="sm" className="rounded-xl border-white/10 bg-white/[.04]" onClick={checkNow}><RefreshCw size={15} /> Check now</Button>
      </div>
      {requests.length ? <div className="mt-5 space-y-2">{requests.map((item) => <div key={item.id} className="request-row">
        <span className="request-icon">{item.mediaType === "movie" ? <Film size={17} /> : <Tv2 size={17} />}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-100">{item.title}</p><p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {item.mediaType === "movie" ? "Movie" : "TV series"}</p></div>
        <span className={`request-state ${item.status}`}>{item.status === "available" ? "Ready" : "Requested"}</span>
      </div>)}</div> : <div className="empty-state">
        <img src="/assets/request-journey.png" alt="Bot carrying a request to a home cinema" />
        <div><p>No requests yet</p><span>Publish the command, then try <code>/request</code> in Discord.</span></div>
      </div>}
    </section>

    <section className="tip-card"><span className="icon-box"><Bot size={19} /></span><div><strong>Interaction endpoint</strong><code>{window.location.origin}/api/bot/interactions</code><p>Add this URL in your Discord app’s General Information settings.</p></div></section>
  </div>;
}

function Metric({ label, value, icon, accent = "" }: { label: string; value: number; icon: React.ReactNode; accent?: string }) {
  return <div className={`metric ${accent}`}><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>;
}
