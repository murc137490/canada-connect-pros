import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FRONT_DESK_INSTRUCTIONS,
  FRONT_DESK_TOOLS,
  legacyPhoneAudioConfig,
  PHONE_OPENING_LINE,
  phoneAudioConfig,
} from "../../supabase/functions/_shared/frontDeskRealtime";

const root = path.resolve(__dirname, "../..");

describe("Front Desk realtime config", () => {
  it("keeps the phone-line copy byte-identical to the shared file", () => {
    const shared = readFileSync(path.join(root, "supabase/functions/_shared/frontDeskRealtime.ts"), "utf8");
    const sip = readFileSync(path.join(root, "supabase/functions/openai-live-sip-webhook/frontDeskRealtime.ts"), "utf8");
    expect(sip).toBe(shared);
  });

  it("offers hand-off and clean hang-up tools", () => {
    const names = FRONT_DESK_TOOLS.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["request_callback", "transfer_to_human", "end_call", "verify_voice_pin"]));
    expect(new Set(names).size).toBe(names.length);
  });

  it("states the key guardrails and never contains a URL", () => {
    expect(FRONT_DESK_INSTRUCTIONS).toContain("9-1-1");
    expect(FRONT_DESK_INSTRUCTIONS).toContain("Les services, autrement");
    expect(FRONT_DESK_INSTRUCTIONS).toMatch(/Never invent prices/);
    expect(FRONT_DESK_INSTRUCTIONS).not.toMatch(/https?:\/\//);
    expect(FRONT_DESK_INSTRUCTIONS.toLowerCase()).not.toContain("premiere");
    expect(PHONE_OPENING_LINE).toContain("AltShift");
  });

  it("uses noise reduction and a server VAD tuned for phones by default", () => {
    const audio = phoneAudioConfig() as {
      input: { noise_reduction: { type: string }; turn_detection: { type: string; threshold: number; silence_duration_ms: number } };
      output: { format: { type: string } };
    };
    expect(audio.input.noise_reduction.type).toBe("near_field");
    expect(audio.input.turn_detection.type).toBe("server_vad");
    expect(audio.input.turn_detection.threshold).toBeGreaterThanOrEqual(0.5);
    expect(audio.input.turn_detection.silence_duration_ms).toBeGreaterThanOrEqual(500);
    expect(audio.output.format.type).toBe("audio/pcmu");
    expect((legacyPhoneAudioConfig() as { input: { format: { type: string } } }).input.format.type).toBe("audio/pcmu");
  });
});
