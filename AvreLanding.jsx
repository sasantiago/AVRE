// AVRE Capital Group — Landing de embudo (CTA único a WhatsApp)
// Estilo: glassmorphism sobre paleta slate + indigo
// Paleta: #0F172A base · #1E293B superficie · #64748B muted · #6366F1 acento · #F8FAFC texto

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// WhatsApp de AVRE Capital Group: +57 320 8284255
const WHATSAPP = "https://wa.me/573208284255?text=Hola%2C%20quiero%20ser%20AVREan";
// COPY: apuntar a la URL real del panel de AVREans
const LOGIN_URL = "/login";

const GLASS =
  "bg-slate-800/45 backdrop-blur-xl border border-slate-50/10 rounded-2xl shadow-xl shadow-slate-900/40 transition-all duration-300 hover:border-indigo-500/40 hover:-translate-y-1 hover:shadow-2xl";

const NAV = [
  { href: "#solucion", label: "Ecosistema" },
  { href: "#vision", label: "Visión" },
  { href: "#valores", label: "Valores" },
  { href: "#faq", label: "Preguntas" },
];

const benefits = [
  { icon: "◈", title: "Transparencia inteligente", desc: "Acceso permanente a datos reales del desempeño de tus fondos, no reportes retrasados." },
  { icon: "◇", title: "Diversificación real", desc: "Estrategias en Forex, criptomonedas, acciones y otros activos, alineadas a tu perfil." },
  { icon: "◆", title: "Seguridad como principio", desc: "Estándares tecnológicos y operativos que protegen tu patrimonio y tu información." },
  { icon: "◉", title: "Acompañamiento permanente", desc: "Un espacio financiero personalizado, no un tablero genérico sin contexto." },
];

const values = [
  { title: "Integridad radical", desc: "Decisiones éticas, coherentes y verificables, incluso cuando nadie está observando." },
  { title: "Transparencia inteligente", desc: "Información financiera convertida en conocimiento claro, oportuno y comprensible." },
  { title: "Excelencia e innovación", desc: "Nos anticipamos a los mercados en lugar de solo seguir su evolución." },
  { title: "Seguridad como principio", desc: "Estándares que evolucionan al ritmo de los desafíos del entorno digital." },
  { title: "Crecimiento compartido", desc: "Crecemos junto a cada AVREan, con decisiones responsables y sostenibles." },
  { title: "Cercanía humana", desc: "Relaciones construidas sobre la escucha, el respeto y el acompañamiento real." },
  { title: "Disciplina financiera", desc: "Análisis, gestión del riesgo y visión estratégica de largo plazo, no azar." },
  { title: "Impacto con propósito", desc: "Buscamos bienestar y libertad financiera, no únicamente rentabilidad." },
];

const faqs = [
  { q: "¿Qué es AVRE Capital Group?", a: "Un ecosistema inteligente de gestión, administración y diversificación de capital que acompaña a cada AVREan con tecnología, análisis de mercados y estrategia." },
  { q: "¿En qué mercados puedo participar?", a: "Forex, criptomonedas, acciones y otros activos financieros globales, en estrategias diversificadas alineadas a tu perfil y tus objetivos." },
  { q: "¿Quién puede unirse?", a: "Personas mayores de 18 años que buscan una alternativa moderna, segura y transparente para gestionar y diversificar su capital." },
  { q: "¿Cómo veo qué pasa con mi capital?", a: "Cada AVREan tiene un espacio financiero personalizado con monitoreo en tiempo real de sus movimientos y reportes detallados." },
  { q: "¿Cómo empiezo?", a: "Escribinos por WhatsApp: conversamos sobre tu perfil y objetivos, y te acompañamos en el proceso para convertirte en AVREan." },
];

/* ---------------- Iconos ---------------- */
const ArrowRight = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const LoginIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);
const ArrowUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
  </svg>
);
const WhatsAppIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.79-1.68-2.09-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.19-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.09 3.31 5.07 4.5.71.3 1.26.48 1.69.62.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38c1.45.79 3.08 1.2 4.75 1.2h.01c5.46 0 9.91-4.45 9.91-9.91C21.92 6.45 17.5 2 12.04 2zm0 18.02c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.09 8.09 0 0 1-1.24-4.3c0-4.47 3.64-8.1 8.11-8.1 2.17 0 4.2.84 5.73 2.38a8.03 8.03 0 0 1 2.38 5.73c0 4.47-3.64 8.11-8.09 8.11z" />
  </svg>
);

/* ---------------- Piezas reutilizables ---------------- */
function Brand() {
  return (
    <a href="#top" className="group flex items-center gap-2.5" aria-label="AVRE Capital Group — inicio">
      {/* COPY: reemplazar por el logo real cuando esté listo */}
      <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-500 text-[15px] font-bold text-white shadow-lg shadow-indigo-500/40 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
        A
      </div>
      <span className="flex flex-col leading-none">
        <strong className="text-[15px] font-bold tracking-tight">AVRE</strong>
        <span className="mt-0.5 text-[10.5px] uppercase tracking-[0.1em] text-slate-500">Capital Group</span>
      </span>
    </a>
  );
}

function CtaButton({ children = "Quiero ser AVREan", className = "" }) {
  return (
    <a
      href={WHATSAPP}
      target="_blank"
      rel="noopener"
      className={`group inline-flex items-center gap-2.5 rounded-full bg-indigo-500 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/40 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-600 hover:shadow-xl hover:shadow-indigo-500/60 sm:text-lg ${className}`}
    >
      {children}
      <span className="transition-transform duration-300 group-hover:translate-x-1">
        <ArrowRight />
      </span>
    </a>
  );
}

function CtaNote({ text = "Te respondemos por WhatsApp · Sin compromiso" }) {
  return <span className="mt-3.5 block text-xs text-slate-500">{text}</span>;
}

function Reveal({ children, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setVisible(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------------- Visualización 3D del mercado (Three.js) ---------------- */
/* Velas que entran por la derecha, suben/bajan y se recalibran solas.
   Decorativa: no representa datos de mercado reales. */
function MarketScene() {
  const mountRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---------- Configuración ----------
    const N = window.innerWidth < 700 ? 20 : 30; // cantidad de velas
    const SPACING = 0.62;
    const BODY_W = 0.3;
    const TICK_MS = 950; // cada cuánto entra una vela nueva
    const UP = 0x818cf8; // indigo — sube
    const DOWN = 0xfb7185; // rosa — baja
    const RANGE_Y = 1.55;

    // ---------- Escena ----------
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    const camBase = new THREE.Vector3(0, 1.5, 9.4);
    camera.position.copy(camBase);
    camera.lookAt(0, 0.35, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const key = new THREE.DirectionalLight(0xc7d2fe, 0.95);
    key.position.set(-3, 6, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6366f1, 0.75);
    rim.position.set(5, -2, -4);
    scene.add(rim);

    const group = new THREE.Group();
    group.rotation.y = -0.2;
    group.rotation.x = 0.06;
    scene.add(group);

    // Piso de rejilla
    const grid = new THREE.GridHelper(26, 26, 0x6366f1, 0x6366f1);
    grid.material.transparent = true;
    grid.material.opacity = 0.07;
    grid.position.y = -2.15;
    group.add(grid);

    // Partículas de ambiente
    const pCount = 220;
    const pPos = new Float32Array(pCount * 3);
    for (let p = 0; p < pCount; p++) {
      pPos[p * 3] = (Math.random() - 0.5) * 22;
      pPos[p * 3 + 1] = (Math.random() - 0.5) * 9;
      pPos[p * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0xa5b4fc, size: 0.035, transparent: true, opacity: 0.5, depthWrite: false });
    const dust = new THREE.Points(pGeo, dustMat);
    group.add(dust);

    // Materiales
    const mat = (color) =>
      new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.28,
        roughness: 0.34, metalness: 0.18, transparent: true, opacity: 0.9,
      });
    const upMat = mat(UP);
    const downMat = mat(DOWN);
    const wickMat = new THREE.MeshBasicMaterial({ color: 0xc7d2fe, transparent: true, opacity: 0.34 });

    // ---------- Serie de precios (caminata aleatoria con leve sesgo alcista) ----------
    let price = 100;
    const nextCandle = () => {
      const open = price;
      const move = (Math.random() - 0.5) * 5.2 + 0.16;
      const close = open + move;
      const w = Math.abs(move) * (0.5 + Math.random() * 0.9) + 0.5;
      price = close;
      return { open, close, high: Math.max(open, close) + w * 0.6, low: Math.min(open, close) - w * 0.6 };
    };

    // ---------- Velas ----------
    const bodyGeo = new THREE.BoxGeometry(BODY_W, 1, BODY_W);
    const wickGeo = new THREE.BoxGeometry(0.035, 1, 0.035);
    const candles = [];
    for (let i = 0; i < N; i++) {
      const d = nextCandle();
      const body = new THREE.Mesh(bodyGeo, d.close >= d.open ? upMat : downMat);
      const wick = new THREE.Mesh(wickGeo, wickMat);
      group.add(body);
      group.add(wick);
      candles.push({ body, wick, data: d, x: 0, tx: 0, sy: 0.01, ty: 0.01, py: 0, tpy: 0, wy: 0.01, twy: 0.01, wpy: 0, twpy: 0 });
    }

    // Línea de cierres
    const linePos = new Float32Array(N * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    const trendMat = new THREE.LineBasicMaterial({ color: 0xa5b4fc, transparent: true, opacity: 0.55 });
    const trend = new THREE.Line(lineGeo, trendMat);
    group.add(trend);

    // ---------- Mapeo precio → mundo ----------
    let vMin = 0, vMax = 1, smMin = null, smMax = null;
    const recalcRange = () => {
      vMin = Infinity; vMax = -Infinity;
      for (const c of candles) {
        if (c.data.low < vMin) vMin = c.data.low;
        if (c.data.high > vMax) vMax = c.data.high;
      }
      if (smMin === null) { smMin = vMin; smMax = vMax; }
    };
    const toY = (v) => ((v - smMin) / Math.max(smMax - smMin, 1e-4) - 0.5) * (RANGE_Y * 2);

    const assignTargets = () => {
      candles.forEach((c, k) => {
        const d = c.data;
        c.tx = (k - (N - 1) / 2) * SPACING;
        const yo = toY(d.open), yc = toY(d.close), yh = toY(d.high), yl = toY(d.low);
        c.ty = Math.max(Math.abs(yc - yo), 0.045);
        c.tpy = (yo + yc) / 2;
        c.twy = Math.max(yh - yl, 0.06);
        c.twpy = (yh + yl) / 2;
        c.body.material = d.close >= d.open ? upMat : downMat;
      });
    };

    recalcRange();
    assignTargets();
    candles.forEach((c) => {
      c.x = c.tx;
      c.body.position.x = c.tx;
      c.wick.position.x = c.tx;
      c.py = c.tpy;
      c.wpy = c.twpy;
    });

    // Entra una vela nueva, se recicla la más vieja
    const tick = () => {
      const r = candles.shift();
      r.data = nextCandle();
      r.sy = 0.01; r.wy = 0.01; // nace plana y crece
      r.x = ((N - 1) / 2) * SPACING + SPACING;
      r.body.position.x = r.x;
      r.wick.position.x = r.x;
      candles.push(r);
      recalcRange();
      assignTargets();
    };

    // ---------- Parallax con el mouse ----------
    let mx = 0, my = 0, cmx = 0, cmy = 0;
    const onMouse = (e) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    // ---------- Loop ----------
    const lerp = (a, b, t) => a + (b - a) * t;
    let last = performance.now(), acc = 0, running = true, raf = null;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!running) return;

      acc += Math.min(now - last, 60);
      last = now;
      if (acc >= TICK_MS) { acc = 0; tick(); }

      smMin = lerp(smMin, vMin, 0.05);
      smMax = lerp(smMax, vMax, 0.05);
      assignTargets();

      candles.forEach((c, k) => {
        c.x = lerp(c.x, c.tx, 0.1);
        c.sy = lerp(c.sy, c.ty, 0.13);
        c.py = lerp(c.py, c.tpy, 0.13);
        c.wy = lerp(c.wy, c.twy, 0.13);
        c.wpy = lerp(c.wpy, c.twpy, 0.13);

        c.body.position.set(c.x, c.py, 0);
        c.body.scale.y = c.sy;
        c.wick.position.set(c.x, c.wpy, 0);
        c.wick.scale.y = c.wy;

        // la última vela late (mercado "vivo")
        if (k === candles.length - 1) {
          c.body.material.emissiveIntensity = 0.34 + Math.sin(now * 0.006) * 0.16;
        }

        linePos[k * 3] = c.x;
        linePos[k * 3 + 1] = c.py + (c.sy / 2) * (c.data.close >= c.data.open ? 1 : -1);
        linePos[k * 3 + 2] = 0.22;
      });
      trend.geometry.attributes.position.needsUpdate = true;

      dust.rotation.y += 0.0004;

      cmx = lerp(cmx, mx, 0.045);
      cmy = lerp(cmy, my, 0.045);
      camera.position.x = camBase.x + cmx * 0.85;
      camera.position.y = camBase.y - cmy * 0.45;
      camera.lookAt(0, 0.35, 0);

      renderer.render(scene, camera);
    };

    // ---------- Resize ----------
    const resize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || 520;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camBase.z = w < 700 ? 12.6 : 9.4; // alejar en pantallas angostas
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);
    resize();
    setReady(true);

    // ---------- Arranque / pausa ----------
    let io = null;
    const onVisibility = () => { running = !document.hidden; last = performance.now(); };

    if (reduced) {
      // Sin movimiento: se deja el gráfico estático
      for (let s = 0; s < 90; s++) {
        candles.forEach((c, q) => {
          c.sy = lerp(c.sy, c.ty, 0.2); c.py = lerp(c.py, c.tpy, 0.2);
          c.wy = lerp(c.wy, c.twy, 0.2); c.wpy = lerp(c.wpy, c.twpy, 0.2);
          c.body.position.set(c.tx, c.py, 0); c.body.scale.y = c.sy;
          c.wick.position.set(c.tx, c.wpy, 0); c.wick.scale.y = c.wy;
          linePos[q * 3] = c.tx; linePos[q * 3 + 1] = c.py; linePos[q * 3 + 2] = 0.22;
        });
      }
      trend.geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(frame);
      if ("IntersectionObserver" in window) {
        io = new IntersectionObserver(
          (entries) => { running = entries[0].isIntersecting; last = performance.now(); },
          { threshold: 0.02 }
        );
        io.observe(mount);
      }
      document.addEventListener("visibilitychange", onVisibility);
    }

    // ---------- Limpieza ----------
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (io) io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      document.removeEventListener("visibilitychange", onVisibility);
      [bodyGeo, wickGeo, pGeo, lineGeo].forEach((g) => g.dispose());
      [upMat, downMat, wickMat, dustMat, trendMat, grid.material].forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className={`pointer-events-none absolute left-1/2 top-0 -z-10 h-[calc(100%+60px)] w-screen -translate-x-1/2 transition-opacity duration-[1400ms] ${
        ready ? "opacity-100" : "opacity-0"
      } [mask-image:linear-gradient(to_bottom,transparent_0%,#000_34%,#000_72%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,#000_34%,#000_72%,transparent_100%)]`}
    />
  );
}

function Fab({ children, label, onClick, href, tone = "glass" }) {
  const base =
    "grid h-[54px] w-[54px] place-items-center rounded-full border shadow-xl transition-all duration-300 hover:-translate-y-1 hover:scale-105";
  const styles =
    tone === "wa"
      ? "border-white/20 bg-[#25D366] text-slate-900 shadow-[#25D366]/40"
      : "border-slate-50/10 bg-slate-800/70 text-slate-50 shadow-slate-900/50 backdrop-blur-lg";

  const inner = (
    <span className="group relative flex items-center">
      <span className="pointer-events-none absolute right-[66px] whitespace-nowrap rounded-full border border-slate-50/10 bg-slate-900/90 px-3.5 py-2 text-xs text-slate-50 opacity-0 backdrop-blur-md transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 translate-x-2">
        {label}
      </span>
      <span className={`${base} ${styles}`}>{children}</span>
    </span>
  );

  return href ? (
    <a href={href} target="_blank" rel="noopener" aria-label={label}>{inner}</a>
  ) : (
    <button type="button" onClick={onClick} aria-label={label}>{inner}</button>
  );
}

/* ---------------- Componente principal ---------------- */
export default function AvreLanding() {
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      setShowTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-900 font-sans leading-relaxed text-slate-50 antialiased">
      {/* Halos de color detrás del glass */}
      <div className="pointer-events-none fixed -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-indigo-500/25 blur-[120px]" />
      <div className="pointer-events-none fixed -bottom-40 -right-28 h-[460px] w-[460px] rounded-full bg-indigo-500/15 blur-[120px]" />

      {/* ==================== HEADER ==================== */}
      <header
        className={`fixed inset-x-0 top-0 z-[100] flex h-[68px] items-center transition-all duration-300 ${
          scrolled ? "border-b border-slate-50/10 bg-slate-900/75 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-5 px-6">
          <Brand />

          {/* Nav: solo anclas internas para no sacar al visitante de la página */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Secciones">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="group relative rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-50/5 hover:text-slate-50"
              >
                {n.label}
                <span className="absolute inset-x-3 bottom-1 h-[1.5px] origin-left scale-x-0 rounded bg-indigo-500 transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            <a
              href={LOGIN_URL}
              className="inline-flex items-center gap-2 rounded-full border border-slate-50/10 bg-slate-800/45 px-4 py-2.5 text-sm text-slate-300 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:text-slate-50"
            >
              <LoginIcon />
              Iniciar sesión
            </a>
            <a
              href="#cta"
              className="inline-flex items-center rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/35 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-600 hover:shadow-indigo-500/55"
            >
              Quiero ser AVREan
            </a>
          </div>

          {/* Hamburguesa */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-50/10 bg-slate-800/45 backdrop-blur-md md:hidden"
          >
            <span className="relative block h-[1.6px] w-[17px]">
              <span className={`absolute left-0 block h-[1.6px] w-[17px] bg-slate-50 transition-all duration-300 ${menuOpen ? "top-0 rotate-45" : "-top-[5.5px]"}`} />
              <span className={`absolute left-0 top-0 block h-[1.6px] w-[17px] bg-slate-50 transition-opacity duration-200 ${menuOpen ? "opacity-0" : "opacity-100"}`} />
              <span className={`absolute left-0 block h-[1.6px] w-[17px] bg-slate-50 transition-all duration-300 ${menuOpen ? "top-0 -rotate-45" : "top-[5.5px]"}`} />
            </span>
          </button>
        </div>
      </header>

      {/* Panel mobile */}
      <div
        className={`fixed inset-x-0 top-[68px] z-[99] flex flex-col gap-1.5 border-b border-slate-50/10 bg-slate-900/95 px-6 pb-6 pt-4 backdrop-blur-xl transition-all duration-300 md:hidden ${
          menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
        }`}
      >
        {NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            onClick={() => setMenuOpen(false)}
            className="border-b border-slate-50/5 py-3 text-[15px] text-slate-300 transition-all duration-200 hover:pl-2.5 hover:text-slate-50"
          >
            {n.label}
          </a>
        ))}
        <div className="mt-3.5 flex flex-col gap-2.5">
          <a href={LOGIN_URL} className="rounded-full border border-slate-50/10 bg-slate-800/45 py-3 text-center text-sm text-slate-300 backdrop-blur-md">
            Iniciar sesión
          </a>
          <a href="#cta" onClick={() => setMenuOpen(false)} className="rounded-full bg-indigo-500 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-500/35">
            Quiero ser AVREan
          </a>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6">
        {/* ==================== HERO ==================== */}
        <section id="top" className="relative pb-20 pt-[152px] text-center">
          {/* Visualización 3D del mercado (decorativa) */}
          <MarketScene />
          <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-slate-50/10 bg-slate-800/45 px-4 py-2 text-xs text-slate-300 backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Ecosistema financiero para AVREans · +18 años
          </span>
          {/* COPY: Headline principal */}
          <h1 className="mx-auto mb-5 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Tu capital, gestionado con{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-indigo-500 to-indigo-300 bg-clip-text text-transparent">
              inteligencia, transparencia
            </span>{" "}
            y acompañamiento real
          </h1>
          {/* COPY: Subheadline — qué es, para quién, qué resuelve */}
          <p className="mx-auto mb-10 max-w-xl text-lg text-slate-400">
            AVRE Capital Group es un ecosistema inteligente de gestión, administración y diversificación de
            capital para mayores de 18 años, con acceso en tiempo real a Forex, criptomonedas, acciones y otros
            activos financieros.
          </p>
          <CtaButton />
          <CtaNote />
          <span className="mt-7 block text-[11px] tracking-wide text-slate-600">
            Visualización ilustrativa · no representa datos de mercado en vivo
          </span>
        </section>

        <main>
          {/* ==================== PROBLEMA ==================== */}
          <Reveal>
            <section className="py-16 text-center">
              <h2 className="mx-auto mb-3.5 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
                Invertir sin claridad ni acompañamiento genera más dudas que resultados
              </h2>
              <p className="mx-auto max-w-xl text-slate-400">
                Información que llega tarde, plataformas frías que no explican nada y acceso limitado a
                mercados diversificados: así se ve gestionar tu capital sin un ecosistema que trabaje con vos.
              </p>
            </section>
          </Reveal>

          {/* ==================== SOLUCIÓN ==================== */}
          <Reveal>
            <section id="solucion" className="py-16">
              <h2 className="mb-3.5 text-center text-2xl font-bold tracking-tight sm:text-3xl">
                Un ecosistema diseñado para acompañarte, no solo para ejecutar
              </h2>
              <p className="mx-auto mb-12 max-w-xl text-center text-slate-400">
                AVRE Capital Group combina tecnología, análisis de mercados y acompañamiento estratégico para
                que cada AVREan (aliado) construya, haga crecer y proteja su capital con información clara y
                libertad para decidir.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {benefits.map((b) => (
                  <article key={b.title} className={`${GLASS} group p-6`}>
                    <div className="mb-3.5 grid h-9 w-9 place-items-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-sm text-indigo-300 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-indigo-500/25">
                      {b.icon}
                    </div>
                    <h3 className="mb-1.5 font-semibold">{b.title}</h3>
                    <p className="text-sm text-slate-400">{b.desc}</p>
                  </article>
                ))}
              </div>
            </section>
          </Reveal>

          {/* ==================== VISIÓN ==================== */}
          <Reveal>
            <section id="vision" className="py-16">
              <div className={`${GLASS} px-8 py-12 text-center sm:px-11`}>
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-300">
                  Nuestra visión
                </p>
                <blockquote className="mx-auto max-w-xl text-xl font-medium leading-relaxed tracking-tight sm:text-2xl">
                  Liderar la nueva generación de gestión financiera digital en Latinoamérica, donde invertir
                  deje de ser un privilegio para convertirse en una experiencia inteligente, transparente y
                  accesible.
                </blockquote>
              </div>
            </section>
          </Reveal>

          {/* ==================== VALORES ==================== */}
          <Reveal>
            <section id="valores" className="py-16">
              <h2 className="mb-3.5 text-center text-2xl font-bold tracking-tight sm:text-3xl">
                Los principios que sostienen cada decisión
              </h2>
              <p className="mx-auto mb-12 max-w-xl text-center text-slate-400">
                No son frases de pared: son el criterio con el que gestionamos tu capital todos los días.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {values.map((v) => (
                  <article key={v.title} className={`${GLASS} p-6`}>
                    <h3 className="mb-1.5 text-sm font-semibold">{v.title}</h3>
                    <p className="text-sm text-slate-400">{v.desc}</p>
                  </article>
                ))}
              </div>
            </section>
          </Reveal>

          {/* ==================== FAQ ==================== */}
          <Reveal>
            <section id="faq" className="py-16">
              <h2 className="mb-3.5 text-center text-2xl font-bold tracking-tight sm:text-3xl">
                Preguntas frecuentes
              </h2>
              <p className="mx-auto mb-12 max-w-xl text-center text-slate-400">
                Lo que la mayoría de los AVREans pregunta antes de empezar.
              </p>
              <div className="grid gap-3">
                {faqs.map((f) => (
                  <article key={f.q} className={`${GLASS} px-6 py-5`}>
                    <h3 className="mb-1.5 font-semibold">{f.q}</h3>
                    <p className="text-sm text-slate-400">{f.a}</p>
                  </article>
                ))}
              </div>
            </section>
          </Reveal>

          {/* ==================== CTA FINAL ==================== */}
          <Reveal>
            <section id="cta" className="py-16">
              <div className={`${GLASS} px-8 py-16 text-center sm:px-10`}>
                <h2 className="mb-3.5 text-2xl font-bold tracking-tight sm:text-3xl">
                  Empezá a construir tu libertad financiera
                </h2>
                <p className="mx-auto mb-8 max-w-md text-slate-400">
                  Detrás de cada cuenta hay un proyecto de vida. Escribinos y te contamos cómo funciona AVRE
                  Capital Group — o coordinamos una llamada si preferís hablarlo en vivo.
                </p>
                <CtaButton />
                <CtaNote text="Respuesta por WhatsApp · Sin compromiso" />
              </div>
            </section>
          </Reveal>
        </main>
      </div>

      {/* ==================== FOOTER ==================== */}
      <footer className="relative z-10 mt-10 border-t border-slate-50/10 bg-slate-800/30 pb-8 pt-14 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid grid-cols-1 gap-10 border-b border-slate-50/10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Brand />
              <p className="mt-3.5 max-w-xs text-[13.5px] text-slate-400">
                Ecosistema inteligente de gestión, administración y diversificación de capital. Construimos
                confianza, no solo resultados.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-slate-50">Ecosistema</h4>
              {[
                { href: "#solucion", label: "Cómo funciona" },
                { href: "#vision", label: "Nuestra visión" },
                { href: "#valores", label: "Nuestros valores" },
                { href: "#faq", label: "Preguntas frecuentes" },
              ].map((l) => (
                <a key={l.href} href={l.href} className="block py-1.5 text-[13.5px] text-slate-400 transition-all duration-200 hover:translate-x-1 hover:text-slate-50">
                  {l.label}
                </a>
              ))}
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-slate-50">AVREans</h4>
              {/* COPY: apuntar a las URLs reales cuando existan */}
              {[
                { href: LOGIN_URL, label: "Iniciar sesión" },
                { href: WHATSAPP, label: "Contacto por WhatsApp" },
                { href: "/terminos", label: "Términos y condiciones" },
                { href: "/privacidad", label: "Política de privacidad" },
              ].map((l) => (
                <a key={l.label} href={l.href} className="block py-1.5 text-[13.5px] text-slate-400 transition-all duration-200 hover:translate-x-1 hover:text-slate-50">
                  {l.label}
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-5 pt-6 text-xs text-slate-500">
            <p>© 2026 AVRE Capital Group. Todos los derechos reservados.</p>
            <div className="flex gap-2.5">
              {/* COPY: reemplazar # por los perfiles reales */}
              {["IG", "IN", "X"].map((s) => (
                <a
                  key={s}
                  href="#"
                  aria-label={s}
                  className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-slate-50/10 bg-slate-800/45 text-[11px] text-slate-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:text-slate-50"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-center text-[11.5px] leading-relaxed text-slate-500">
            Invertir en Forex, criptomonedas y otros activos financieros implica riesgo, incluida la posible
            pérdida total del capital. Los resultados pasados no garantizan resultados futuros. La información
            de esta página es de carácter general y no constituye asesoría financiera individualizada.
          </p>
        </div>
      </footer>

      {/* ==================== BOTONES FLOTANTES ==================== */}
      <div className="fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-3">
        <div className={`transition-all duration-300 ${showTop ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <Fab label="Volver arriba" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <ArrowUp />
          </Fab>
        </div>
        <Fab label="Escribinos por WhatsApp" href={WHATSAPP} tone="wa">
          <WhatsAppIcon />
        </Fab>
      </div>
    </div>
  );
}
