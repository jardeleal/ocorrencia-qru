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

export async function listOccurrences(userId) {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select('id,numero,categoria_id,descricao,created_at,updated_at,categorias(nome)')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false });
  return { data: data ?? [], error };
}

export async function getOccurrence(id, userId) {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select('id,numero,categoria_id,descricao,created_at,updated_at,categorias(nome),ocorrencia_midias(id,tipo,arquivo_path,nome_arquivo,created_at)')
    .eq('id', id)
    .eq('usuario_id', userId)
    .single();
  return { data, error };
}

export async function createOccurrence({ userId, categoriaId, descricao }) {
  const { data, error } = await supabase
    .from('ocorrencias')
    .insert({
      usuario_id: userId,
      categoria_id: categoriaId || null,
      descricao: descricao?.trim() || null,
    })
    .select('id,numero,categoria_id,descricao,created_at,updated_at')
    .single();
  return { data, error };
}

export async function updateOccurrence(id, userId, { categoriaId, descricao }) {
  const { data, error } = await supabase
    .from('ocorrencias')
    .update({
      categoria_id: categoriaId || null,
      descricao: descricao?.trim() || null,
    })
    .eq('id', id)
    .eq('usuario_id', userId)
    .select('id,numero,categoria_id,descricao,created_at,updated_at')
    .single();
  return { data, error };
}

export async function uploadMedia({ userId, occurrenceId, file }) {
  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
  const path = `${userId}/${occurrenceId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });

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
  const { error: dbError } = await supabase
    .from('ocorrencia_midias')
    .delete()
    .eq('id', item.id)
    .in('ocorrencia_id',
      (await supabase.from('ocorrencias').select('id').eq('usuario_id', userId)).data?.map((row) => row.id) ?? []
    );

  if (dbError) return { error: dbError };
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([item.arquivo_path]);
  return { error: storageError };
}
