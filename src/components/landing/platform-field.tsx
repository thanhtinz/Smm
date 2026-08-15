"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PlatformMark from "@/components/platform-mark";
import type { PlatformLine } from "@/lib/landing";

/**
 * The platforms, scattered across the hero and shy of the pointer.
 *
 * A row of logos says the panel covers them. A field of them that moves says
 * it too, and gives the reader something to do on a page whose only other
 * control is a button — which is the whole reason this shape keeps appearing
 * on landings in this market.
 *
 * Three rules make it behave rather than fidget:
 *
 * Positions are a pure function of the index, not Math.random, so the server
 * and the browser draw the same field and React has nothing to complain
 * about. They live in the two gutters either side of the text, never across
 * it — a logo drifting over a headline is a defect, not an effect.
 *
 * The pointer pushes; it does not drag. A mark inside the radius is offset
 * along the vector away from the cursor, in proportion to how close it is,
 * and eases home the moment the cursor leaves. Nothing is ever left where the
 * reader put it by accident.
 *
 * And a tap sends one somewhere else, because on a touch screen there is no
 * cursor to be shy of, and the whole thing would otherwise be a still image.
 */

/**
 * Where one mark sits, from its index alone — never Math.random, so the
 * server and the browser draw the same field and hydration has nothing to
 * complain about.
 *
 * The height is dealt out in lanes rather than scattered freely. Free
 * scatter in a gutter one fifth of the page wide puts two marks on top of
 * each other about as often as not, and a hidden logo is worse than a tidy
 * one: the first draft had Instagram entirely behind TikTok. Each side gets
 * its own lanes, and the noise only jitters within one.
 */
function slot(i: number, total: number, salt = 0) {
  const noise = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const left = i % 2 === 0;
  const lanes = Math.max(1, Math.ceil(total / 2));
  const lane = Math.floor(i / 2);
  const laneHeight = 88 / lanes;

  // Two gutters, each a fifth of the width, kept clear of the centre column.
  const x = left ? 3 + noise(i * 2.7 + salt) * 18 : 79 + noise(i * 3.1 + salt) * 18;
  // Inside its own lane, with room at the edges so neighbours never touch.
  const y = 6 + lane * laneHeight + laneHeight * (0.2 + noise(i * 5.3 + salt + 9) * 0.6);

  return { x, y, size: 40 + Math.round(noise(i * 7.7 + salt) * 22) };
}

export default function PlatformField({ platforms }: { platforms: PlatformLine[] }) {
  const box = useRef<HTMLDivElement>(null);
  const marks = useMemo(() => platforms.slice(0, 10), [platforms]);

  // Which slot each mark is currently in. A tap moves one along; everything
  // starts on its own index, which is what the server rendered.
  const [salts, setSalts] = useState<number[]>(() => marks.map(() => 0));
  const [push, setPush] = useState<{ x: number; y: number } | null>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setStill(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || still) return;

    // On the window, not on the field. The field is a transparent sheet the
    // reader never actually touches — the headline sits over most of it and
    // swallows the events — so listening there meant a cursor could pass
    // straight through a mark without it noticing. Nothing moved at all.
    //
    // Percentages rather than pixels, so the maths matches the positions and
    // survives a resize without a second listener.
    const move = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      // Off the hero entirely: let them settle rather than react to a cursor
      // somewhere down the page.
      setPush(y < -10 || y > 110 ? null : { x, y });
    };

    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [still]);

  if (marks.length === 0) return null;

  return (
    // Above the content rather than behind it, so a mark can be tapped; the
    // sheet itself takes no pointer events, so nothing it covers is blocked.
    <div ref={box} aria-hidden className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
      {marks.map((platform, i) => {
        const { x, y, size } = slot(i, marks.length, salts[i] ?? 0);

        // How far this one has been shoved, and which way. The radius is in
        // the same percentage space as the positions, so it is an ellipse on
        // a wide hero rather than a circle — which is the shape the pointer
        // sweeps anyway.
        let dx = 0;
        let dy = 0;
        if (push && !still) {
          const ax = x - push.x;
          const ay = y - push.y;
          const distance = Math.hypot(ax, ay);
          const radius = 22;
          if (distance < radius && distance > 0.001) {
            const force = (1 - distance / radius) * 34;
            dx = (ax / distance) * force;
            dy = (ay / distance) * force;
          }
        }

        return (
          <button
            key={platform.id}
            type="button"
            tabIndex={-1}
            onPointerDown={() => {
              if (still) return;
              setSalts((all) => all.map((s, at) => (at === i ? s + 1 : s)));
            }}
            className="pointer-events-auto absolute cursor-pointer"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px)`,
              // Long enough to read as drifting rather than snapping, and the
              // ease brings it home without a bounce nobody asked for.
              transition: still ? undefined : "transform 620ms cubic-bezier(0.22, 1, 0.36, 1), left 700ms, top 700ms",
              opacity: 0.9,
            }}
          >
            <PlatformMark platform={platform} size={Math.round(size * 0.62)} box={size} />
          </button>
        );
      })}
    </div>
  );
}
