import { useEffect, useRef } from "react";
import "@/components/threads-background.css";

const vertexShader = `#version 300 es
precision highp float;
in vec2 aPoint;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uFrame;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uDistance;
uniform float uCount;
uniform float uWaves;
uniform float uSplit;
uniform float uFray;
uniform float uThickness;
uniform float uSoftness;
uniform float uTaper;
uniform float uAngle;
uniform float uReducedMotion;
out float vEdge;
out float vBand;
out float vDraw;
out float vIndex;
out float vAlpha;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  float index = float(gl_InstanceID);
  float pct = (index + 0.5) / uCount;
  float x = aPoint.x;
  float splitPoint = uSplit + pct * uFray;
  float envelope = smoothstep(splitPoint, max(0.72, splitPoint + 0.18), x);
  float time = uTime * (1.0 - uReducedMotion);
  float phase = x * uWaves * 6.28318 + pct * 8.0 + time * 0.72 + (uMouse.x - 0.5);
  float wave = sin(phase + 0.22 * sin(phase * 0.43 + pct * 5.0));
  float secondary = sin(phase * 0.55 - time * 0.29 + pct * 13.0);
  float noiseX = x * 7.0;
  float noiseBlend = smoothstep(0.0, 1.0, fract(noiseX));
  float noise = mix(hash(vec2(index, floor(noiseX))), hash(vec2(index, floor(noiseX) + 1.0)), noiseBlend);
  noise = (noise - 0.5) * uFray * envelope;
  float amplitude = 0.5 * uAmplitude * (1.0 + (uMouse.y - 0.5) * 0.2);
  float y = (pct - 0.5) * uDistance + envelope * amplitude * (wave * 0.42 + secondary * 0.12) + noise * 0.12;
  float pixel = 1.0 / max(uResolution.x, uResolution.y);
  float width = 7.0 * uThickness * pixel * (1.0 - pct);
  float blur = smoothstep(splitPoint, splitPoint + 0.05, x) * pct;
  float band = (width * 0.5 + 10.0 * uSoftness * pixel * blur) * uFrame.y;
  float draw = max(band, 1.0);
  vec2 local = vec2((x - 0.5) * uFrame.x, y * uFrame.y + aPoint.y * draw);
  float c = cos(uAngle);
  float s = sin(uAngle);
  vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  gl_Position = vec4(rotated / (uResolution * 0.5), 0.0, 1.0);
  vEdge = aPoint.y * draw;
  vBand = band;
  vDraw = draw;
  vIndex = pct;
  vAlpha = (1.0 - smoothstep(0.0, 1.0, pow(pct, 0.3)) * uTaper) * smoothstep(0.0, 0.2, envelope);
}`;

const fragmentShader = `#version 300 es
precision highp float;
in float vEdge;
in float vBand;
in float vDraw;
in float vIndex;
in float vAlpha;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform vec2 uResolution;
uniform float uFade;
uniform float uOpacity;
uniform float uBrightness;
out vec4 outColor;
void main() {
  float coverage = (1.0 - smoothstep(0.0, vDraw, abs(vEdge))) * (vBand / vDraw);
  vec3 color = mix(uColor, uAccent, smoothstep(0.0, 1.0, vIndex * 0.82));
  float mask = uOpacity;
  if (uFade > 0.0) {
    vec2 px = gl_FragCoord.xy;
    float edge = uFade * min(uResolution.x, uResolution.y) * 0.5;
    mask *= smoothstep(0.0, edge, px.x) * smoothstep(0.0, edge, uResolution.x - px.x);
    mask *= smoothstep(0.0, edge, px.y) * smoothstep(0.0, edge, uResolution.y - px.y);
  }
  float alpha = coverage * vAlpha * mask;
  outColor = vec4(color * pow(alpha, 2.0 / uBrightness), alpha);
}`;

type Palette = { line: [number, number, number]; accent: [number, number, number] };

function rgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function getPalette(): Palette {
  const root = document.documentElement;
  if (root.classList.contains("dark")) {
    return { line: rgb("#b9e4e8"), accent: rgb("#61cba0") };
  }
  if (root.classList.contains("cream")) {
    return { line: rgb("#5c8176"), accent: rgb("#8d9f6c") };
  }
  return { line: rgb("#4c91a0"), accent: rgb("#529b75") };
}

export default function ThreadsBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", { alpha: true, antialias: true, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: "low-power" });
    if (!container || !canvas || !gl) return;

    const compile = (kind: number, source: string) => {
      const shader = gl.createShader(kind);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
      gl.deleteShader(shader);
      return null;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexShader);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const u = {
      time: uniform("uTime"), resolution: uniform("uResolution"), frame: uniform("uFrame"), mouse: uniform("uMouse"),
      amplitude: uniform("uAmplitude"), distance: uniform("uDistance"), count: uniform("uCount"), waves: uniform("uWaves"),
      split: uniform("uSplit"), fray: uniform("uFray"), thickness: uniform("uThickness"),
      softness: uniform("uSoftness"), taper: uniform("uTaper"), angle: uniform("uAngle"),
      reduced: uniform("uReducedMotion"), color: uniform("uColor"), accent: uniform("uAccent"),
      fade: uniform("uFade"), opacity: uniform("uOpacity"), brightness: uniform("uBrightness"),
    };

    const lineVao = gl.createVertexArray();
    const lineBuffer = gl.createBuffer();
    if (!lineVao || !lineBuffer) return;
    gl.bindVertexArray(lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const pointLocation = gl.getAttribLocation(program, "aPoint");
    gl.enableVertexAttribArray(pointLocation);
    gl.vertexAttribPointer(pointLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0.5, y: 0.5 };
    let palette = getPalette();
    let width = 1;
    let lineCount = 64;
    let segmentCount = 0;
    let elapsed = 0;
    let previousTime = 0;
    let raf = 0;
    let visible = true;
    let disposed = false;

    const draw = (time: number) => {
      if (disposed || !visible || document.hidden) return;
      if (previousTime && time - previousTime < 1000 / 30 && !reducedMotion) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;
      if (!reducedMotion) elapsed += dt;
      const radians = (25 * Math.PI) / 180;
      const frameWidth = Math.abs(canvas.width * Math.cos(radians)) + Math.abs(canvas.height * Math.sin(radians));
      const frameHeight = Math.abs(canvas.width * Math.sin(radians)) + Math.abs(canvas.height * Math.cos(radians));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      gl.bindVertexArray(lineVao);
      gl.uniform1f(u.time, elapsed * 0.6);
      gl.uniform2f(u.resolution, canvas.width, canvas.height);
      gl.uniform2f(u.frame, frameWidth, frameHeight);
      gl.uniform2f(u.mouse, pointer.x, 1 - pointer.y);
      gl.uniform1f(u.amplitude, 1.7);
      gl.uniform1f(u.distance, 0.4);
      gl.uniform1f(u.count, lineCount);
      gl.uniform1f(u.waves, 1.05);
      gl.uniform1f(u.split, 0.04);
      gl.uniform1f(u.fray, 0.5);
      gl.uniform1f(u.thickness, 0.6);
      gl.uniform1f(u.softness, 1.3);
      gl.uniform1f(u.taper, 0.85);
      gl.uniform1f(u.angle, radians);
      gl.uniform1f(u.reduced, reducedMotion ? 1 : 0);
      gl.uniform1f(u.fade, 0);
      gl.uniform1f(u.opacity, 1);
      gl.uniform1f(u.brightness, 1.4);
      gl.uniform3fv(u.color, palette.line);
      gl.uniform3fv(u.accent, palette.accent);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (segmentCount + 1) * 2, lineCount);
      gl.bindVertexArray(null);
      if (!reducedMotion) raf = requestAnimationFrame(draw);
      else raf = 0;
    };

    const wake = () => {
      if (!raf && visible && !document.hidden && !disposed) raf = requestAnimationFrame(draw);
    };
    const resize = () => {
      width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
      const longest = Math.max(width, height) * maxDpr;
      const dpr = longest > 2048 ? maxDpr * 2048 / longest : maxDpr;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      lineCount = 90;
      segmentCount = Math.max(96, Math.min(640, Math.round(width / 3)));
      const points = new Float32Array((segmentCount + 1) * 4);
      for (let i = 0; i <= segmentCount; i++) {
        const x = i / segmentCount;
        points.set([x, -1, x, 1], i * 4);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
      wake();
    };
    const pointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
      const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      pointer.x = inside ? x : 0.5;
      pointer.y = inside ? y : 0.5;
      if (reducedMotion) wake();
    };
    const themeChange = () => {
      palette = getPalette();
      wake();
    };
    const visibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
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
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    intersectionObserver.observe(container);
    const themeObserver = new MutationObserver(themeChange);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("pointermove", pointerMove, { passive: true });
    document.addEventListener("visibilitychange", visibilityChange);
    resize();
    wake();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("pointermove", pointerMove);
      document.removeEventListener("visibilitychange", visibilityChange);
      gl.deleteBuffer(lineBuffer);
      gl.deleteVertexArray(lineVao);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div ref={containerRef} className="threads-background" aria-hidden="true">
      <canvas ref={canvasRef} className="threads-background__canvas" />
    </div>
  );
}
