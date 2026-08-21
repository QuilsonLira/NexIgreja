import { Church } from "lucide-react";

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`brand-mark${inverse ? " brand-mark-inverse" : ""}`} aria-label="NexIgreja">
      <span className="brand-icon" aria-hidden="true">
        <Church size={25} strokeWidth={2.1} />
      </span>
      <span className="brand-name">Nex<span>Igreja</span></span>
    </div>
  );
}
