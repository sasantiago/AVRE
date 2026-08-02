import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface GeometricOrbProps {
  className?: string;
  size?: number;
  // Verde/rojo sutil según el signo del retorno del portfolio — sin overrides,
  // se queda en el indigo de marca (§8 tailwind.config.ts: avre.accent).
  tone?: 'neutral' | 'positive' | 'negative';
}

const TONE_COLOR: Record<NonNullable<GeometricOrbProps['tone']>, number> = {
  neutral: 0x6366f1, // avre.accent
  positive: 0x34d399, // emerald-400, mismo tono que Badge tone="success"
  negative: 0xfb7185, // rose-400, mismo tono que Badge tone="danger"
};

// Visual decorativo minimalista — un poliedro facetado (mismo lenguaje visual
// que el isotipo de AVRE) rotando lento. No representa datos puntuales: es
// ambientación de marca para el dashboard, no un gráfico. Sin controles/
// interacción — es intencionalmente pasivo.
export function GeometricOrb({ className, size = 220, tone = 'neutral' }: GeometricOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    container.appendChild(renderer.domElement);

    const color = TONE_COLOR[tone];

    const geometry = new THREE.IcosahedronGeometry(1.5, 0);
    const material = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: 0.92,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.12 }),
    );
    mesh.add(wireframe);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x818cf8, 1.4);
    fillLight.position.set(-4, -2, 3);
    scene.add(fillLight);

    scene.add(new THREE.AmbientLight(0x1e293b, 1.1));

    let raf = 0;
    let angle = 0;

    const render = () => {
      if (!prefersReducedMotion) {
        angle += 0.0022;
        mesh.rotation.x = angle * 0.6;
        mesh.rotation.y = angle;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      geometry.dispose();
      material.dispose();
      wireframe.geometry.dispose();
      (wireframe.material as THREE.Material).dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [size, tone]);

  return <div ref={containerRef} className={className} style={{ width: size, height: size }} aria-hidden="true" />;
}
