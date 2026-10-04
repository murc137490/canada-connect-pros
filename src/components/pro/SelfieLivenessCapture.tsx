import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";

type Step = "idle" | "starting" | "face" | "blink" | "done" | "error";

type Landmarker = {
  detectForVideo: (
    video: HTMLVideoElement,
    time: number,
  ) => {
    faceBlendshapes?: { categories?: { categoryName?: string; score?: number }[] }[];
    faceLandmarks?: unknown[];
  };
};

/**
 * Live selfie: the photo has to come from the camera, and the person has to blink.
 * Staff still review the picture and the ID. This only rejects a still image upload.
 */
export function SelfieLivenessCapture({
  locale,
  confirmed,
  onCapture,
  onClear,
}: {
  locale: "en" | "fr";
  confirmed: boolean;
  onCapture: (file: File) => void;
  onClear: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<Landmarker | null>(null);
  const rafRef = useRef<number>(0);
  const sawOpenEyes = useRef(false);
  const samplesRef = useRef<number[]>([]);
  const [step, setStep] = useState<Step>(confirmed ? "done" : "idle");
  const [message, setMessage] = useState("");

  const copy = locale === "fr"
    ? {
        hint: "Prenez le selfie avec la caméra. Regardez l’objectif, puis clignez des yeux. Nous confirmons que c’est une personne en direct. L’équipe vérifie ensuite la photo et la pièce d’identité.",
        start: "Ouvrir la caméra",
        look: "Regardez la caméra.",
        blink: "Clignez des yeux.",
        done: "Selfie en direct confirmé.",
        retry: "Reprendre",
        camera: "La caméra n’est pas disponible. Autorisez-la, puis réessayez.",
        model: "La vérification en direct n’a pas pu démarrer. Réessayez.",
      }
    : {
        hint: "Take the selfie with your camera. Look at the lens, then blink. We confirm a live person. The team still reviews the photo and your ID.",
        start: "Open camera",
        look: "Look at the camera.",
        blink: "Blink.",
        done: "Live selfie confirmed.",
        retry: "Retake",
        camera: "The camera is not available. Allow it, then try again.",
        model: "Live check could not start. Try again.",
      };

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => () => stopCamera(), []);

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      setStep("done");
      setMessage(copy.done);
      stopCamera();
    }, "image/jpeg", 0.92);
  };

  const blinkScore = (result: ReturnType<Landmarker["detectForVideo"]>) => {
    const categories = result.faceBlendshapes?.[0]?.categories ?? [];
    const left = categories.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
    const right = categories.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
    return Math.max(left, right);
  };

  const eyeBandLuma = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 60;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 80, 60);
    const band = ctx.getImageData(15, 22, 50, 12).data;
    let sum = 0;
    for (let i = 0; i < band.length; i += 4) sum += band[i] * 0.3 + band[i + 1] * 0.59 + band[i + 2] * 0.11;
    return sum / (band.length / 4);
  };

  const watch = (useModel: boolean) => {
    const loop = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (useModel && landmarkerRef.current) {
        const result = landmarkerRef.current.detectForVideo(video, performance.now());
        const hasFace = (result.faceLandmarks?.length ?? 0) > 0;
        if (!hasFace) {
          sawOpenEyes.current = false;
          setStep("face");
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        const blink = blinkScore(result);
        if (blink < 0.25) sawOpenEyes.current = true;
        if (sawOpenEyes.current && blink > 0.55) {
          captureFrame();
          return;
        }
        setStep(sawOpenEyes.current ? "blink" : "face");
      } else {
        const luma = eyeBandLuma();
        if (luma != null) {
          const samples = samplesRef.current;
          samples.push(luma);
          if (samples.length > 18) samples.shift();
          const open = samples.slice(0, -2);
          const baseline = open.length ? open.reduce((a, b) => a + b, 0) / open.length : luma;
          if (samples.length > 6 && luma > baseline * 0.92) sawOpenEyes.current = true;
          if (sawOpenEyes.current && luma < baseline * 0.78) {
            captureFrame();
            return;
          }
          setStep(sawOpenEyes.current ? "blink" : "face");
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const start = async () => {
    setStep("starting");
    setMessage("");
    sawOpenEyes.current = false;
    samplesRef.current = [];
    onClear();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("camera");
      video.srcObject = stream;
      await video.play();
      let useModel = false;
      try {
        const loadVision = new Function(
          "url",
          "return import(url)",
        ) as (url: string) => Promise<{
          FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> };
          FaceLandmarker: { createFromOptions: (files: unknown, options: object) => Promise<Landmarker> };
        }>;
        const vision = await loadVision("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/+esm");
        const files = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm",
        );
        landmarkerRef.current = await vision.FaceLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
        useModel = true;
      } catch {
        landmarkerRef.current = null;
      }
      setStep("face");
      watch(useModel);
    } catch {
      stopCamera();
      setStep("error");
      setMessage(copy.camera);
    }
  };

  const prompt = step === "blink" ? copy.blink : step === "face" || step === "starting" ? copy.look : message;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground leading-relaxed">{copy.hint}</p>
      {step !== "done" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-black/90">
          <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
        </div>
      ) : null}
      {prompt ? <p className="text-sm font-medium text-foreground">{prompt}</p> : null}
      {step === "error" ? <p className="text-sm font-medium text-destructive">{message || copy.model}</p> : null}
      <div className="flex flex-wrap gap-2">
        {step === "done" ? (
          <Button type="button" variant="outline" size="sm" onClick={() => { setStep("idle"); onClear(); }}>
            {copy.retry}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" className="gap-2" disabled={step === "starting" || step === "face" || step === "blink"} onClick={() => void start()}>
            {step === "starting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {copy.start}
          </Button>
        )}
      </div>
    </div>
  );
}
