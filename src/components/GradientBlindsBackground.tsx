import { useEffect, useRef } from "react";
import "@/components/gradient-blinds-background.css";

const vertexShader = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragmentShader = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
uniform float uLightMode;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;

  float sway = sin(uTime * 0.35 + uv.y * 2.8) * 0.035;
  float stripe = fract((uv.x + sway) * 13.0);
  float edge = min(stripe, 1.0 - stripe);
  float shade = smoothstep(0.0, 0.16, edge);
  float relief = 0.78 + shade * 0.22;
  float shine = exp(-pow((stripe - 0.12) / 0.07, 2.0)) * 0.24;

  vec2 pointerDelta = (uv - uPointer) * vec2(aspect, 1.0);
  float spotlight = exp(-dot(pointerDelta, pointerDelta) / 0.19);
  float drift = 0.5 + 0.5 * sin(uv.y * 2.2 + uTime * 0.16);
  float mixPoint = clamp(uv.x * 0.58 + drift * 0.23 + uv.y * 0.19, 0.0, 1.0);
  vec3 gradient = mix(uColorA, uColorB, smoothstep(0.0, 0.58, mixPoint));
  gradient = mix(gradient, uColorC, smoothstep(0.4, 1.0, mixPoint));

  vec3 color;
  if (uLightMode > 0.5) {
    float tint = 0.10 + relief * 0.22 + spotlight * 0.16;
    color = mix(vec3(0.98, 0.99, 0.98), gradient, tint);
    color += vec3(shine * 0.48);
  } else {
    color = gradient * (0.48 + relief * 0.58);
    color += vec3(0.68, 0.9, 0.86) * (spotlight * 0.12 + shine);
  }
  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

type Palette = { colors: [string, string, string]; light: boolean };

function getPalette(): Palette {
  const root = document.documentElement;
  if (root.classList.contains("dark")) {
    return { colors: ["#07334b", "#087f93", "#13805f"], light: false };
  }
  if (root.classList.contains("cream")) {
    return { colors: ["#dfcda8", "#9ec3a7", "#77aaa0"], light: true };
  }
  return { colors: ["#c5e8f1", "#8dd7d1", "#91d6ac"], light: true };
}

function colorVector(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}

export default function GradientBlindsBackground() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = root?.querySelector("canvas");
    const gl = canvas?.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!root || !canvas || !gl) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
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

    const uniforms = {
      resolution: gl.getUniformLocation(program, "uResolution"),
      pointer: gl.getUniformLocation(program, "uPointer"),
      time: gl.getUniformLocation(program, "uTime"),
      lightMode: gl.getUniformLocation(program, "uLightMode"),
      colorA: gl.getUniformLocation(program, "uColorA"),
      colorB: gl.getUniformLocation(program, "uColorB"),
      colorC: gl.getUniformLocation(program, "uColorC"),
    };
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0.5, y: 0.5 };
    const palette = getPalette();
    let width = 1;
    let height = 1;
    let dpr = 1;
    let elapsed = 0;
    let lastTime = 0;
    let frame = 0;
    let visible = true;
    let disposed = false;

    const render = (timestamp: number) => {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      const delta = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0;
      lastTime = timestamp;
      if (!reducedMotion) elapsed += delta;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.pointer, pointer.x, 1 - pointer.y);
      gl.uniform1f(uniforms.time, elapsed);
      gl.uniform1f(uniforms.lightMode, palette.light ? 1 : 0);
      gl.uniform3fv(uniforms.colorA, colorVector(palette.colors[0]));
      gl.uniform3fv(uniforms.colorB, colorVector(palette.colors[1]));
      gl.uniform3fv(uniforms.colorC, colorVector(palette.colors[2]));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };

    const wake = () => {
      if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(render);
    };
    const resize = () => {
      width = Math.max(1, root.clientWidth);
      height = Math.max(1, root.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      wake();
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      pointer.x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
      pointer.y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)));
      wake();
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        lastTime = 0;
        wake();
      }
    };
    const onThemeChange = () => {
      const next = getPalette();
      palette.colors = next.colors;
      palette.light = next.light;
      wake();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) wake();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    intersectionObserver.observe(root);
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    wake();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div ref={rootRef} className="gradient-blinds-background" aria-hidden="true">
      <canvas className="gradient-blinds-background__canvas" />
    </div>
  );
}
