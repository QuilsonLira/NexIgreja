import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { LoginConventionBrand } from "@/components/media-display";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ senha?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="login-page">
      <section className="login-story" aria-label="Apresentacao do NexIgreja">
        <div className="story-glow story-glow-one" />
        <div className="story-glow story-glow-two" />
        <div className="story-content">
          <BrandMark inverse />
          <div className="story-copy">
            <p className="eyebrow eyebrow-light">Gestão que aproxima</p>
            <h1>Sua igreja organizada. Sua missão em movimento.</h1>
            <p>
              Uma base segura para conectar Convenção, matrizes e filiais em um único lugar.
            </p>
          </div>
          <div className="story-footer">
            <span className="status-dot" aria-hidden="true" />
            Acesso protegido e auditado
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <LoginConventionBrand />
          <div className="login-heading">
            <p className="eyebrow">Área segura</p>
            <h2>Acesse o NexIgreja</h2>
            <p>Identifique sua instituição e entre com suas credenciais.</p>
          </div>
          <LoginForm
            initialMessage={
              params.senha === "alterada" ? "Senha alterada com sucesso. Entre novamente." : ""
            }
          />
          <p className="login-help">
            Primeiro acesso ou esqueceu a senha? Procure o administrador da sua unidade.
          </p>
        </div>
        <p className="login-copyright">© {new Date().getFullYear()} NexIgreja</p>
      </section>
    </main>
  );
}
