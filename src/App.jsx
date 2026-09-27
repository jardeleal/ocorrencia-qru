import { useEffect, useState } from 'react';
import { createProfile, getSession, signIn, signOut } from './lib/auth';
import { supabase } from './lib/supabase';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: authError } = await signIn(email.trim(), password);
    if (authError) {
      setError('E-mail ou senha inválidos.');
      setLoading(false);
      return;
    }
    await createProfile(data.user);
    onLogin(data.session);
    setLoading(false);
  }

  return (
    <main className="app-shell">
      <section className="auth-card">
        <div className="brand-mark">QRU</div>
        <h1>Ocorrência QRU</h1>
        <p className="subtitle">Acesse o sistema para registrar e acompanhar ocorrências.</p>
        <form onSubmit={handleSubmit} className="form">
          <label>E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" autoComplete="email" required />
          </label>
          <label>Senha
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha" autoComplete="current-password" required />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading || !supabase}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          {!supabase && <div className="warning">O Supabase ainda não foi configurado neste ambiente.</div>}
        </form>
      </section>
    </main>
  );
}

function Dashboard({ session }) {
  async function handleLogout() {
    await signOut();
    window.location.reload();
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div><strong>Ocorrência QRU</strong><span>Registro e acompanhamento</span></div>
        <button className="secondary" onClick={handleLogout}>Sair</button>
      </header>
      <section className="dashboard-content">
        <div className="welcome-card">
          <div className="brand-mark">QRU</div>
          <h1>Bem-vindo!</h1>
          <p>Usuário autenticado: <strong>{session.user.email}</strong></p>
          <span className="status">Banco de dados conectado</span>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    getSession().then((currentSession) => {
      if (active) { setSession(currentSession); setChecking(false); }
    });
    if (!supabase) return () => { active = false; };
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  if (checking) return <main className="app-shell"><p>Carregando...</p></main>;
  return session ? <Dashboard session={session} /> : <Login onLogin={setSession} />;
}

export default App;
