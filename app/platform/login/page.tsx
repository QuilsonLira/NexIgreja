import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Administração da plataforma" };

export default function PlatformLoginPage() {
  return <main className="login-page"><section className="login-story" aria-label="Administração do NexIgreja"><div className="story-glow story-glow-one" /><div className="story-content"><BrandMark inverse /><div className="story-copy"><p className="eyebrow eyebrow-light">Proprietário da plataforma</p><h1>Administração segura do NexIgreja.</h1><p>Gerencie clientes e entre explicitamente no contexto de cada instituição.</p></div><div className="story-footer"><span className="status-dot" /> Acesso exclusivo e auditado</div></div></section><section className="login-panel"><div className="login-card"><BrandMark /><div className="login-heading"><p className="eyebrow">Administração da plataforma</p><h2>Identifique-se</h2><p>Este acesso não utiliza código de instituição.</p></div><LoginForm platformMode /></div><p className="login-copyright">© {new Date().getFullYear()} NexIgreja</p></section></main>;
}
