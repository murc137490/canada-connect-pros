/** Crop a pan/zoomed image to a square/circle avatar blob. */
export type AvatarCropTransform = {
  scale: number;
  panX: number;
  panY: number;
};

export function getInitialAvatarCropScale(
  imageWidth: number,
  imageHeight: number,
  containerSize: number,
  cropDiameter: number,
): number {
  const cover = Math.max(cropDiameter / imageWidth, cropDiameter / imageHeight);
  const fit = Math.min(containerSize / imageWidth, containerSize / imageHeight);
  return Math.max(cover / fit, 1);
}

export async function cropAvatarToBlob(
  image: HTMLImageElement,
  opts: {
    containerSize: number;
    cropDiameter: number;
    transform: AvatarCropTransform;
    outputSize?: number;
    mimeType?: string;
    quality?: number;
  },
): Promise<Blob> {
  const {
    containerSize,
    cropDiameter,
    transform,
    outputSize = 512,
    mimeType = "image/jpeg",
    quality = 0.92,
  } = opts;

  const fit = Math.min(containerSize / image.naturalWidth, containerSize / image.naturalHeight);
  const displayScale = fit * transform.scale;
  const displayW = image.naturalWidth * displayScale;
  const displayH = image.naturalHeight * displayScale;
  const imageLeft = containerSize / 2 - displayW / 2 + transform.panX;
  const imageTop = containerSize / 2 - displayH / 2 + transform.panY;
  const radius = cropDiameter / 2;
  const srcX = (containerSize / 2 - radius - imageLeft) / displayScale;
  const srcY = (containerSize / 2 - radius - imageTop) / displayScale;
  const srcSize = cropDiameter / displayScale;

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode image"))),
      mimeType,
      quality,
    );
  });
}
