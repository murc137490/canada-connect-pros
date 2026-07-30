import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Iphone from "@/components/Iphone";

/** iPhone 14 / 15 logical CSS viewport — iframe fills this entire area inside the bezel */
const PHONE_W = 390;
const PHONE_H = 844;

export default function PhonePreview() {
  const [searchParams] = useSearchParams();
  const previewPath = useMemo(() => {
    const rawPath = searchParams.get("path") ?? "/";
    if (!rawPath.startsWith("/") || rawPath.startsWith("//") || rawPath.startsWith("/phone-preview")) return "/";
    return rawPath;
  }, [searchParams]);

  const iframeSrc = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return `${window.location.origin}${previewPath}`;
  }, [previewPath]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mb-8 max-w-lg space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Mobile preview</h1>
        <p className="text-sm text-zinc-400">
          iPhone-sized viewport ({PHONE_W}×{PHONE_H} CSS pixels). The site fills the full screen inside the frame.
        </p>
        <p className="text-xs text-zinc-500">
          Scroll and tap inside the device. For other widths, use your browser&apos;s responsive devtools.
        </p>
        <Link to={previewPath} className="inline-block text-sm font-medium text-emerald-400 underline-offset-4 hover:text-emerald-300 hover:underline">
          Open this page full size
        </Link>
      </div>
      <Iphone width={PHONE_W} screenHeight={PHONE_H}>
        <iframe
          src={iframeSrc}
          title="Premiere Services mobile preview"
          className="block h-full min-h-0 w-full border-0 bg-zinc-950"
        />
      </Iphone>
    </div>
  );
}
