import "./FinlyMiniLoader.css";

interface FinlyMiniLoaderProps {
  className?: string;
}

export function FinlyMiniLoader({ className = "" }: FinlyMiniLoaderProps) {
  return (
    <div className={`finly-mini-loader ${className}`}>
      <span className="finly-mini-letter">F</span>
      {/* trail (fixed, animated via stroke-dashoffset) */}
      <svg className="finly-mini-svg" viewBox="0 0 48 48">
        <circle
          className="finly-mini-trail"
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="#00ffae"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {/* ball (rotates independently) */}
      <svg className="finly-mini-ball-svg" viewBox="0 0 48 48">
        <circle className="finly-mini-ball" cx="24" cy="4" r="3" />
      </svg>
    </div>
  );
}
