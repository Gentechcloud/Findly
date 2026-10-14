// Обои чата в духе Telegram: градиенты (для светлой и тёмной темы) + необязательный узор.
// Свои обои из галереи хранятся на устройстве (localStorage), на сервер не уходят.

export const WALLPAPERS = [
  { id: 'none', name: 'Без обоев' },
  {
    id: 'aurora', name: 'Аврора', pattern: true,
    light: 'linear-gradient(160deg,#dbeafe 0%,#e9d5ff 50%,#fde7f3 100%)',
    dark: 'linear-gradient(160deg,#0f172a 0%,#1e1b4b 55%,#2a1633 100%)',
  },
  {
    id: 'mint', name: 'Мята', pattern: true,
    light: 'linear-gradient(160deg,#d1fae5,#cffafe)',
    dark: 'linear-gradient(160deg,#052e2b,#0c3a47)',
  },
  {
    id: 'sunset', name: 'Закат', pattern: true,
    light: 'linear-gradient(160deg,#fde68a,#fecaca 55%,#fbcfe8)',
    dark: 'linear-gradient(160deg,#3b1d0b,#4a1d2a 55%,#3b1a3d)',
  },
  {
    id: 'ocean', name: 'Океан',
    light: 'linear-gradient(180deg,#bfdbfe,#a5f3fc)',
    dark: 'linear-gradient(180deg,#0b1d3a,#083344)',
  },
  {
    id: 'forest', name: 'Лес', pattern: true,
    light: 'linear-gradient(160deg,#dcfce7,#bef264 120%)',
    dark: 'linear-gradient(160deg,#052e16,#14351a)',
  },
  {
    id: 'peach', name: 'Персик',
    light: 'linear-gradient(160deg,#ffedd5,#fecdd3)',
    dark: 'linear-gradient(160deg,#3a1a10,#3f1d2b)',
  },
  {
    id: 'paper', name: 'Бумага', pattern: true,
    light: 'linear-gradient(#f5efe3,#f5efe3)',
    dark: 'linear-gradient(#1d1b16,#1d1b16)',
  },
  {
    id: 'graphite', name: 'Графит',
    light: 'linear-gradient(160deg,#e5e7eb,#d1d5db)',
    dark: 'linear-gradient(160deg,#18181b,#27272a)',
  },
];

const CUSTOM_KEY = 'findly-wallpaper-custom';

export function getCustomWallpaper() {
  try { return localStorage.getItem(CUSTOM_KEY) || ''; } catch { return ''; }
}
export function setCustomWallpaper(dataUrl) {
  try { localStorage.setItem(CUSTOM_KEY, dataUrl); } catch { /* память переполнена — игнорируем */ }
}

// Уменьшает выбранное фото (чтобы не забивать память) и возвращает data-URL
export function fileToWallpaper(file, maxSide = 1080) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать изображение')); };
    img.src = url;
  });
}

const DOTS = (dark) =>
  `radial-gradient(${dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)'} 1.6px, transparent 1.7px) 0 0 / 26px 26px,` +
  `radial-gradient(${dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.4)'} 1.2px, transparent 1.3px) 13px 13px / 26px 26px`;

// CSS-значение для свойства `background`
export function wallpaperCss(id, mode, customUrl) {
  if (!id || id === 'none') return null;
  const dark = mode === 'dark';
  if (id === 'custom') {
    return customUrl ? `center / cover no-repeat url(${customUrl})` : null;
  }
  const w = WALLPAPERS.find((x) => x.id === id);
  if (!w) return null;
  const grad = dark ? w.dark : w.light;
  return w.pattern ? `${DOTS(dark)}, ${grad}` : grad;
}
