import { useEffect, useState } from 'react';
import { createProfile, getSession, signIn, signOut, signUp, SIGNUP_CODE } from './lib/auth';
import { supabase } from './lib/supabase';
import {
  createCategory,
  createMediaUrls,
  createOccurrence,
  deleteMedia,
  deleteOccurrence,
  getOccurrence,
  listCategories,
  listOccurrences,
  updateOccurrence,
  uploadMedia,
} from './lib/occurrences';
import { compressMedia, formatFileSize } from './lib/mediaCompression';

function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const cleanUsername = username.trim().toLowerCase();

    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(cleanUsername)) {
      setError('Use um usuário de 3 a 30 caracteres: letras, números, ponto, hífen ou _.');
      return;
    }

    if (mode === 'signup' && signupCode.trim() !== SIGNUP_CODE) {
      setError('Código de cadastro inválido.');
      return;
    }

    setLoading(true);

    if (mode === 'signup') {
      const { data, error: signupError } = await signUp(cleanUsername, password);
      if (signupError) {
        setError(signupError.message || 'Não foi possível criar a conta.');
        setLoading(false);
        return;
      }

      if (data.session) {
        await createProfile(data.user);
        onLogin(data.session);
      } else {
        setMessage('Conta criada! Agora entre usando seu usuário e senha.');
        setMode('login');
        setPassword('');
        setSignupCode('');
      }
      setLoading(false);
      return;
    }

    const { data, error: authError } = await signIn(cleanUsername, password);
    if (authError) {
      setError('Usuário ou senha inválidos.');
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
        <p className="subtitle">Registre ocorrências com rapidez, fotos e vídeos.</p>

        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => switchMode('login')}>Entrar</button>
          <button type="button" className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'} onClick={() => switchMode('signup')}>Criar conta</button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <label>Usuário
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex.: jardel.dias" autoComplete="username" maxLength="30" required />
          </label>

          <label>Senha
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength="6" required />
          </label>

          {mode === 'signup' && (
            <label>Código de cadastro
              <input type="password" value={signupCode} onChange={(e) => setSignupCode(e.target.value)} placeholder="Digite o código de cadastro" autoComplete="off" required />
            </label>
          )}

          {error && <div className="error">{error}</div>}
          {message && <div className="success">{message}</div>}

          <button type="submit" disabled={loading}>
            {loading ? (mode === 'signup' ? 'Criando conta...' : 'Entrando...') : mode === 'signup' ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <p className="auth-help">
          {mode === 'login'
            ? <>Ainda não tem conta? <button type="button" className="link-button inline" onClick={() => switchMode('signup')}>Criar conta</button></>
            : <>Já tem uma conta? <button type="button" className="link-button inline" onClick={() => switchMode('login')}>Entrar</button></>}
        </p>
      </section>
    </main>
  );
}

function Dashboard({ session }) {
  const [screen, setScreen] = useState('home');
  const [categories, setCategories] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const [catResult, occResult] = await Promise.all([
      listCategories(),
      listOccurrences(session.user.id),
    ]);
    if (catResult.error || occResult.error) {
      setNotice('Não foi possível carregar os dados.');
    } else {
      setCategories(catResult.data);
      setOccurrences(occResult.data);
      setNotice('');
    }
    setLoading(false);
  }

  async function loadCategories() {
    const { data, error } = await listCategories();
    if (!error) setCategories(data);
    return { data, error };
  }

  useEffect(() => { loadData(); }, []);

  async function handleLogout() {
    await signOut();
    window.location.reload();
  }

  function openNew() {
    setSelectedId(null);
    setScreen('form');
  }

  function openEdit(id) {
    setSelectedId(id);
    setScreen('form');
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div><strong>Ocorrência QRU</strong><span>Registro e acompanhamento</span></div>
        <nav className="topbar-actions">
          <button className="secondary small" onClick={() => setScreen('categories')}>Categorias</button>
          <button className="secondary small" onClick={handleLogout}>Sair</button>
        </nav>
      </header>

      <section className="dashboard-content dashboard-inner">
        {screen === 'home' && (
          <>
            <div className="page-heading">
              <div>
                <h1>Painel de ocorrências</h1>
                <p>Usuário: <strong>{session.user.user_metadata?.username || session.user.email}</strong></p>
              </div>
              <button onClick={openNew}>+ Nova ocorrência</button>
            </div>

            {notice && <div className="error">{notice}</div>}

            <div className="stats-grid">
              <div className="stat-card"><strong>{occurrences.length}</strong><span>Ocorrências</span></div>
              <div className="stat-card"><strong>{categories.length}</strong><span>Categorias disponíveis</span></div>
            </div>

            <section className="panel">
              <div className="panel-title"><h2>Últimas ocorrências</h2><button className="secondary small" onClick={loadData}>Atualizar</button></div>
              {loading ? <p className="muted">Carregando...</p> : occurrences.length === 0 ? (
                <div className="empty"><div className="empty-icon">📋</div><strong>Nenhuma ocorrência registrada</strong><span>Comece pelo botão “Nova ocorrência”.</span></div>
              ) : (
                <div className="occurrence-list">
                  {occurrences.map((item) => (
                    <button key={item.id} className="occurrence-row" onClick={() => openEdit(item.id)}>
                      <span className="occurrence-number">#{item.numero}</span>
                      <span className="occurrence-main">
                        <strong>{item.categorias?.nome || 'Sem categoria'}</strong>
                        <small>{item.descricao || 'Sem descrição'}</small>
                      </span>
                      <span className="occurrence-date">{new Date(item.created_at).toLocaleDateString('pt-BR')}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {screen === 'categories' && (
          <CategoryManager
            categories={categories}
            onBack={() => setScreen('home')}
            onCreated={async () => { await loadCategories(); }}
          />
        )}

        {screen === 'form' && (
          <OccurrenceForm
            session={session}
            categories={categories}
            occurrenceId={selectedId}
            onBack={() => { setScreen('home'); loadData(); }}
          />
        )}
      </section>
    </main>
  );
}

function CategoryManager({ categories, onBack, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    const { error: createError } = await createCategory({ nome: name, descricao: description });
    if (createError) {
      if (createError.code === '23505') {
        setError('Essa categoria já existe.');
      } else {
        setError(createError.message || 'Não foi possível criar a categoria.');
      }
      setSaving(false);
      return;
    }

    setName('');
    setDescription('');
    setMessage('Categoria criada com sucesso.');
    await onCreated();
    setSaving(false);
  }

  return (
    <section className="panel category-panel">
      <div className="page-heading compact">
        <div>
          <button type="button" className="link-button" onClick={onBack}>← Voltar</button>
          <h1>Categorias</h1>
          <p>Cadastre e consulte as categorias usadas nas ocorrências.</p>
        </div>
      </div>

      <div className="category-layout">
        <form className="category-create" onSubmit={handleCreate}>
          <h2>Nova categoria</h2>
          <label>Nome
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength="60" placeholder="Ex.: Produto vencido" required />
          </label>
          <label>Descrição (opcional)
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" maxLength="200" placeholder="Explique quando essa categoria deve ser usada." />
          </label>
          {error && <div className="error">{error}</div>}
          {message && <div className="success">{message}</div>}
          <button type="submit" disabled={saving}>{saving ? 'Salvando...' : '+ Adicionar categoria'}</button>
        </form>

        <div>
          <h2 className="category-list-title">Categorias cadastradas ({categories.length})</h2>
          <div className="category-list">
            {categories.length === 0 ? (
              <div className="empty"><strong>Nenhuma categoria cadastrada.</strong></div>
            ) : categories.map((category) => (
              <div className="category-row" key={category.id}>
                <div><strong>{category.nome}</strong>{category.descricao && <small>{category.descricao}</small>}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function OccurrenceForm({ session, categories, occurrenceId, onBack }) {
  const editing = Boolean(occurrenceId);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [existingMedia, setExistingMedia] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [processingMedia, setProcessingMedia] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [error, setError] = useState('');
  const [previewMedia, setPreviewMedia] = useState(null);

  async function loadOccurrence() {
    if (!editing) return;
    setLoading(true);
    const { data, error: loadError } = await getOccurrence(occurrenceId, session.user.id);
    if (loadError) {
      setError('Não foi possível carregar a ocorrência.');
      setLoading(false);
      return;
    }
    setCategoryId(data.categoria_id ? String(data.categoria_id) : '');
    setDescription(data.descricao || '');
    setExistingMedia(await createMediaUrls(data.ocorrencia_midias || []));
    setLoading(false);
  }

  useEffect(() => { loadOccurrence(); }, [occurrenceId]);

  async function addFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setError('');
    setProcessingMedia(true);

    const processed = [];
    try {
      for (const file of files) {
        if (file.size > 100 * 1024 * 1024) {
          throw new Error(`O arquivo "${file.name}" ultrapassa 100 MB antes da compressão.`);
        }

        setProcessingMessage(`Comprimindo ${file.name}...`);
        const compressed = await compressMedia(file);
        processed.push(compressed);
      }

      setNewFiles((current) => [...current, ...processed]);
      setProcessingMessage('');
    } catch (processingError) {
      setError(processingError.message || 'Não foi possível processar a mídia.');
      setProcessingMessage('');
    } finally {
      setProcessingMedia(false);
    }
  }

  function removeNewFile(index) {
    setNewFiles((current) => current.filter((_, i) => i !== index));
  }

  async function handleDeleteMedia(item) {
    if (!window.confirm(`Apagar a mídia "${item.nome_arquivo}"?`)) return;
    const { error: deleteError } = await deleteMedia(item, session.user.id);
    if (deleteError) {
      setError(deleteError.message || 'Não foi possível apagar a mídia.');
      return;
    }
    setExistingMedia((current) => current.filter((media) => media.id !== item.id));
    setPreviewMedia(null);
  }

  async function handleDeleteOccurrence() {
    if (!window.confirm(`Apagar definitivamente a ocorrência #${occurrenceId} e todas as mídias anexadas?`)) return;

    setSaving(true);
    setError('');
    const { error: deleteError } = await deleteOccurrence(occurrenceId, session.user.id);
    if (deleteError) {
      setError(deleteError.message || 'Não foi possível apagar a ocorrência.');
      setSaving(false);
      return;
    }

    setSaving(false);
    onBack();
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setSaving(true);

    const payload = { categoriaId: categoryId ? Number(categoryId) : null, descricao: description };

    let result;
    if (editing) {
      result = await updateOccurrence(occurrenceId, session.user.id, payload);
    } else {
      result = await createOccurrence({ userId: session.user.id, ...payload });
    }

    if (result.error) {
      setError(result.error.message || 'Não foi possível salvar a ocorrência.');
      setSaving(false);
      return;
    }

    const id = result.data.id;
    for (const file of newFiles) {
      if (file.size > 50 * 1024 * 1024) {
        setError(`O arquivo "${file.name}" continua acima de 50 MB após a compressão.`);
        setSaving(false);
        return;
      }

      const mediaResult = await uploadMedia({ userId: session.user.id, occurrenceId: id, file });
      if (mediaResult.error) {
        setError(`A ocorrência foi salva, mas não foi possível enviar "${file.name}".`);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onBack();
  }

  if (loading) return <section className="panel"><p className="muted">Carregando ocorrência...</p></section>;

  return (
    <section className="panel form-panel">
      <div className="page-heading compact">
        <div>
          <button type="button" className="link-button" onClick={onBack}>← Voltar</button>
          <h1>{editing ? `Editar ocorrência #${occurrenceId}` : 'Nova ocorrência'}</h1>
          <p>{editing ? 'Altere a descrição ou acrescente novas mídias.' : 'Preencha os dados e registre fotos ou vídeos.'}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="occurrence-form">
        <label>Categoria
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">Selecione uma categoria</option>
            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
          </select>
        </label>

        <label>Descrição / observações
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o que aconteceu..." rows="6" />
        </label>

        <div className="media-actions">
          <label className="upload-card">
            <span className="upload-icon">📷</span>
            <strong>Tirar foto</strong>
            <small>Usar a câmera do dispositivo</small>
            <input type="file" accept="image/*" capture="environment" multiple onChange={addFiles} disabled={processingMedia} />
          </label>
          <label className="upload-card">
            <span className="upload-icon">🎥</span>
            <strong>Gravar vídeo</strong>
            <small>Usar a câmera do dispositivo</small>
            <input type="file" accept="video/*" capture="environment" onChange={addFiles} disabled={processingMedia} />
          </label>
          <label className="upload-card">
            <span className="upload-icon">📁</span>
            <strong>Escolher arquivos</strong>
            <small>Fotos ou vídeos existentes</small>
            <input type="file" accept="image/*,video/*" multiple onChange={addFiles} disabled={processingMedia} />
          </label>
        </div>

        {processingMedia && <div className="processing"><strong>⏳ {processingMessage}</strong><span>A mídia será reduzida antes de ser enviada.</span></div>}

        {existingMedia.length > 0 && (
          <div>
            <div className="section-heading"><h3>Mídias já anexadas</h3><span>{existingMedia.length} arquivo(s)</span></div>
            <div className="media-grid">
              {existingMedia.map((item) => (
                <div className="media-item" key={item.id}>
                  <button type="button" className="media-preview-button" onClick={() => setPreviewMedia(item)}>
                    {item.tipo === 'foto' ? <img src={item.url} alt={item.nome_arquivo} /> : <video src={item.url} muted />}
                  </button>
                  <div className="media-meta">
                    <span title={item.nome_arquivo}>{item.nome_arquivo}</span>
                    <div className="media-item-actions">
                      <button type="button" className="link-button small-link" onClick={() => setPreviewMedia(item)}>Abrir</button>
                      <button type="button" className="danger-link" onClick={() => handleDeleteMedia(item)}>Apagar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {newFiles.length > 0 && (
          <div>
            <div className="section-heading"><h3>Arquivos prontos para envio</h3><span>{newFiles.length} arquivo(s)</span></div>
            <div className="file-list">
              {newFiles.map((file, index) => (
                <div className="file-row" key={`${file.name}-${index}`}>
                  <span>{file.type.startsWith('video/') ? '🎥' : '📷'} {file.name} <small>({formatFileSize(file.size)})</small></span>
                  <button type="button" className="secondary small" onClick={() => removeNewFile(index)}>Remover</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="form-footer">
          <button type="submit" disabled={saving || processingMedia}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Registrar ocorrência'}</button>
          {editing && <button type="button" className="danger-button" onClick={handleDeleteOccurrence} disabled={saving || processingMedia}>Apagar ocorrência</button>}
        </div>
      </form>

      {previewMedia && (
        <MediaViewer media={previewMedia} onClose={() => setPreviewMedia(null)} onDelete={() => handleDeleteMedia(previewMedia)} />
      )}
    </section>
  );
}

function MediaViewer({ media, onClose, onDelete }) {
  return (
    <div className="media-modal" role="dialog" aria-modal="true" aria-label="Visualizador de mídia" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="media-modal-card">
        <div className="media-modal-header">
          <strong>{media.nome_arquivo}</strong>
          <button type="button" className="secondary small" onClick={onClose}>Fechar</button>
        </div>
        <div className="media-modal-content">
          {media.tipo === 'foto'
            ? <img src={media.url} alt={media.nome_arquivo} />
            : <video src={media.url} controls autoPlay />}
        </div>
        <div className="media-modal-footer">
          <button type="button" className="danger-button" onClick={onDelete}>Apagar mídia</button>
          <a className="secondary-button-link" href={media.url} download={media.nome_arquivo}>Baixar</a>
        </div>
      </div>
    </div>
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
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  if (checking) return <main className="app-shell"><p>Carregando...</p></main>;
  return session ? <Dashboard session={session} /> : <Login onLogin={setSession} />;
}

export default App;
