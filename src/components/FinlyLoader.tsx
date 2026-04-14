import "./FinlyLoader.css";

export function FinlyLoader() {
  return (
    <div className="finly-loader-backdrop">
      <div className="finly-loader-container">
        <span className="finly-loader-text">FINLY</span>
        <div className="finly-loader-line" />
      </div>
    </div>
  );
}
