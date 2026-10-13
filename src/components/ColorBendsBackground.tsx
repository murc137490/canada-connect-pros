import { useEffect, useRef } from "react";
import * as THREE from "three";
import "@/components/color-bends-background.css";

const vertexShader = `
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform vec2 uCanvas;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform vec3 uColors[4];
  in vec2 vUv;
  out vec4 outColor;

  void main() {
    float t = uTime * 0.42;
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uCanvas.x / max(uCanvas.y, 1.0);
    vec2 q = p + uPointer * 0.12;
    q += 0.2 * cos(t) - 2.9;
    q += (uPointer - p) * 0.09;
    q /= 0.82;
    q += sin(vec2(q.y * 1.15 + t * 0.8, q.x * 0.9 - t * 0.56)) * 0.23;

    vec3 sumColor = vec3(0.0);
    float coverage = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 s = q - float(i) * 0.012;
      vec2 r = sin(1.5 * s.yx + 2.0 * cos(s));
      float wave = length(r + sin(5.0 * r.y - 3.0 * t + float(i)) / 4.0);
      float band = 1.0 - exp(-6.0 / exp(6.0 * wave));
      sumColor += uColors[i] * band;
      coverage = max(coverage, band);
    }

    vec3 color = clamp(sumColor * 1.35, 0.0, 1.0);
    float grain = fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    color = clamp(color + grain * 0.025, 0.0, 1.0);
    outColor = vec4(color * coverage, coverage);
  }
`;

const palettes = {
  dark: ["#0b3047", "#087ea4", "#08795e", "#41bc8b"],
  cream: ["#c7a65c", "#7cbf9e", "#379c8c", "#558bb0"],
  light: ["#99d5e9", "#43bdb1", "#75d7a2", "#4d92b0"],
};

function readTheme() {
  const root = document.documentElement;
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("cream")) return "cream";
  return "light";
}

function toColor(hex: string) {
  return new THREE.Color(hex);
}

export default function ColorBendsBackground() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "color-bends-background__canvas";
    root.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const colors = palettes[readTheme()].map(toColor);
    const uniforms = {
      uCanvas: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uColors: { value: colors },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(geometry, material));

    const pointer = new THREE.Vector2(0, 0);
    let frameId = 0;
    let lastFrame = 0;
    let elapsed = 0;
    let visible = true;
    let disposed = false;

    const render = (now = 0) => {
      frameId = 0;
      if (disposed || !visible || document.hidden) return;
      if (!reducedMotion && lastFrame && now - lastFrame < 1000 / 30) {
        frameId = requestAnimationFrame(render);
        return;
      }
      const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / 60;
      lastFrame = now;
      if (!reducedMotion) elapsed += dt;
      uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
      if (!reducedMotion) frameId = requestAnimationFrame(render);
    };

    const wake = () => {
      if (!frameId && visible && !document.hidden && !disposed) frameId = requestAnimationFrame(render);
    };
    const resize = () => {
      const width = Math.max(1, root.clientWidth);
      const height = Math.max(1, root.clientHeight);
      renderer.setSize(width, height, false);
      uniforms.uCanvas.value.set(width, height);
      wake();
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1),
      );
      uniforms.uPointer.value.lerp(pointer, 0.35);
      wake();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      } else {
        lastFrame = 0;
        wake();
      }
    };
    const updateTheme = () => {
      uniforms.uColors.value = palettes[readTheme()].map(toColor);
      wake();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    const themeObserver = new MutationObserver(updateTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) {
        lastFrame = 0;
        wake();
      } else {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    });
    visibilityObserver.observe(root);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    resize();
    wake();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={rootRef} className="color-bends-background" aria-hidden="true" />;
}
