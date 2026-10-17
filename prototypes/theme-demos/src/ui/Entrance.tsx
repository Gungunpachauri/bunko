import { motion } from "motion/react";
import { useState } from "react";
import type { Theme } from "../themes/types";

/**
 * Shared entrance: the theme draws the facade and door leaves; this component
 * opens the doors (slide or swing) and then glides the "camera" through them.
 */
export function Entrance({ theme, onEntered, reduced }: { theme: Theme; onEntered: () => void; reduced: boolean }) {
  const [opening, setOpening] = useState(false);
  const { Facade, FacadeFront, Door, door, insideGlow, title, hint } = theme.entrance;

  const leaf = (side: "left" | "right") => {
    const sign = side === "left" ? -1 : 1;
    const animate = !opening
      ? {}
      : door === "slide"
        ? { x: sign * 176 }
        : { scaleX: 0.08, skewY: sign * -6 };
    return (
      <motion.g
        initial={false}
        animate={animate}
        transition={{ duration: reduced ? 0 : 1.1, ease: [0.65, 0, 0.35, 1] }}
        style={{ transformBox: "fill-box", transformOrigin: side === "left" ? "left center" : "right center" }}
      >
        <g transform={`translate(${side === "left" ? 620 : 800} 300)`}>
          <Door side={side} />
        </g>
      </motion.g>
    );
  };

  return (
    <motion.div
      className="entrance"
      initial={false}
      animate={opening ? { scale: reduced ? 1 : 2.8, opacity: 0 } : { scale: 1, opacity: 1 }}
      transition={opening ? { duration: reduced ? 0.3 : 1.2, delay: reduced ? 0 : 0.9, ease: [0.5, 0, 0.75, 0] } : { duration: 0.5 }}
      style={{ transformOrigin: "50% 60%" }}
      onAnimationComplete={() => opening && onEntered()}
    >
      <div className="entrance-art">
        <Facade />
      </div>
      <svg className="entrance-doors" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="inside-glow" cx="0.5" cy="0.55" r="0.7">
            <stop offset="0" stopColor="#fff8e8" />
            <stop offset="0.5" stopColor={insideGlow} />
            <stop offset="1" stopColor={insideGlow} stopOpacity={0.6} />
          </radialGradient>
        </defs>
        <rect x={620} y={300} width={360} height={480} fill="url(#inside-glow)" />
        <g style={{ clipPath: "inset(0)" }}>
          {leaf("left")}
          {leaf("right")}
        </g>
        {FacadeFront && <FacadeFront />}
      </svg>
      <div className="entrance-ui">
        <h1>{title}</h1>
        <p>{theme.tagline}</p>
        <button className="enter-btn" onClick={() => setOpening(true)} disabled={opening} autoFocus>
          Enter
        </button>
        <span className="entrance-hint">{hint}</span>
      </div>
    </motion.div>
  );
}
