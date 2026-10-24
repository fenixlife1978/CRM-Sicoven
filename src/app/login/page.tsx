"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "No se pudo iniciar sesión.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor. Intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <img className="company-logo" src="/efasfreelancer-logo.svg" alt="EFASfreelancer Soluciones Digitales" />
        <p className="eyebrow">CENTRO DE CONTROL · RIF V-13313521-5</p>
        <h1>EFASfreelancer</h1>
        <p className="intro">Soluciones Digitales · Administración segura de clientes, productos y licencias de software.</p>
        <form onSubmit={submit}>
          <label htmlFor="email">Correo administrativo</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required />
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={1024} required />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Verificando…" : "Iniciar sesión"}</button>
        </form>
        <small>Sesión protegida · Acceso registrado en auditoría</small>
      </section>
      <style>{`
        .login-shell{min-height:100vh;display:grid;place-items:center;padding:22px;background:radial-gradient(ellipse at top,#e5edf5 0,#f4f7fb 55%)}
        .login-card{width:min(100%,420px);padding:36px;background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 18px 60px #10243a12}
        .company-logo{display:block;width:100%;max-width:340px;height:auto;object-fit:contain;margin:0 auto 24px}
        .eyebrow{font-size:10px;letter-spacing:1.8px;font-weight:800;color:#9a7610;margin:0 0 9px}
        h1{font-size:27px;color:#10243a;margin:0}.intro{font-size:13px;line-height:1.7;color:#667487;margin:12px 0 26px}
        form{display:grid;gap:9px}label{font-size:12px;font-weight:700;color:#26384c;margin-top:7px}
        input{width:100%;border:1px solid #d7e0e9;border-radius:8px;padding:12px;color:#182536;background:#fff;outline:none}
        input:focus{border-color:#244f73;box-shadow:0 0 0 3px #244f7315}
        button{margin-top:12px;border:0;border-radius:8px;padding:13px;background:#10243a;color:#fff;font-weight:700}
        button:disabled{opacity:.65;cursor:wait}.error{background:#fff0ef;color:#a32b24;border-radius:7px;padding:10px;font-size:12px}
        .login-card>small{display:block;text-align:center;color:#8793a1;font-size:10px;margin-top:22px}
        @media(max-width:480px){.login-card{padding:27px 22px}}
      `}</style>
    </main>
  );
}
