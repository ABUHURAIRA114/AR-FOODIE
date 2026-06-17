import React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        'auto-rotate-delay'?: string;
        'rotation-per-second'?: string;
        'shadow-intensity'?: string;
        'environment-image'?: string;
      };
    }
  }
}

export function HeroBurger() {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      zIndex: 1,
    }}>
      <model-viewer
        src="/src/assets/burger.glb"
        alt="Realistic burger"
        auto-rotate
        auto-rotate-delay="0"
        rotation-per-second="20deg"
        shadow-intensity="1"
        environment-image="neutral"
        style={{
          width: "500px",
          height: "500px",
          opacity: 0.85,
          filter: "drop-shadow(0 0 60px rgba(22,99,235,0.3))",
          pointerEvents: "none",
          background: "transparent",
          "--poster-color": "transparent",
        } as React.CSSProperties}
      />
    </div>
  );
}