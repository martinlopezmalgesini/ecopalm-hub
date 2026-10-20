import { supabase } from '../supabase';

// 1. Obtener el usuario actual y su perfil (incluyendo el rol: learner, editor, admin)
export async function getCurrentUserProfile() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) return { user: null, profile: null };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (profileError) {
    return { user: session.user, profile: { role: 'learner' } };
  }

  return { user: session.user, profile };
}

// 2. Sincronizar Notas de Usuario (user_notes)
export async function fetchUserNotes(scope) {
  const { data, error } = await supabase
    .from('user_notes')
    .select('item_id, body')
    .eq('scope', scope);

  if (error) {
    console.error(`Error cargando notas de ${scope}:`, error);
    return {};
  }

  // Convertir array de Supabase en un objeto clave-valor para los componentes
  const notesMap = {};
  data.forEach(row => {
    notesMap[row.item_id] = row.body;
  });
  return notesMap;
}

export async function upsertUserNote(scope, itemId, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase
    .from('user_notes')
    .upsert({
      user_id: session.user.id,
      scope,
      item_id: itemId,
      body,
      updated_at: new Date()
    }, { onConflict: 'user_id,scope,item_id' });

  if (error) {
    console.error('Error guardando nota en la nube:', error);
  }
}

// 3. Sincronizar Progreso del Playbook (playbook_progress)
export async function fetchPlaybookProgress() {
  const { data, error } = await supabase
    .from('playbook_progress')
    .select('entry_id, learned, flash_box');

  if (error) {
    console.error('Error cargando progreso:', error);
    return { learnedMap: {}, boxesMap: {} };
  }

  const learnedMap = {};
  const boxesMap = {};
  data.forEach(row => {
    if (row.learned) learnedMap[row.entry_id] = true;
    if (row.flash_box) boxesMap[row.entry_id] = row.flash_box;
  });

  return { learnedMap, boxesMap };
}

export async function updatePlaybookProgress(entryId, learned, flashBox = 0) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase
    .from('playbook_progress')
    .upsert({
      user_id: session.user.id,
      entry_id: entryId,
      learned,
      flash_box: flashBox,
      updated_at: new Date()
    }, { onConflict: 'user_id,entry_id' });

  if (error) {
    console.error('Error actualizando progreso en la nube:', error);
  }
}