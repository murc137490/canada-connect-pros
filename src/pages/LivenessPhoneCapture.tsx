import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function LivenessPhoneCapture() {
  const { locale } = useLanguage();
  const [token] = useState(() => {
    return new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
  });
  const [challenge, setChallenge] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fr = locale === "fr";

  useEffect(() => {
    window.history.replaceState(window.history.state, "", "/liveness-capture");
    let alive = true;
    if (!/^[a-f0-9]{64}$/.test(token)) { setMessage(fr ? "Ce code QR est invalide ou expiré." : "This QR code is invalid or expired."); return; }
    void supabase.functions.invoke("liveness-handoff", { body: { action: "challenge", token } }).then(({ data, error }) => {
      if (!alive) return;
      if (error || !data?.challenge) setMessage(fr ? "Ce code QR est expiré. Créez-en un nouveau sur votre ordinateur." : "This QR code has expired. Create a new one on your computer.");
      else setChallenge(data.challenge);
    });
    return () => { alive = false; streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, [token, fr]);

  const capture = async () => {
    if (!consent || busy || !challenge) return;
    setBusy(true); setMessage("");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      if (typeof MediaRecorder === "undefined") throw new Error(fr ? "L’enregistrement vidéo n’est pas pris en charge." : "Video recording is not supported on this device.");
      const mimeType = ["video/webm;codecs=vp8", "video/webm", "video/mp4"].find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      await new Promise<void>((resolve, reject) => {
        recorder.onerror = () => reject(new Error(fr ? "L’enregistrement a échoué." : "Recording failed."));
        recorder.onstop = () => resolve();
        recorder.start();
        window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 8000);
      });
      const file = new File(chunks, `liveness.${(mimeType ?? recorder.mimeType).includes("mp4") ? "mp4" : "webm"}`, { type: (mimeType ?? recorder.mimeType ?? "video/webm").split(";")[0] });
      stream.getTracks().forEach((track) => track.stop()); streamRef.current = null;
      const { data: upload, error: uploadError } = await supabase.functions.invoke("liveness-handoff", { body: { action: "upload-url", token, mimeType: file.type, size: file.size } });
      if (uploadError || !upload?.path || !upload?.token) throw uploadError ?? new Error(fr ? "Impossible de préparer l’envoi." : "Could not prepare the upload.");
      const { error: storageError } = await supabase.storage.from("pro-verification").uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type, upsert: true });
      if (storageError) throw storageError;
      const { error: completeError } = await supabase.functions.invoke("liveness-handoff", { body: { action: "complete", token } });
      if (completeError) throw completeError;
      setMessage(fr ? "Vidéo envoyée. Vous pouvez retourner à votre ordinateur." : "Video sent. You can return to your computer.");
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
      setMessage(error instanceof Error ? error.message : (fr ? "Impossible d’enregistrer la vidéo." : "Could not record the video."));
    } finally { setBusy(false); }
  };

  return <main className="mx-auto flex min-h-[100svh] w-full max-w-xl flex-col justify-center gap-5 px-5 py-10">
    <header><p className="text-sm font-semibold text-primary">AltShift</p><h1 className="mt-2 text-2xl font-semibold">{fr ? "Vérification de présence" : "Liveness check"}</h1><p className="mt-2 text-sm text-muted-foreground">{fr ? "Cette vidéo privée sera liée à votre demande professionnelle pour examen manuel." : "This private video will be attached to your professional application for manual review."}</p></header>
    {challenge ? <section className="space-y-4 rounded-xl border bg-card p-4">
      <p className="font-medium">{challenge}</p>
      <video ref={videoRef} muted playsInline className="min-h-32 max-h-72 w-full rounded-lg bg-black object-cover" aria-label={fr ? "Aperçu de la caméra" : "Camera preview"} />
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} /><span>{fr ? "J’accepte l’enregistrement et l’examen manuel de cette vidéo." : "I consent to recording and manual review of this video."}</span></label>
      <Button className="w-full" disabled={!consent || busy} onClick={() => void capture()}>{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{fr ? "Enregistrement et envoi…" : "Recording and sending…"}</> : (fr ? "Enregistrer 8 secondes" : "Record 8 seconds")}</Button>
    </section> : null}
    {message && <p role="status" className="rounded-lg border bg-card p-4 text-sm">{message}</p>}
  </main>;
}
