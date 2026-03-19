import React, { useEffect, useRef } from "react";

interface FuzzyTextProps {
  children: React.ReactNode;
  fontSize?: string | number;
  fontWeight?: number;
  fontFamily?: string;
  color?: string;
  enableHover?: boolean;
  baseIntensity?: number;
  hoverIntensity?: number;
  fuzzRange?: number;
  fps?: number;
  direction?: "horizontal" | "vertical" | "both";
  transitionDuration?: number;
  clickEffect?: boolean;
  className?: string;
}

export default function FuzzyText({
  children,
  fontSize = "clamp(2rem, 10vw, 10rem)",
  fontWeight = 900,
  fontFamily = "inherit",
  color = "#fff",
  enableHover = true,
  baseIntensity = 0.18,
  hoverIntensity = 0.5,
  fuzzRange = 30,
  fps = 60,
  direction = "horizontal",
  transitionDuration = 0,
  clickEffect = false,
  className = "",
}: FuzzyTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let animationFrameId: number;
    let isCancelled = false;
    let isHovering = false;
    let isClicking = false;
    let currentIntensity = baseIntensity;
    let targetIntensity = baseIntensity;
    let lastFrameTime = 0;
    const frameDuration = 1000 / fps;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const init = async () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const computedFontFamily =
        fontFamily === "inherit" ? window.getComputedStyle(canvas).fontFamily || "sans-serif" : fontFamily;
      const fontSizeStr = typeof fontSize === "number" ? `${fontSize}px` : fontSize;
      const fontString = `${fontWeight} ${fontSizeStr} ${computedFontFamily}`;
      try {
        await document.fonts.load(fontString);
      } catch {
        await document.fonts.ready;
      }
      if (isCancelled) return;

      let numericFontSize: number;
      if (typeof fontSize === "number") {
        numericFontSize = fontSize;
      } else {
        const temp = document.createElement("span");
        temp.style.fontSize = fontSize;
        document.body.appendChild(temp);
        numericFontSize = parseFloat(window.getComputedStyle(temp).fontSize);
        document.body.removeChild(temp);
      }

      const text = React.Children.toArray(children).join("");
      const offscreen = document.createElement("canvas");
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) return;
      offCtx.font = `${fontWeight} ${fontSizeStr} ${computedFontFamily}`;
      offCtx.textBaseline = "alphabetic";
      const totalWidth = offCtx.measureText(text).width;
      const metrics = offCtx.measureText(text);
      const actualLeft = metrics.actualBoundingBoxLeft ?? 0;
      const actualRight = metrics.actualBoundingBoxRight ?? totalWidth;
      const actualAscent = metrics.actualBoundingBoxAscent ?? numericFontSize;
      const actualDescent = metrics.actualBoundingBoxDescent ?? numericFontSize * 0.2;
      const textBoundingWidth = Math.ceil(actualLeft + actualRight);
      const tightHeight = Math.ceil(actualAscent + actualDescent);
      const extraWidthBuffer = 10;
      offscreen.width = textBoundingWidth + extraWidthBuffer;
      offscreen.height = tightHeight;
      const xOffset = extraWidthBuffer / 2;
      offCtx.font = `${fontWeight} ${fontSizeStr} ${computedFontFamily}`;
      offCtx.textBaseline = "alphabetic";
      offCtx.fillStyle = color;
      offCtx.fillText(text, xOffset - actualLeft, actualAscent);

      const horizontalMargin = fuzzRange + 20;
      const verticalMargin = 0;
      canvas.width = offscreen.width + horizontalMargin * 2;
      canvas.height = tightHeight + verticalMargin * 2;
      ctx.translate(horizontalMargin, verticalMargin);
      const interactiveLeft = horizontalMargin + xOffset;
      const interactiveTop = verticalMargin;
      const interactiveRight = interactiveLeft + textBoundingWidth;
      const interactiveBottom = interactiveTop + tightHeight;

      const isInsideTextArea = (x: number, y: number) =>
        x >= interactiveLeft && x <= interactiveRight && y >= interactiveTop && y <= interactiveBottom;

      const handleMouseMove = (e: MouseEvent) => {
        if (!enableHover) return;
        const rect = canvas.getBoundingClientRect();
        isHovering = isInsideTextArea(e.clientX - rect.left, e.clientY - rect.top);
      };
      const handleMouseLeave = () => { isHovering = false; };
      const handleClick = () => {
        if (!clickEffect) return;
        isClicking = true;
        setTimeout(() => { isClicking = false; }, 150);
      };

      const run = (timestamp: number) => {
        if (isCancelled) return;
        if (timestamp - lastFrameTime < frameDuration) {
          animationFrameId = requestAnimationFrame(run);
          return;
        }
        lastFrameTime = timestamp;
        ctx.clearRect(-fuzzRange - 20, -fuzzRange - 10, offscreen.width + 2 * (fuzzRange + 20), tightHeight + 2 * (fuzzRange + 10));
        targetIntensity = isClicking ? 1 : isHovering ? hoverIntensity : baseIntensity;
        if (transitionDuration > 0) {
          const step = 1 / (transitionDuration / frameDuration);
          currentIntensity = currentIntensity < targetIntensity
            ? Math.min(currentIntensity + step, targetIntensity)
            : Math.max(currentIntensity - step, targetIntensity);
        } else {
          currentIntensity = targetIntensity;
        }
        if (direction === "horizontal") {
          for (let j = 0; j < tightHeight; j++) {
            const dx = Math.floor(currentIntensity * (Math.random() - 0.5) * fuzzRange);
            ctx.drawImage(offscreen, 0, j, offscreen.width, 1, dx, j, offscreen.width, 1);
          }
        } else if (direction === "vertical") {
          for (let i = 0; i < offscreen.width; i++) {
            const dy = Math.floor(currentIntensity * (Math.random() - 0.5) * fuzzRange);
            ctx.drawImage(offscreen, i, 0, 1, tightHeight, i, dy, 1, tightHeight);
          }
        } else {
          for (let j = 0; j < tightHeight; j++) {
            const dx = Math.floor(currentIntensity * (Math.random() - 0.5) * fuzzRange);
            ctx.drawImage(offscreen, 0, j, offscreen.width, 1, dx, j, offscreen.width, 1);
          }
        }
        animationFrameId = requestAnimationFrame(run);
      };
      animationFrameId = requestAnimationFrame(run);

      if (enableHover) {
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseleave", handleMouseLeave);
      }
      if (clickEffect) canvas.addEventListener("click", handleClick);
      cleanupRef.current = () => {
        cancelAnimationFrame(animationFrameId);
        if (enableHover) {
          canvas.removeEventListener("mousemove", handleMouseMove);
          canvas.removeEventListener("mouseleave", handleMouseLeave);
        }
        if (clickEffect) canvas.removeEventListener("click", handleClick);
      };
    };
    init();
    return () => {
      isCancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [children, fontSize, fontWeight, fontFamily, color, enableHover, baseIntensity, hoverIntensity, fuzzRange, fps, direction, transitionDuration, clickEffect]);

  return <canvas ref={canvasRef} className={className} style={{ fontFamily: fontFamily === "inherit" ? "inherit" : fontFamily, fontWeight, fontSize }} />;
}
