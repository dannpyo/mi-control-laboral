// Punto de entrada: sin lógica laboral ni acceso a datos personales.
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url));
  } catch (error) {
    console.error('No se pudo registrar el Service Worker:', error);
    const status = document.querySelector('#app-status');
    status.textContent = 'El modo sin conexión no está disponible en este momento.';
    status.hidden = false;
  }
}
window.addEventListener('load', registerServiceWorker, { once: true });
