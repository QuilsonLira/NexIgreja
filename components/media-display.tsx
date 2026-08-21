"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { profilePresentation } from "@/lib/image-policy";

export function UserAvatar({ photoUrl, name, className = "user-avatar" }: { photoUrl: string | null; name: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const presentation = profilePresentation(name, photoUrl);
  return (
    <span className={className} aria-label={`Foto de ${name}`}>
      {presentation.photoUrl && failedUrl !== presentation.photoUrl
        ? <img src={presentation.photoUrl} alt="" onError={() => setFailedUrl(presentation.photoUrl)} />
        : presentation.initial}
    </span>
  );
}

export function SidebarBrand({ logoUrl }: { logoUrl: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!logoUrl || failedUrl === logoUrl) return <BrandMark inverse />;
  return (
    <div className="sidebar-unit-brand" aria-label="NexIgreja">
      <span className="sidebar-unit-logo"><img src={logoUrl} alt="Logo da unidade" onError={() => setFailedUrl(logoUrl)} /></span>
      <span className="brand-name">Nex<span>Igreja</span></span>
    </div>
  );
}

export function LoginConventionBrand() {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => { setLoaded(false); setFailed(false); setRevision((value) => value + 1); };
    window.addEventListener("nexigreja:institution-changed", refresh);
    return () => window.removeEventListener("nexigreja:institution-changed", refresh);
  }, []);
  return (
    <div className={`login-convention-brand${loaded && !failed ? " login-convention-brand-with-logo" : ""}`}>
      {!failed ? (
        <span className="login-convention-logo" hidden={!loaded}>
          <img src={`/api/public/convention-logo?v=${revision}`} alt="Logo da Convenção" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
        </span>
      ) : null}
      <BrandMark />
    </div>
  );
}
