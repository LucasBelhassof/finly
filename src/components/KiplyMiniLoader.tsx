import { KiplyLogo } from "@/components/brand/KiplyLogo";

import "./FinlyMiniLoader.css";

interface KiplyMiniLoaderProps {
  className?: string;
}

export function KiplyMiniLoader({ className = "" }: KiplyMiniLoaderProps) {
  return (
    <div className={`finly-mini-loader ${className}`}>
      <KiplyLogo variant="icon" className="finly-mini-logo" />
      <svg className="finly-mini-orbit" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="finly-mini-trail" cx="24" cy="24" r="20" fill="none" />
        <g className="finly-mini-ball-motion">
          <circle className="finly-mini-ball" cx="24" cy="4" r="3" />
        </g>
      </svg>
    </div>
  );
}
