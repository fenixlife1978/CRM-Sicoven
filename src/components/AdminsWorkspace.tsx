"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Admin = { id: string; email: string; role: string; active: boolean; createdAt: string; isSeed: boolean };

export default function AdministradoresPage() {
  const [users, setUsers] = useState<Admin[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/admins", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No fue posible cargar los administradores.");
    setUsers(data.users || []);
  }

  useEffect(() => { load().catch(e => setError(e.message)); }, []);

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admins", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible crear el administrador.");
      setEmail(""); setPassword("");
      setMessage("Segundo administrador creado. Cierra sesión y verifica que pueda entrar antes de eliminar la cuenta inicial.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    finally { setBusy(false); }
  }

  async function removeSeed(id: string) {
    if (!window.confirm("¿Eliminar definitivamente la cuenta de administrador inicial? Hazlo solo después de verificar el acceso con el segundo administrador.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admins", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible eliminar la cuenta inicial.");
      setMessage("Cuenta inicial eliminada.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    finally { setBusy(false); }
  }

  return <main className="page">
    <header><div><Link href="/">← Volver al centro de control</Link><p className="eyebrow">SEGURIDAD Y ACCESO</p><h1>Administradores</h1><p className="intro">Crea una segunda cuenta administrativa y comprueba su acceso antes de retirar la cuenta inicial.</p></div></header>
    {error && <p className="alert error" role="alert">{error}</p>}
    {message && <p className="alert success" role="status">{message}</p>}
    <section className="panel">
      <h2>Crear administrador</h2>
      <form onSubmit={createAdmin}>
        <label htmlFor="email">Correo del nuevo administrador</label>
        <input id="email" type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/>
        <label htmlFor="password">Contraseña (mínimo 12 caracteres)</label>
        <input id="password" type="password" required minLength={12} maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"/>
        <button disabled={busy} type="submit">{busy ? "Procesando…" : "Crear segundo administrador"}</button>
      </form>
    </section>
    <section className="panel">
      <h2>Cuentas registradas</h2>
      {users.length === 0 ? <p>No hay cuentas para mostrar.</p> : <div className="table-wrap"><table><thead><tr><th>Correo</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
        {users.map(user => <tr key={user.id}><td>{user.email}{user.isSeed && <small className="seed">Cuenta inicial</small>}</td><td>{user.role === "admin" ? "Administrador" : user.role}</td><td>{user.active ? "Activo" : "Inactivo"}</td><td>{user.isSeed ? <button className="danger" disabled={busy || users.filter(u => u.active && u.role === "admin").length < 2} onClick={() => removeSeed(user.id)}>Eliminar cuenta inicial</button> : <span>—</span>}</td></tr>)}
      </tbody></table></div>}
      <p className="hint">Por seguridad, la cuenta inicial solo se elimina si hay al menos dos administradores activos y la solicitud se realiza desde la cuenta nueva. Si la cuenta inicial ya creó clientes o licencias, primero se conservan sus registros históricos.</p>
    </section>
    <style>{`
      *{box-sizing:border-box}.page{max-width:1000px;margin:0 auto;padding:clamp(18px,4vw,44px);color:#17283a}header a{color:#365d7d;text-decoration:none;font-size:13px}.eyebrow{margin:28px 0 7px;font-size:10px;letter-spacing:1.7px;font-weight:800;color:#9a7610}h1{margin:0;font-size:clamp(26px,4vw,36px)}.intro{color:#65758a;line-height:1.6;font-size:14px}.panel{margin-top:22px;background:#fff;border:1px solid #e0e7ee;border-radius:14px;padding:clamp(18px,3vw,28px);box-shadow:0 10px 35px #10243a08}.panel h2{font-size:18px;margin:0 0 18px}form{display:grid;gap:10px;max-width:540px}label{font-size:12px;font-weight:700;margin-top:7px}input{padding:12px;border:1px solid #ccd7e2;border-radius:8px;font:inherit;width:100%;min-width:0}button{padding:12px 15px;border:0;border-radius:8px;background:#10243a;color:white;font-weight:700;cursor:pointer;margin-top:9px}button:disabled{opacity:.45;cursor:not-allowed}.danger{background:#a83232;font-size:12px;margin:0}.alert{padding:12px;border-radius:8px;font-size:13px}.error{background:#fff0ef;color:#9e2929}.success{background:#e8f6ee;color:#216b43}.table-wrap{width:100%;overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px;text-align:left}th,td{padding:12px;border-bottom:1px solid #e7edf2;vertical-align:middle}th{color:#63748a;font-size:11px;text-transform:uppercase;letter-spacing:.5px}td{overflow-wrap:anywhere}.seed{display:block;color:#9a7610;font-size:10px;margin-top:5px}.hint{font-size:12px;line-height:1.6;color:#65758a;margin:17px 0 0}@media(max-width:600px){th,td{padding:9px;font-size:11px}.danger{white-space:normal}}
    `}</style>
  </main>;
}
