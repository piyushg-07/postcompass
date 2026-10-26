import { useEffect, useRef } from "react";
import { accentRgb, useAccent } from "./theme";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Larger "database" nodes get a ring and a slow glow. */
  hub: boolean;
  phase: number;
  /** Time (s) the last pulse landed here, for a short flash. */
  litAt: number;
}

interface Pulse {
  from: number;
  to: number;
  t: number;
  speed: number;
}

const LINK_DISTANCE = 140;
const CURSOR_RADIUS = 180;

/**
 * Animated, interactive network: drifting database nodes, links between nearby ones, and accent-colored
 * pulses travelling along the links like queries. Nodes lean towards the cursor and link to it;
 * clicking sends a burst of pulses from the nearest database node.
 * Canvas-based, DPI-aware, paused when hidden, static for people who prefer reduced motion.
 */
export function DataNetwork({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let frame = 0;
    let last = performance.now();
    let sinceSpawn = 0;
    const cursor = { x: 0, y: 0, active: false, glow: 0 };
    // "r, g, b" of the accent; follows the color picked in Settings
    let accent = accentRgb();
    const unsubscribeAccent = useAccent.subscribe((s) => (accent = accentRgb(s.accent)));

    const seed = () => {
      const count = Math.round(
        Math.min(110, Math.max(36, (width * height) / 4200)),
      );
      nodes = Array.from({ length: count }, () => {
        const hub = Math.random() < 0.12;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.16,
          vy: (Math.random() - 0.5) * 0.16,
          r: hub ? 3.4 : 1.1 + Math.random() * 1.2,
          hub,
          phase: Math.random() * Math.PI * 2,
          litAt: -10,
        };
      });
      pulses = [];
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reduceMotion) draw(0);
    };

    const neighbours = (i: number) => {
      const out: number[] = [];
      const a = nodes[i]!;
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const b = nodes[j]!;
        if (Math.hypot(a.x - b.x, a.y - b.y) < LINK_DISTANCE) out.push(j);
      }
      return out;
    };

    const launch = (
      from: number,
      speed = 0.0007 + Math.random() * 0.0009,
    ) => {
      const options = neighbours(from);
      if (!options.length) return;
      pulses.push({
        from,
        to: options[Math.floor(Math.random() * options.length)]!,
        t: 0,
        speed,
      });
    };

    const spawnPulse = () => {
      // Pulses start at hubs most of the time, like queries leaving a database
      const hubs = nodes.map((n, i) => (n.hub ? i : -1)).filter((i) => i >= 0);
      launch(
        hubs.length && Math.random() < 0.7
          ? hubs[Math.floor(Math.random() * hubs.length)]!
          : Math.floor(Math.random() * nodes.length),
      );
    };

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, width, height);
      const time = performance.now() / 1000;
      cursor.glow +=
        ((cursor.active ? 1 : 0) - cursor.glow) * Math.min(1, dt * 0.008);

      // Soft light following the cursor
      if (cursor.glow > 0.01) {
        const light = ctx.createRadialGradient(
          cursor.x,
          cursor.y,
          0,
          cursor.x,
          cursor.y,
          CURSOR_RADIUS * 1.4,
        );
        light.addColorStop(0, `rgba(${accent}, ${0.12 * cursor.glow})`);
        light.addColorStop(1, `rgba(${accent}, 0)`);
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, width, height);
      }

      // Move: drift, a gentle pull towards the cursor, wrap at the edges
      for (const n of nodes) {
        if (cursor.glow > 0.01) {
          const dx = cursor.x - n.x;
          const dy = cursor.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d < CURSOR_RADIUS && d > 24) {
            const pull = (1 - d / CURSOR_RADIUS) * 0.0009 * cursor.glow;
            n.vx += dx * pull;
            n.vy += dy * pull;
          }
        }
        // Keep speeds calm so the pull never turns into a swarm
        const speed = Math.hypot(n.vx, n.vy);
        if (speed > 0.6) {
          n.vx *= 0.6 / speed;
          n.vy *= 0.6 / speed;
        }
        n.vx *= 0.995;
        n.vy *= 0.995;
        if (speed < 0.05) {
          n.vx += (Math.random() - 0.5) * 0.02;
          n.vy += (Math.random() - 0.5) * 0.02;
        }
        n.x += n.vx * dt * 0.06;
        n.y += n.vy * dt * 0.06;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }

      // Links between nodes, brighter near the cursor
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > LINK_DISTANCE) continue;
          const near =
            cursor.glow *
            Math.max(
              0,
              1 -
                Math.hypot(
                  (a.x + b.x) / 2 - cursor.x,
                  (a.y + b.y) / 2 - cursor.y,
                ) /
                  CURSOR_RADIUS,
            );
          ctx.strokeStyle = `rgba(${accent}, ${(1 - d / LINK_DISTANCE) * (0.22 + near * 0.5)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // The cursor joins the network
      if (cursor.glow > 0.01) {
        for (const n of nodes) {
          const d = Math.hypot(n.x - cursor.x, n.y - cursor.y);
          if (d > CURSOR_RADIUS * 0.75) continue;
          ctx.strokeStyle = `rgba(${accent}, ${(1 - d / (CURSOR_RADIUS * 0.75)) * 0.55 * cursor.glow})`;
          ctx.beginPath();
          ctx.moveTo(cursor.x, cursor.y);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(${accent}, ${0.9 * cursor.glow})`;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pulses travelling along links, with a short fading trail
      for (const p of pulses) {
        const a = nodes[p.from]!;
        const b = nodes[p.to]!;
        p.t += p.speed * dt;
        for (let k = 0; k < 7; k++) {
          const t = Math.max(0, Math.min(1, p.t) - k * 0.03);
          ctx.fillStyle = `rgba(${accent}, ${(1 - k / 7) * 0.95})`;
          ctx.beginPath();
          ctx.arc(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t,
            2 - k * 0.24,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      // A pulse that arrives lights up its node and often hops onward
      pulses = pulses.flatMap((p) => {
        if (p.t < 1) return [p];
        nodes[p.to]!.litAt = time;
        if (Math.random() < 0.6) {
          const next = neighbours(p.to).filter((j) => j !== p.from);
          if (next.length)
            return [
              {
                from: p.to,
                to: next[Math.floor(Math.random() * next.length)]!,
                t: 0,
                speed: p.speed,
              },
            ];
        }
        return [];
      });

      // Nodes
      for (const n of nodes) {
        const flash = Math.max(0, 1 - (time - n.litAt) * 2.5);
        if (n.hub) {
          const breathe = 0.5 + 0.5 * Math.sin(time * 1.4 + n.phase);
          const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 22);
          glow.addColorStop(
            0,
            `rgba(${accent}, ${0.2 + breathe * 0.15 + flash * 0.35})`,
          );
          glow.addColorStop(1, `rgba(${accent}, 0)`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(${accent}, ${0.6 + flash * 0.4})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 4 + breathe, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        ctx.fillStyle =
          n.hub || flash > 0
            ? `rgba(${accent}, ${0.8 + flash * 0.2})`
            : "rgba(237, 237, 237, 0.55)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + flash * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      sinceSpawn += dt;
      if (sinceSpawn > 240 && pulses.length < 26) {
        sinceSpawn = 0;
        spawnPulse();
      }
      draw(dt);
      frame = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      cursor.x = e.clientX - rect.left;
      cursor.y = e.clientY - rect.top;
      cursor.active = true;
    };
    const onLeave = () => {
      cursor.active = false;
    };
    // A click fires a burst from the nearest database node
    const onClick = (e: PointerEvent) => {
      onMove(e);
      let best = -1;
      let bestDistance = Infinity;
      nodes.forEach((n, i) => {
        const d =
          Math.hypot(n.x - cursor.x, n.y - cursor.y) * (n.hub ? 0.6 : 1);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      });
      if (best < 0) return;
      nodes[best]!.litAt = performance.now() / 1000;
      for (let k = 0; k < 6; k++) launch(best, 0.0016 + Math.random() * 0.001);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onClick);

    const start = () => {
      if (reduceMotion || frame) return;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      unsubscribeAccent();
      observer.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
