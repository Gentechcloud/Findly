// Всё, что отличается в Android-приложении (Capacitor) и в обычном браузере.
import { useEffect, useRef } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';

export const isNative = Capacitor.isNativePlatform();

// Цвет значков системных панелей (время, батарея) под текущую тему
export function setSystemBarsStyle(mode) {
  if (!isNative) return;
  SystemBars.setStyle({ style: mode === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
}

// ---------- Кнопка «Назад» на Android ----------
// Окна и панели регистрируют закрытие через useBackHandler — «Назад» закрывает самое верхнее.
const stack = [];

export function useBackHandler(active, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    const fn = () => ref.current();
    stack.push(fn);
    return () => {
      const i = stack.lastIndexOf(fn);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

export function runBackHandler() {
  const fn = stack[stack.length - 1];
  if (!fn) return false;
  fn();
  return true;
}

// onFallback() вызывается, если открытых окон нет; вернуть true, если «Назад» обработано
export function registerBackButton(onFallback) {
  if (!isNative) return () => {};
  let handle = null;
  let cancelled = false;
  CapApp.addListener('backButton', () => {
    if (runBackHandler()) return;
    if (onFallback()) return;
    CapApp.exitApp();
  }).then((h) => {
    if (cancelled) h.remove(); else handle = h;
  });
  return () => { cancelled = true; if (handle) handle.remove(); };
}

// ---------- Скачивание ----------
// В WebView обычное <a download> не работает, поэтому на Android открываем ссылку
// системным способом (Chrome Custom Tab) — оттуда файл можно сохранить.
export async function downloadUrl(url, filename) {
  if (isNative) {
    await Browser.open({ url });
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Сохранить текст как .txt (на Android — через системное меню «Поделиться»)
export async function saveText(filename, text) {
  if (isNative) {
    await Share.share({ title: filename, text, dialogTitle: 'Сохранить или отправить' });
    return;
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
