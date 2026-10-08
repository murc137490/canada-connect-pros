/**
 * Minimal WebSocket client for the OpenAI Realtime sideband channel.
 *
 * Deno's WebSocket constructor cannot set an Authorization header and the
 * insecure-api-key subprotocol is rejected, so we do the RFC 6455 handshake
 * ourselves over TLS with the Bearer header.
 */

export type RealtimeSocket = {
  readonly open: boolean;
  send(data: string): void;
  close(): void;
  onmessage: ((data: string) => void) | null;
  onclose: (() => void) | null;
};

/** Client frame. Servers reject unmasked client frames. */
function maskFrame(payload: Uint8Array, opcode = 0x1): Uint8Array {
  const mask = crypto.getRandomValues(new Uint8Array(4));
  const header = [0x80 | opcode];
  if (payload.length < 126) header.push(0x80 | payload.length);
  else if (payload.length < 65536) header.push(0x80 | 126, (payload.length >> 8) & 0xff, payload.length & 0xff);
  else {
    const len = payload.length;
    header.push(0x80 | 127, 0, 0, 0, 0, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff);
  }
  const frame = new Uint8Array(header.length + 4 + payload.length);
  frame.set(header);
  frame.set(mask, header.length);
  for (let i = 0; i < payload.length; i++) frame[header.length + 4 + i] = payload[i] ^ mask[i % 4];
  return frame;
}

async function writeAll(conn: Deno.Conn, bytes: Uint8Array) {
  let off = 0;
  while (off < bytes.length) {
    const n = await conn.write(bytes.subarray(off));
    if (n <= 0) throw new Error("socket_write_failed");
    off += n;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        onTimeout();
        reject(new Error("handshake_timeout"));
      }, ms);
    }),
  ]);
}

/** Opens the sideband for an accepted call. Retries a few times; throws if it never upgrades. */
export async function openRealtimeSideband(apiKey: string, callId: string, attempts = 4): Promise<RealtimeSocket> {
  const path = `/v1/realtime?call_id=${encodeURIComponent(callId)}`;
  let lastDetail = "no_attempt";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let conn: Deno.Conn | null = null;
    try {
      const handshake = async () => {
        conn = await Deno.connectTls({ hostname: "api.openai.com", port: 443 });
        const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
        const request =
          `GET ${path} HTTP/1.1\r\n` +
          `Host: api.openai.com\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\n` +
          `Sec-WebSocket-Version: 13\r\n` +
          `Authorization: Bearer ${apiKey}\r\n\r\n`;
        await writeAll(conn, new TextEncoder().encode(request));
        const buf: number[] = [];
        const tmp = new Uint8Array(2048);
        let headerEnd = -1;
        while (headerEnd < 0) {
          const n = await conn.read(tmp);
          if (n === null) throw new Error("socket_closed_during_handshake");
          for (let i = 0; i < n; i++) buf.push(tmp[i]);
          for (let i = Math.max(0, buf.length - n - 3); i < buf.length - 3; i++) {
            if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) {
              headerEnd = i;
              break;
            }
          }
          if (buf.length > 8192) break;
        }
        return { buf, headerEnd };
      };
      const { buf, headerEnd } = await withTimeout(handshake(), 6000, () => {
        try { (conn as Deno.Conn | null)?.close(); } catch { /* ignore */ }
      });
      const head = new TextDecoder().decode(new Uint8Array(buf.slice(0, Math.max(headerEnd, 0))));
      const statusLine = head.split("\r")[0] ?? "";
      if (headerEnd < 0 || !/^HTTP\/1\.[01] 101\b/.test(statusLine)) {
        lastDetail = statusLine.slice(0, 60);
        console.error("sideband handshake rejected", attempt, lastDetail);
        try { (conn as Deno.Conn | null)?.close(); } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 250 * attempt));
        continue;
      }
      return startSocket(conn!, new Uint8Array(buf.slice(headerEnd + 4)));
    } catch (e) {
      lastDetail = e instanceof Error ? e.message : "error";
      console.error("sideband connect failed", attempt, lastDetail);
      try { (conn as Deno.Conn | null)?.close(); } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
  throw new Error(`sideband_upgrade_failed ${lastDetail}`);
}

/** Server event types we never need to parse (audio/transcript streaming). Saves CPU. */
const SKIP_TYPES = /^\{\s*"type"\s*:\s*"(response\.output_audio\.delta|response\.output_audio_transcript\.delta|response\.output_text\.delta|response\.function_call_arguments\.delta|conversation\.item\.input_audio_transcription\.delta|rate_limits\.updated)"/;

function startSocket(conn: Deno.Conn, initial: Uint8Array): RealtimeSocket {
  let isOpen = true;
  const socket: RealtimeSocket = {
    get open() {
      return isOpen;
    },
    onmessage: null,
    onclose: null,
    send(data: string) {
      if (!isOpen) return;
      writeAll(conn, maskFrame(new TextEncoder().encode(data))).catch((e) => {
        console.error("sideband send failed", e instanceof Error ? e.message : "error");
        socket.close();
      });
    },
    close() {
      if (!isOpen) return;
      isOpen = false;
      try { conn.close(); } catch { /* ignore */ }
    },
  };

  const chunks: Uint8Array[] = initial.length ? [initial] : [];
  let buffered = initial.length;
  const pull = async (n: number): Promise<Uint8Array | null> => {
    while (buffered < n) {
      const block = new Uint8Array(16384);
      const got = await conn.read(block);
      if (got === null) return null;
      chunks.push(block.subarray(0, got));
      buffered += got;
    }
    const out = new Uint8Array(n);
    let o = 0;
    while (o < n) {
      const c = chunks[0];
      const take = Math.min(c.length, n - o);
      out.set(c.subarray(0, take), o);
      o += take;
      if (take === c.length) chunks.shift();
      else chunks[0] = c.subarray(take);
    }
    buffered -= n;
    return out;
  };

  const decoder = new TextDecoder();
  void (async () => {
    let textParts: Uint8Array[] = [];
    try {
      while (isOpen) {
        const h = await pull(2);
        if (!h) break;
        const fin = (h[0] & 0x80) !== 0;
        const opcode = h[0] & 0x0f;
        let len = h[1] & 0x7f;
        if (len === 126) {
          const ext = await pull(2);
          if (!ext) break;
          len = (ext[0] << 8) | ext[1];
        } else if (len === 127) {
          const ext = await pull(8);
          if (!ext) break;
          len = ((ext[4] << 24) >>> 0) + (ext[5] << 16) + (ext[6] << 8) + ext[7];
        }
        const payload = len ? await pull(len) : new Uint8Array();
        if (!payload) break;
        if (opcode === 0x9) {
          await writeAll(conn, maskFrame(payload, 0xa));
          continue;
        }
        if (opcode === 0x8) break;
        if (opcode === 0x1 || opcode === 0x0) {
          if (opcode === 0x1) textParts = [];
          textParts.push(payload);
          if (fin) {
            const total = textParts.reduce((s, p) => s + p.length, 0);
            const merged = new Uint8Array(total);
            let off = 0;
            for (const p of textParts) {
              merged.set(p, off);
              off += p.length;
            }
            textParts = [];
            const text = decoder.decode(merged);
            if (!SKIP_TYPES.test(text.slice(0, 120))) socket.onmessage?.(text);
          }
        }
      }
    } catch (e) {
      if (isOpen) console.error("sideband read failed", e instanceof Error ? e.message : "error");
    } finally {
      isOpen = false;
      try { conn.close(); } catch { /* ignore */ }
      socket.onclose?.();
    }
  })();
  console.log("sideband open");
  return socket;
}
