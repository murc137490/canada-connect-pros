/**
 * Client helpers for AltShift Front Desk (OpenAI Realtime WebRTC + tool relay).
 */

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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
  dc.onmessage = (msg) => {
    try {
      const ev = JSON.parse(String(msg.data)) as Record<string, unknown>;
      opts.onEvent(ev);
      void handleToolCalls(ev, opts.sessionId, dc);
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

async function handleToolCalls(
  ev: Record<string, unknown>,
  sessionId: string,
  dc: RTCDataChannel,
) {
  // response.done may include function_call items; also listen for dedicated events
  const type = String(ev.type ?? "");
  if (type === "response.function_call_arguments.done" || type === "response.output_item.done") {
    const name =
      (ev as { name?: string }).name ??
      ((ev as { item?: { name?: string } }).item?.name);
    const callId =
      (ev as { call_id?: string }).call_id ??
      ((ev as { item?: { call_id?: string } }).item?.call_id);
    const argsRaw =
      (ev as { arguments?: string }).arguments ??
      ((ev as { item?: { arguments?: string } }).item?.arguments);
    if (!name || !callId) return;
    let args: Record<string, unknown> = {};
    try {
      args = argsRaw ? (JSON.parse(argsRaw) as Record<string, unknown>) : {};
    } catch {
      args = {};
    }
    args.session_id = args.session_id || sessionId;
    try {
      const result = await runFrontDeskTool(name, args);
      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(result),
          },
        }),
      );
      dc.send(JSON.stringify({ type: "response.create" }));
    } catch (e) {
      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ error: String(e) }),
          },
        }),
      );
      dc.send(JSON.stringify({ type: "response.create" }));
    }
  }

  // Some Realtime payloads nest function calls inside response.done
  if (type === "response.done") {
    const response = (ev as { response?: { output?: unknown[] } }).response;
    const output = response?.output ?? [];
    for (const item of output) {
      const it = item as { type?: string; name?: string; call_id?: string; arguments?: string };
      if (it.type !== "function_call" || !it.name || !it.call_id) continue;
      let args: Record<string, unknown> = {};
      try {
        args = it.arguments ? (JSON.parse(it.arguments) as Record<string, unknown>) : {};
      } catch {
        args = {};
      }
      args.session_id = args.session_id || sessionId;
      try {
        const result = await runFrontDeskTool(it.name, args);
        dc.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: it.call_id,
              output: JSON.stringify(result),
            },
          }),
        );
      } catch (e) {
        dc.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: it.call_id,
              output: JSON.stringify({ error: String(e) }),
            },
          }),
        );
      }
    }
    if (output.some((i) => (i as { type?: string }).type === "function_call")) {
      dc.send(JSON.stringify({ type: "response.create" }));
    }
  }
}
