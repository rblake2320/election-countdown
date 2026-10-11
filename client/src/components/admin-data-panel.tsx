import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, RefreshCw } from "lucide-react";
import { ELECTIONS, type VotableElectionId } from "@/lib/elections";

// Validated categorical slots 1-2 (dataviz palette): verified = blue, unverified = orange.
const VERIFIED = "#2a78d6";
const UNVERIFIED = "#eb6834";
const VOTABLE = ELECTIONS.filter((e, i, all) => all.findIndex((x) => x.votesFor === e.votesFor) === i)
  .map((e) => ({ id: e.votesFor, title: e.title }));

interface RollupRow { day: string; metric: string; dimension: string; value: number }

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  for (let i = n - 1; i >= 0; i--) days.push(new Date(today - i * 86400000).toISOString().slice(0, 10));
  return days;
}

async function adminFetch(url: string, secret: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), "x-admin-secret": secret } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res;
}

export function AdminDataPanel({ secret }: { secret: string }) {
  const queryClient = useQueryClient();
  const [election, setElection] = useState<VotableElectionId>("midterm-2026");
  const [sortDesc, setSortDesc] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const days = useMemo(() => lastNDays(30), []);

  const { data: rollups = [] } = useQuery<RollupRow[]>({
    queryKey: ["/api/admin/rollups", secret, days[0]],
    queryFn: async () => (await (await adminFetch(`/api/admin/rollups?from=${days[0]}&to=${days[days.length - 1]}`, secret)).json()).rows,
  });
  const { data: analytics } = useQuery<any>({
    queryKey: ["/api/admin/analytics", secret, election],
    queryFn: async () => (await adminFetch(`/api/admin/analytics?election=${election}`, secret)).json(),
  });

  const series = useMemo(() => days.map((day) => {
    const forDay = rollups.filter((r) => r.day === day);
    const sum = (metric: string, prefix?: string) => forDay
      .filter((r) => r.metric === metric && (!prefix || r.dimension.startsWith(prefix + "|")))
      .reduce((s, r) => s + r.value, 0);
    return {
      day: day.slice(5),
      visitors: sum("unique_visitors"),
      verified: sum("new_votes", election),
      unverified: sum("new_anon_votes", election),
    };
  }), [rollups, days, election]);

  const eventTypes = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rollups) if (r.metric === "events") totals.set(r.dimension, (totals.get(r.dimension) || 0) + r.value);
    return Array.from(totals.entries()).sort((a, b) => (sortDesc ? b[1] - a[1] : a[1] - b[1]));
  }, [rollups, sortDesc]);

  const recomputeToday = async () => {
    setRecomputing(true);
    try {
      await adminFetch(`/api/admin/rollup?day=${days[days.length - 1]}`, secret, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/rollups"] });
    } finally {
      setRecomputing(false);
    }
  };

  const accountTotal = analytics?.votesByIntent?.total ?? 0;
  const anonTotal = Object.values<number>(analytics?.anonymousVotesByIntent ?? {}).reduce((s, n) => s + n, 0);

  return (
    <div className="grid gap-6" data-testid="admin-data-panel">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground" htmlFor="admin-election">Election</label>
        <select
          id="admin-election"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={election}
          onChange={(e) => setElection(e.target.value as VotableElectionId)}
          data-testid="select-admin-election"
        >
          {VOTABLE.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <Button variant="outline" size="sm" className="gap-2" onClick={recomputeToday} disabled={recomputing} data-testid="button-recompute-today">
          <RefreshCw className="h-4 w-4" /> {recomputing ? "Recomputing…" : "Recompute today"}
        </Button>
        <span className="text-xs text-muted-foreground">Days are UTC. The nightly job fills in yesterday at 06:15 UTC.</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Verified (account) votes</p>
          <p className="text-2xl font-bold" data-testid="text-verified-votes">{accountTotal.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Unverified (signed-out) votes</p>
          <p className="text-2xl font-bold" data-testid="text-unverified-votes">{anonTotal.toLocaleString()}</p>
        </CardContent></Card>
      </div>

      <Card data-testid="chart-visitors">
        <CardHeader>
          <CardTitle className="text-base">Unique visitors per day</CardTitle>
          <CardDescription>Distinct hashed IPs with any tracked event, last 30 days</CardDescription>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e7e6e2" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#52514e" }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#52514e" }} tickLine={false} axisLine={false} width={36} />
              <Tooltip />
              <Line type="linear" dataKey="visitors" name="Visitors" stroke={VERIFIED} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card data-testid="chart-votes">
        <CardHeader>
          <CardTitle className="text-base">New votes per day</CardTitle>
          <CardDescription>{VOTABLE.find((e) => e.id === election)?.title}: verified accounts vs signed-out visitors</CardDescription>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e7e6e2" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#52514e" }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#52514e" }} tickLine={false} axisLine={false} width={36} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12, color: "#52514e" }} />
              <Line type="linear" dataKey="verified" name="Verified" stroke={VERIFIED} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="linear" dataKey="unverified" name="Unverified" stroke={UNVERIFIED} strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <details className="rounded-md border p-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">Chart data as a table</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead><tr><th>Day (UTC)</th><th>Visitors</th><th>Verified votes</th><th>Unverified votes</th></tr></thead>
          <tbody>{series.map((r) => <tr key={r.day}><td>{r.day}</td><td>{r.visitors}</td><td>{r.verified}</td><td>{r.unverified}</td></tr>)}</tbody>
        </table>
      </details>

      <Card data-testid="table-event-types">
        <CardHeader>
          <CardTitle className="text-base">Events by type (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1">Event</th>
                <th className="py-1 text-right">
                  <button type="button" onClick={() => setSortDesc(!sortDesc)} className="underline-offset-2 hover:underline">
                    Count {sortDesc ? "↓" : "↑"}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {eventTypes.length === 0 && <tr><td colSpan={2} className="py-2 text-muted-foreground">No rollups yet. Use “Recompute today”.</td></tr>}
              {eventTypes.map(([type, count]) => (
                <tr key={type} className="border-t"><td className="py-1 font-mono text-xs">{type}</td><td className="py-1 text-right">{count.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <ExportCard secret={secret} election={election} />
    </div>
  );
}

function ExportCard({ secret, election }: { secret: string; election: VotableElectionId }) {
  const [dataset, setDataset] = useState<"events" | "votes" | "anon-votes">("votes");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (dataset !== "events") params.set("election", election);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (filter) params.set(dataset === "events" ? "type" : "state", filter);
      const res = await adminFetch(`/api/admin/export/${dataset}.${format}?${params}`, secret);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${dataset}_${election}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(`Export failed (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="card-export">
      <CardHeader>
        <CardTitle className="text-base">Export data</CardTitle>
        <CardDescription>Up to 50,000 newest rows per file. Votes include email; handle accordingly.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1">Dataset
          <select className="h-9 rounded-md border bg-background px-2" value={dataset} onChange={(e) => setDataset(e.target.value as any)} data-testid="select-export-dataset">
            <option value="votes">Verified votes</option>
            <option value="anon-votes">Unverified votes</option>
            <option value="events">Tracking events</option>
          </select>
        </label>
        <label className="grid gap-1">Format
          <select className="h-9 rounded-md border bg-background px-2" value={format} onChange={(e) => setFormat(e.target.value as any)}>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>
        <label className="grid gap-1">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" /></label>
        <label className="grid gap-1">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" /></label>
        <label className="grid gap-1">{dataset === "events" ? "Event type" : "State"}
          <Input value={filter} onChange={(e) => setFilter(e.target.value.trim())} placeholder={dataset === "events" ? "e.g. flip" : "e.g. CA"} className="h-9 w-28" />
        </label>
        <Button onClick={download} disabled={busy} className="gap-2" data-testid="button-export">
          <Download className="h-4 w-4" /> {busy ? "Preparing…" : "Download"}
        </Button>
        {error && <p className="w-full text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
