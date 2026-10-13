import { useEffect, useRef } from "react";
import "@/components/grainient-background.css";

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerOn;
uniform vec3 uRamp[5];
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}
vec3 ramp(float t) {
  float scaled = clamp(t, 0.0, 1.0) * 4.0;
  int index = min(int(floor(scaled)), 3);
  float blend = smoothstep(0.0, 1.0, fract(scaled));
  if (index == 0) return mix(uRamp[0], uRamp[1], blend);
  if (index == 1) return mix(uRamp[1], uRamp[2], blend);
  if (index == 2) return mix(uRamp[2], uRamp[3], blend);
  return mix(uRamp[3], uRamp[4], blend);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = uv - 0.5;
  p.x *= uResolution.x / uResolution.y;
  vec2 flow = vec2(uTime * 0.14, -uTime * 0.095);
  float n = noise(p * 2.1 + flow);
  float n2 = noise(p * 3.4 - flow * 0.72 + 4.7);
  float band = uv.x * 0.68 + uv.y * 0.26 + (n - 0.5) * 0.34 + (n2 - 0.5) * 0.13;
  vec2 pointer = uPointer - 0.5;
  pointer.x *= uResolution.x / uResolution.y;
  vec2 delta = p - pointer;
  float lens = exp(-dot(delta, delta) * 5.0) * uPointerOn;
  band += lens * sin(length(delta) * 24.0 - uTime * 2.2) * 0.075;
  vec3 color = ramp(clamp(band, 0.0, 1.0));
  float grain = hash(gl_FragCoord.xy + floor(uTime * 12.0)) - 0.5;
  color += grain * 0.035;
  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function GrainientBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", { alpha: false, antialias: false, depth: false });
    if (!root || !canvas || !gl) return;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
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
      time: gl.getUniformLocation(program, "uTime"),
      pointer: gl.getUniformLocation(program, "uPointer"),
      pointerOn: gl.getUniformLocation(program, "uPointerOn"),
      ramp: gl.getUniformLocation(program, "uRamp[0]"),
    };
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0.5, y: 0.5, active: 0 };
    const palettes = {
      dark: ["#061a2b", "#063b59", "#087f9f", "#087f68", "#75d8a1"],
      cream: ["#f6eddb", "#e4e4cf", "#b9d1bb", "#78aa91", "#397c72"],
      light: ["#f5fbff", "#d7f1f4", "#9edbd6", "#58b7a5", "#267b83"],
    };
    const paletteToRgb = (hex: string) => {
      const value = hex.replace("#", "");
      return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
    };
    let activePalette = "";
    let width = 1;
    let height = 1;
    let time = 0;
    let last = 0;
    let raf = 0;
    let visible = true;
    let disposed = false;

    const draw = (now: number) => {
      raf = 0;
      if (disposed || !visible || document.hidden) return;
      if (last && now - last < 1000 / 30) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if (!reduced) time += dt;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, time);
      gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
      gl.uniform1f(uniforms.pointerOn, pointer.active);
      const theme = document.documentElement.classList.contains("dark")
        ? "dark"
        : document.documentElement.classList.contains("cream")
          ? "cream"
          : "light";
      if (theme !== activePalette) {
        activePalette = theme;
        gl.uniform3fv(uniforms.ramp, new Float32Array(palettes[theme].flatMap(paletteToRgb)));
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    const wake = () => {
      if (!raf && visible && !document.hidden && !disposed) raf = requestAnimationFrame(draw);
    };
    const resize = () => {
      width = Math.max(1, root.clientWidth);
      height = Math.max(1, root.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 1);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      wake();
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
      pointer.y = 1 - y;
      pointer.active = pointer.x >= 0 && pointer.x <= 1 && y >= 0 && y <= 1 ? 1 : 0;
      wake();
    };
    const onPointerLeave = () => { pointer.active = 0; wake(); };
    const onVisibility = () => { last = 0; wake(); };
    const resizeObserver = new ResizeObserver(resize);
    const themeObserver = new MutationObserver(() => wake());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) { last = 0; wake(); }
      else { cancelAnimationFrame(raf); raf = 0; }
    });
    resizeObserver.observe(root);
    intersection.observe(root);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    wake();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <div ref={rootRef} className="grainient-background" aria-hidden="true">
    <canvas ref={canvasRef} className="grainient-background__canvas" />
  </div>;
}
