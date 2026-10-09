/**
 * Client helpers for AltShift Front Desk (OpenAI Realtime WebRTC + tool relay).
 */

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
/** A slow tool must never leave the assistant silent: give up and let it apologize. */
const TOOL_TIMEOUT_MS = 10_000;

export type FrontDeskSessionStart = {
  ok: boolean;
  session_id: string;
  client_secret: string;
  model: string;
  tools_url: string;
};

export async function startFrontDeskSession(language: "en" | "fr"): Promise<FrontDeskSessionStart> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/front-desk-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${session?.access_token ?? ANON}`,
    },
    body: JSON.stringify({ language, channel: "web" }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || json.error || `Session failed (${res.status})`);
  return json as FrontDeskSessionStart;
}

export async function runFrontDeskTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/front-desk-tools`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${session?.access_token ?? ANON}`,
    },
    body: JSON.stringify({ action: "tool", name, arguments: args }),
    signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Tool failed (${res.status})`);
  return json.result;
}

export async function createFrontDeskSessionOnly(language: "en" | "fr"): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/front-desk-tools`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${session?.access_token ?? ANON}`,
    },
    body: JSON.stringify({ action: "create_session", channel: "demo", language }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "create_session failed");
  return json.session_id as string;
}

/** Connect browser mic to OpenAI Realtime via ephemeral client secret (WebRTC). */
export async function connectFrontDeskRealtime(opts: {
  clientSecret: string;
  sessionId: string;
  onEvent: (ev: Record<string, unknown>) => void;
  onRemoteTrack: (stream: MediaStream) => void;
}): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel; localStream: MediaStream; stop: () => void }> {
  const pc = new RTCPeerConnection();
  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  pc.ontrack = (e) => {
    const [stream] = e.streams;
    if (stream) opts.onRemoteTrack(stream);
  };

  const dc = pc.createDataChannel("oai-events");
  const seenCalls = new Set<string>();
  dc.onmessage = (msg) => {
    try {
      const ev = JSON.parse(String(msg.data)) as Record<string, unknown>;
      opts.onEvent(ev);
      void handleToolCalls(ev, opts.sessionId, dc, seenCalls);
    } catch {
      /* ignore */
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.clientSecret}`,
      "Content-Type": "application/sdp",
    },
    body: offer.sdp ?? "",
    signal: AbortSignal.timeout(15_000),
  }).catch((e) => {
    localStream.getTracks().forEach((t) => t.stop());
    pc.close();
    throw e;
  });
  if (!sdpRes.ok) {
    localStream.getTracks().forEach((t) => t.stop());
    pc.close();
    throw new Error(`Realtime SDP exchange failed (${sdpRes.status})`);
  }
  const answer = await sdpRes.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });

  const stop = () => {
    try {
      dc.close();
    } catch {
      /* ignore */
    }
    localStream.getTracks().forEach((t) => t.stop());
    pc.close();
  };

  return { pc, dc, localStream, stop };
}

/**
 * Run each function call exactly once. Realtime reports the same call in
 * several events (function_call_arguments.done, output_item.done, response.done);
 * answering it twice made the assistant repeat itself, so only response.done is used.
 */
async function handleToolCalls(
  ev: Record<string, unknown>,
  sessionId: string,
  dc: RTCDataChannel,
  seen: Set<string>,
) {
  if (String(ev.type ?? "") !== "response.done") return;
  const response = (ev as { response?: { status?: string; output?: unknown[] } }).response;
  if (response?.status && response.status !== "completed") return;
  const calls = (response?.output ?? []).filter((item) => {
    const it = item as { type?: string; name?: string; call_id?: string };
    return it.type === "function_call" && !!it.name && !!it.call_id && !seen.has(it.call_id);
  }) as { name: string; call_id: string; arguments?: string }[];
  if (!calls.length) return;
  for (const it of calls) {
    seen.add(it.call_id);
    let args: Record<string, unknown> = {};
    try {
      args = it.arguments ? (JSON.parse(it.arguments) as Record<string, unknown>) : {};
    } catch {
      args = {};
    }
    args.session_id = args.session_id || sessionId;
    let output: string;
    try {
      output = JSON.stringify(await runFrontDeskTool(it.name, args));
    } catch (e) {
      const timedOut = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
      output = JSON.stringify({ ok: false, error: timedOut ? "tool_timeout" : "tool_unavailable" });
    }
    if (dc.readyState !== "open") return;
    dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: it.call_id, output },
      }),
    );
  }
  if (dc.readyState === "open") dc.send(JSON.stringify({ type: "response.create" }));
}
