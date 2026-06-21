import React, { useEffect } from "react";
import burgerModel from "../../assets/burger.glb";
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
        'ios-src'?: string;
        ar?: boolean;
        'ar-modes'?: string;
      };
    }
  }
}

export function HeroBurger() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, ... }}>
      {visible && (
        <model-viewer
          src={burgerModel}
          loading="lazy"
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
      )}
    </div>
  );
}