import { KiplyLogo } from "@/components/brand/KiplyLogo";

import "./FinlyLoader.css";

export function KiplyLoader() {
  return (
    <div className="finly-loader-backdrop">
      <div className="finly-loader-container">
        <KiplyLogo variant="full" className="finly-loader-logo" />
        <div className="finly-loader-line" />
      </div>
    </div>
  );
}
