import { Link } from "react-router-dom";
import "./MakeRequestButton.css";

interface MakeRequestButtonProps {
  label: string;
  to?: string;
  className?: string;
}

export default function MakeRequestButton({ label, to = "/", className = "" }: MakeRequestButtonProps) {
  return (
    <div className={`make-request-btn-container ${className}`.trim()} style={{ ["--btn-color" as string]: "hsl(var(--secondary))" }}>
      {to ? (
        <Link to={to} className="make-request-btn">
          <span className="make-request-btn-text">{label}</span>
        </Link>
      ) : (
        <button type="button" className="make-request-btn">
          <span className="make-request-btn-text">{label}</span>
        </button>
      )}
    </div>
  );
}
