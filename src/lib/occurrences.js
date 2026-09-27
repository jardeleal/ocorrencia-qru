import { supabase } from './supabase';

const BUCKET = 'ocorrencias';

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function listCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id,nome,descricao')
    .eq('ativo', true)
    .order('nome');
  return { data: data ?? [], error };
}

export async function updateCategory(id, { nome, descricao }) {
  const cleanName = nome?.trim();
  const cleanDescription = descricao?.trim() || null;
  if (!cleanName) return { data: null, error: new Error('Informe o nome da categoria.') };

  const { data, error } = await supabase
    .from('categorias')
    .update({ nome: cleanName, descricao: cleanDescription })
    .eq('id', id)
    .select('id,nome,descricao,ativo')
    .single();

  return { data, error };
}

export async function deleteCategory(id) {
  const { error } = await supabase
    .from('categorias')
    .delete()
    .eq('id', id);
  return { error };
}

export async function createCategory({ nome, descricao }) {
  const cleanName = nome?.trim();
  const cleanDescription = descricao?.trim() || null;

  if (!cleanName) {
    return { data: null, error: new Error('Informe o nome da categoria.') };
  }

  const { data, error } = await supabase
    .from('categorias')
    .insert({
      nome: cleanName,
      descricao: cleanDescription,
      ativo: true,
    })
    .select('id,nome,descricao,ativo')
    .single();

  return { data, error };
}

export async function listOccurrences(userId) {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select('id,numero,usuario_id,categoria_id,descricao,ocorrido_at,created_at,updated_at,categorias(nome),profiles(username,nome,email)')
    .order('ocorrido_at', { ascending: false, nullsFirst: false });
  return { data: data ?? [], error };
}

export async function getOccurrence(id, userId) {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select('id,numero,usuario_id,categoria_id,descricao,ocorrido_at,created_at,updated_at,categorias(nome),profiles(username,nome,email),ocorrencia_midias(id,ocorrencia_id,tipo,arquivo_path,nome_arquivo,created_at)')
    .eq('id', id)
    .single();
  return { data, error };
}

export async function createOccurrence({ userId, categoriaId, occurredAt, descricao }) {
  const { data, error } = await supabase
    .from('ocorrencias')
    .insert({
      usuario_id: userId,
      categoria_id: categoriaId || null,
      ocorrido_at: occurredAt ? new Date(occurredAt).toISOString() : null,
      descricao: descricao?.trim() || null,
    })
    .select('id,numero,usuario_id,categoria_id,descricao,ocorrido_at,created_at,updated_at')
    .single();
  return { data, error };
}

export async function updateOccurrence(id, userId, { categoriaId, occurredAt, descricao }) {
  const { data, error } = await supabase
    .from('ocorrencias')
    .update({
      categoria_id: categoriaId || null,
      ocorrido_at: occurredAt ? new Date(occurredAt).toISOString() : null,
      descricao: descricao?.trim() || null,
    })
    .eq('id', id)
    .eq('usuario_id', userId)
    .select('id,numero,usuario_id,categoria_id,descricao,ocorrido_at,created_at,updated_at')
    .single();
  return { data, error };
}

export async function uploadMedia({ userId, occurrenceId, file }) {
  const path = `${userId}/${occurrenceId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) return { error: uploadError };

  const tipo = file.type.startsWith('video/') ? 'video' : 'foto';
  const { data, error } = await supabase
    .from('ocorrencia_midias')
    .insert({
      ocorrencia_id: occurrenceId,
      tipo,
      arquivo_path: path,
      nome_arquivo: file.name,
    })
    .select('id,tipo,arquivo_path,nome_arquivo,created_at')
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error };
  }

  return { data, error: null };
}

export async function createMediaUrls(media) {
  if (!media?.length) return [];
  const paths = media.map((item) => item.arquivo_path);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) return [];
  return media.map((item, index) => ({ ...item, url: data?.[index]?.signedUrl ?? null }));
}

export async function deleteMedia(item, userId) {
  const { data: media, error: mediaError } = await supabase
    .from('ocorrencia_midias')
    .select('id,ocorrencia_id,arquivo_path')
    .eq('id', item.id)
    .single();

  if (mediaError || !media) return { error: mediaError || new Error('Mídia não encontrada.') };

  const { data: occurrence, error: occurrenceError } = await supabase
    .from('ocorrencias')
    .select('id')
    .eq('id', media.ocorrencia_id)
    .eq('usuario_id', userId)
    .single();

  if (occurrenceError || !occurrence) return { error: occurrenceError || new Error('Mídia não encontrada ou sem permissão.') };

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([media.arquivo_path]);

  if (storageError) return { error: storageError };

  const { error: dbError } = await supabase
    .from('ocorrencia_midias')
    .delete()
    .eq('id', media.id)
    .eq('ocorrencia_id', media.ocorrencia_id);

  return { error: dbError };
}

export async function deleteOccurrence(id, userId) {
  const { data: occurrence, error: occurrenceError } = await supabase
    .from('ocorrencias')
    .select('id,ocorrencia_midias(arquivo_path)')
    .eq('id', id)
    .eq('usuario_id', userId)
    .single();

  if (occurrenceError) return { error: occurrenceError };

  const paths = (occurrence.ocorrencia_midias || [])
    .map((item) => item.arquivo_path)
    .filter(Boolean);

  if (paths.length) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove(paths);

    if (storageError) return { error: storageError };
  }

  const { error } = await supabase
    .from('ocorrencias')
    .delete()
    .eq('id', id)
    .eq('usuario_id', userId);

  return { error };
}
