import { useEffect, useRef } from "react";
import "@/components/shape-grid-background.css";

type Palette = { line: string; hover: string; fill: string };
type Ripple = { x: number; y: number; started: number };

const CELL = 40;
const MAX_PIXELS = 8_000_000;
const INTRO_MS = 1800;
const RIPPLE_MS = 1600;

function getPalette(): Palette {
  const root = document.documentElement;
  if (root.classList.contains("dark")) {
    return { line: "rgba(122, 157, 173, 0.28)", hover: "#67d5b0", fill: "rgba(71, 190, 145, 0.15)" };
  }
  if (root.classList.contains("cream")) {
    return { line: "rgba(94, 119, 102, 0.27)", hover: "#528d74", fill: "rgba(90, 150, 112, 0.14)" };
  }
  return { line: "rgba(73, 128, 135, 0.25)", hover: "#338b7b", fill: "rgba(61, 166, 129, 0.13)" };
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(edge1 - edge0, 0.0001)));
  return t * t * (3 - 2 * t);
}

export default function ShapeGridBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true, desynchronized: true });
    if (!container || !canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0, inside: false, lastX: 0, lastY: 0, hasLast: false };
    const litCells = new Map<string, { i: number; j: number; value: number }>();
    const ripples: Ripple[] = [];
    let palette = getPalette();
    let width = 1;
    let height = 1;
    let ratio = 1;
    let offsetX = 0;
    let offsetY = 0;
    let startedAt = 0;
    let previousTime = 0;
    let frame = 0;
    let visible = true;
    let disposed = false;

    const draw = (now: number) => {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      if (previousTime && now - previousTime < 1000 / 30 && !reduceMotion) {
        frame = requestAnimationFrame(draw);
        return;
      }
      const dt = previousTime ? Math.min(0.05, (now - previousTime) / 1000) : 0;
      previousTime = now;
      if (!startedAt) startedAt = now;
      const elapsed = now - startedAt;
      if (!reduceMotion) {
        offsetX = (offsetX + Math.SQRT1_2 * 30 * dt) % CELL;
        offsetY = (offsetY - Math.SQRT1_2 * 30 * dt) % CELL;
      }
      const trailDecay = Math.exp(-dt / 0.6);
      for (const [key, cell] of litCells) {
        cell.value *= trailDecay;
        if (cell.value < 0.015) litCells.delete(key);
      }
      const gridStartX = -((offsetX % CELL) + CELL);
      const gridStartY = -((offsetY % CELL) + CELL);
      const stampCell = (x: number, y: number) => {
        const i = Math.floor((x - gridStartX) / CELL);
        const j = Math.floor((y - gridStartY) / CELL);
        const key = `${i}:${j}`;
        const existing = litCells.get(key);
        litCells.set(key, { i, j, value: Math.max(existing?.value ?? 0, 1) });
      };
      if (pointer.inside) stampCell(pointer.x, pointer.y);
      while (ripples.length && now - ripples[0].started > RIPPLE_MS) ripples.shift();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const fadeDistance = Math.min(width, height) * 0.26;
      const introRadius = reduceMotion ? Infinity : (elapsed / INTRO_MS) * Math.hypot(width, height) * 0.72;
      if (introRadius !== Infinity && elapsed < INTRO_MS) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, Math.max(1, introRadius), 0, Math.PI * 2);
        ctx.clip();
      }

      ctx.lineWidth = 1;
      ctx.strokeStyle = palette.line;
      ctx.beginPath();
      const startX = gridStartX;
      const startY = gridStartY;
      for (let x = startX; x <= width + CELL; x += CELL) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = startY; y <= height + CELL; y += CELL) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      for (const cell of litCells.values()) {
        const strength = cell.value;
        const x = startX + cell.i * CELL;
        const y = startY + cell.j * CELL;
        ctx.globalAlpha = strength * 0.72;
        ctx.fillStyle = palette.fill;
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.globalAlpha = strength;
        ctx.strokeStyle = palette.hover;
        ctx.lineWidth = 1 + strength * 0.35;
        ctx.shadowColor = palette.hover;
        ctx.shadowBlur = 8 * strength;
        ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
        ctx.shadowBlur = 0;
      }

      for (const ripple of ripples) {
        const age = now - ripple.started;
        const life = age / RIPPLE_MS;
        const waveRadius = age * 0.22;
        const reach = Math.hypot(width, height) * (1 - life * 0.4);
        const fromX = Math.floor((ripple.x - reach) / CELL) * CELL;
        const fromY = Math.floor((ripple.y - reach) / CELL) * CELL;
        for (let x = fromX; x < ripple.x + reach; x += CELL) {
          for (let y = fromY; y < ripple.y + reach; y += CELL) {
            const cx = x + CELL / 2;
            const cy = y + CELL / 2;
            const distance = Math.hypot(cx - ripple.x, cy - ripple.y);
            const wave = Math.exp(-(((distance - waveRadius) / 19) ** 2)) * (1 - life) ** 1.6;
            if (wave < 0.04) continue;
            ctx.globalAlpha = wave * 0.8;
            ctx.fillStyle = palette.fill;
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
            ctx.globalAlpha = wave;
            ctx.strokeStyle = palette.hover;
            ctx.lineWidth = 1 + wave;
            ctx.shadowColor = palette.hover;
            ctx.shadowBlur = 12 * wave;
            ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
            ctx.shadowBlur = 0;
          }
        }
      }
      ctx.globalAlpha = 1;

      if (fadeDistance > 0) {
        ctx.globalCompositeOperation = "destination-in";
        const mask = ctx.createLinearGradient(0, 0, width, 0);
        mask.addColorStop(0, "rgba(0,0,0,0)");
        mask.addColorStop(0.26, "rgba(0,0,0,1)");
        mask.addColorStop(0.74, "rgba(0,0,0,1)");
        mask.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = mask;
        ctx.fillRect(0, 0, width, height);
        const verticalMask = ctx.createLinearGradient(0, 0, 0, height);
        verticalMask.addColorStop(0, "rgba(0,0,0,0)");
        verticalMask.addColorStop(0.26, "rgba(0,0,0,1)");
        verticalMask.addColorStop(0.74, "rgba(0,0,0,1)");
        verticalMask.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = verticalMask;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";
      }

      if (introRadius !== Infinity && elapsed < INTRO_MS) ctx.restore();
      if (!reduceMotion || litCells.size || ripples.length) frame = requestAnimationFrame(draw);
      else previousTime = 0;
    };

    const wake = () => {
      if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      const baseRatio = Math.min(window.devicePixelRatio || 1, 2);
      ratio = width * height * baseRatio ** 2 > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / (width * height)) : baseRatio;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      wake();
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointer.inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      if (pointer.inside) {
        if (pointer.hasLast) {
          const distance = Math.hypot(x - pointer.lastX, y - pointer.lastY);
          const samples = Math.max(1, Math.ceil(distance / (CELL * 0.25)));
          for (let step = 1; step <= samples; step++) {
            const progress = step / samples;
            const px = pointer.lastX + (x - pointer.lastX) * progress;
            const py = pointer.lastY + (y - pointer.lastY) * progress;
            const gridX = -((offsetX % CELL) + CELL);
            const gridY = -((offsetY % CELL) + CELL);
            const i = Math.floor((px - gridX) / CELL);
            const j = Math.floor((py - gridY) / CELL);
            const key = `${i}:${j}`;
            litCells.set(key, { i, j, value: 1 });
          }
        } else {
          const gridX = -((offsetX % CELL) + CELL);
          const gridY = -((offsetY % CELL) + CELL);
          const i = Math.floor((x - gridX) / CELL);
          const j = Math.floor((y - gridY) / CELL);
          litCells.set(`${i}:${j}`, { i, j, value: 1 });
        }
        pointer.x = pointer.lastX = x;
        pointer.y = pointer.lastY = y;
        pointer.hasLast = true;
      }
      wake();
    };
    const onPointerLeave = () => {
      pointer.inside = false;
      pointer.hasLast = false;
      wake();
    };
    const onPointerDown = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
        ripples.push({ x, y, started: performance.now() });
        if (ripples.length > 4) ripples.shift();
        wake();
      }
    };
    const onThemeChange = () => {
      palette = getPalette();
      wake();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        previousTime = 0;
        wake();
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) wake();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    intersectionObserver.observe(container);
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    resize();
    wake();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <div ref={containerRef} className="shape-grid-background" aria-hidden="true">
      <canvas ref={canvasRef} className="shape-grid-background__canvas" />
    </div>
  );
}
