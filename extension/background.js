// background.js - Service Worker para Manifest V3

// Configuración de la extensión
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Primera instalación
    console.log('Instagram Unfollow Tracker instalado');
    
    // Opcional: abrir página de bienvenida
    chrome.tabs.create({
      url: 'https://tu-sitio.com/welcome'
    });
  } else if (details.reason === 'update') {
    // Actualización
    console.log('Instagram Unfollow Tracker actualizado');
  }
});

// Manejar clics en el icono de la extensión
chrome.action.onClicked.addListener((tab) => {
  // Verificar si estamos en Instagram
  if (!tab.url.includes('instagram.com')) {
    // Si no estamos en Instagram, abrir una nueva pestaña
    chrome.tabs.create({
      url: 'https://www.instagram.com'
    });
  }
  // Si ya estamos en Instagram, el popup se abrirá automáticamente
});

// Manejar mensajes entre content script y popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Reenviar mensajes del content script al popup si es necesario
  if (message.type && sender.tab) {
    // El popup ya maneja estos mensajes directamente
    // Este es un backup por si necesitamos lógica adicional
  }
  
  return true; // Mantener el canal abierto para respuestas asíncronas
});

// Configurar reglas de contenido para mejorar rendimiento
chrome.runtime.onInstalled.addListener(() => {
  // Registrar content scripts dinámicamente si es necesario
  // En este caso, ya están definidos en manifest.json
});

// Manejar errores globales
self.addEventListener('error', (error) => {
  console.error('Error en background script:', error);
});

// Limpiar datos antiguos periódicamente
chrome.alarms.create('cleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    // Limpiar storage local si es necesario
    chrome.storage.local.clear().then(() => {
      console.log('Datos temporales limpiados');
    });
  }
});

// Estadísticas de uso (opcional, para mejorar la extensión)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'trackUsage') {
    // Aquí podrías enviar estadísticas anónimas a tu servidor
    // para entender cómo usan la extensión (respetando privacidad)
    console.log('Uso registrado:', message.action);
  }
});