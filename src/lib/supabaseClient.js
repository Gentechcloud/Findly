import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Не бросаем ошибку, чтобы дизайн-система/демо-режим работали и без
  // настроенного Supabase — просто предупреждаем в консоли.
  console.warn(
    '[Findly] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY не заданы. ' +
    'Скопируйте .env.example в .env и укажите ключи вашего проекта Supabase.'
  );
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key');
