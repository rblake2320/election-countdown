import { useCallback, useEffect, useRef, useState } from "react";
import { ELECTIONS } from "@/lib/elections";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LiveProfile = {
  id: string; enabled: boolean; version: number; ownerZone: string;
  reporterId: string; updatedAt: string; event: {id: string; title: string};
};

export function LiveProfileSettings() {
  const [profile, setProfile] = useState<LiveProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [device, setDevice] = useState("");
  const [eventId, setEventId] = useState("midterm-2026");
  const saving = useRef(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/account/live-profile", {cache: "no-store", signal: AbortSignal.timeout(6000)});
    if (!response.ok) throw new Error("Could not load live profile settings");
    const value: LiveProfile | null = await response.json();
    setProfile(value); setEventId(value?.event.id || "midterm-2026"); setLoaded(true);
  }, []);

  useEffect(() => {
    try {
      let id = localStorage.getItem("ec-live-reporter");
      if (!id) { id = crypto.randomUUID(); localStorage.setItem("ec-live-reporter", id); }
      setDevice(id);
    } catch { setMessage("Enable browser storage to select this device as your time-zone reporter."); }
    load().catch(error => setMessage(error.message));
  }, [load]);

  const save = useCallback(async (enabled: boolean, takeover = false, automatic = false) => {
    if (saving.current || !loaded || !device) return;
    saving.current = true; setBusy(true);
    try {
      const ownerZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch("/api/account/live-profile", {
        method: "PUT", headers: {"Content-Type": "application/json"}, signal: AbortSignal.timeout(6000),
        body: JSON.stringify({enabled, electionId: automatic ? profile!.event.id : eventId, ownerZone,
          reporterId: device, version: profile?.version || 0, takeover}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not save live profile");
      // Read the durable receiving state, not just the mutation acknowledgement.
      await load();
      setMessage(enabled ? "Live profile saved. This device reports zone changes while this page is open." : "Live profile turned off.");
    } catch (error) {
      setMessage((error as Error).message);
      // An uncertain response may have committed. Refresh before another explicit action.
      try { await load(); } catch { setLoaded(false); }
    } finally { saving.current = false; setBusy(false); }
  }, [device, eventId, loaded, profile, load]);

  useEffect(() => {
    if (!profile?.enabled || profile.reporterId !== device) return;
    const check = () => {
      if (!document.hidden && new Intl.DateTimeFormat().resolvedOptions().timeZone !== profile.ownerZone) {
        void save(true, false, true);
      }
    };
    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer); window.removeEventListener("focus", check); window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [profile, device, save]);

  const url = profile ? `${window.location.origin}/live-avatar?id=${profile.id}` : "";
  const otherDevice = !!profile && profile.reporterId !== device;
  return <Card data-testid="live-profile-settings">
    <CardHeader>
      <CardTitle>Live countdown profile</CardTitle>
      <CardDescription>A shared countdown in your profile picture space. Enabling publishes the countdown and your device's time zone through a public link.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {profile?.enabled && <div className="flex items-center gap-4">
        <iframe src={url} title="Your live countdown avatar" width="128" height="128" style={{border: 0, borderRadius: "50%"}} />
        <div className="text-sm"><p className="font-medium">{profile.event.title}</p><p>{profile.ownerZone}</p>
          <p className="text-muted-foreground">Last report: {new Date(profile.updatedAt).toLocaleString()}</p></div>
      </div>}
      <label className="block text-sm font-medium">Countdown event
        <select aria-label="Countdown event" value={eventId} onChange={event => setEventId(event.target.value)} disabled={!loaded || busy}
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2">
          {ELECTIONS.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
        </select>
      </label>
      <p className="text-sm text-muted-foreground">The election deadline stays fixed. Changing zones changes its local time label. Keep this page open on your phone to report changes; it checks again when you return.</p>
      {otherDevice && <p className="text-sm">Another device is reporting your time zone. Select this device below to replace it.</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!loaded || !device || busy || otherDevice} onClick={() => void save(true)}>{busy ? "Saving…" : profile?.enabled ? "Update live profile" : "Enable live profile"}</Button>
        {otherDevice && <Button variant="outline" disabled={busy || !loaded || !device} onClick={() => void save(true, true)}>Use this device</Button>}
        {profile?.enabled && <Button variant="outline" disabled={busy || !loaded || !device} onClick={() => void save(false, otherDevice)}>Turn off</Button>}
        {!loaded && <Button variant="outline" onClick={() => load().catch(error => setMessage(error.message))}>Retry settings</Button>}
      </div>
      {profile?.enabled && <div className="space-y-2">
        <label className="block text-sm">Live avatar URL<input aria-label="Live avatar URL" readOnly value={url} className="mt-1 block w-full rounded border bg-background px-2 py-2 text-xs" /></label>
        <label className="block text-sm">Embed in a supported profile slot<textarea aria-label="Live avatar embed" readOnly rows={3}
          value={`<iframe src="${url}" width="64" height="64" style="border:0;border-radius:50%" title="Live election countdown"></iframe>`}
          className="mt-1 block w-full rounded border bg-background px-2 py-2 font-mono text-xs" /></label>
        <p className="text-xs text-muted-foreground">Enabling publishes this countdown and your device's zone through the share link. This is a live web embed; uploading a screenshot produces a still image.</p>
      </div>}
      <p role="status" className="text-sm">{message}</p>
    </CardContent>
  </Card>;
}
