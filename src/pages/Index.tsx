import { useCallback, useEffect, useState } from "react";
import { Activity, Bot, CircleHelp, Clapperboard, Settings2 } from "lucide-react";
import { SetupForm, type SafeConfig } from "@/components/SetupForm";
import { StatusOverview, type TrackedRequest } from "@/components/StatusOverview";

const Index = () => {
  const [tab, setTab] = useState<"overview" | "setup">("overview");
  const [data, setData] = useState<{ config: SafeConfig | null; requests: TrackedRequest[]; counts: { total: number; pending: number; available: number } }>({
    config: null, requests: [], counts: { total: 0, pending: 0, available: 0 },
  });

  const load = useCallback(async () => {
    const response = await fetch("/api/config");
    if (response.ok) setData(await response.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  return <div className="min-h-screen bg-[#111218] text-slate-100">
    <header className="topbar">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <button className="brand" onClick={() => setTab("overview")}>
          <img src="/assets/reelrelay-logo.png" alt="ReelRelay" />
          <span><strong>ReelRelay</strong><small>Seerr request bot</small></span>
        </button>
        <div className="flex items-center gap-2">
          <span className={`connection-dot ${data.config?.configured ? "ready" : ""}`}><i />{data.config?.configured ? "Systems ready" : "Not configured"}</span>
          <button className="help-button" title="Open setup help" onClick={() => setTab("setup")}><CircleHelp size={18} /></button>
        </div>
      </div>
    </header>

    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8 lg:py-8">
      <aside className="sidebar">
        <nav>
          <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><Activity size={18} /> Overview</button>
          <button className={tab === "setup" ? "active" : ""} onClick={() => setTab("setup")}><Settings2 size={18} /> Setup</button>
        </nav>
        <div className="sidebar-note"><Clapperboard size={20} /><p><strong>No API key?</strong><br/>Perfect. ReelRelay signs in with your regular Seerr account.</p></div>
      </aside>

      <div className="min-w-0">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><p className="page-kicker">Control room</p><h2 className="page-title">{tab === "overview" ? "Good evening, director." : "Connect your services."}</h2></div>
          {tab === "overview" && <button onClick={() => setTab("setup")} className="quick-setup"><Settings2 size={15} /> Setup</button>}
        </div>
        {tab === "overview"
          ? <StatusOverview {...data} onRefresh={load} />
          : <SetupForm config={data.config} onSaved={() => { load(); setTab("overview"); }} />}
      </div>
    </main>
    <footer><Bot size={14} /> ReelRelay keeps credentials encrypted on the server.</footer>
  </div>;
};

export default Index;
