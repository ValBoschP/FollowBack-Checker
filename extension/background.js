// background.js - Service Worker para Manifest V3

// Configuración de la extensión
chrome.runtime.onInstalled.addListener((details) => {
  try {
    if (details.reason === 'install') {
      // Primera instalación
      console.log('Instagram Unfollow Tracker instalado');
      
      // Crear alarma de limpieza si no existe
      chrome.alarms.create('cleanup', { periodInMinutes: 60 });
      
      // Opcional: abrir página de bienvenida (comentado para desarrollo)
      // chrome.tabs.create({
      //   url: 'https://tu-sitio.com/welcome'
      // });
    } else if (details.reason === 'update') {
      // Actualización
      console.log('Instagram Unfollow Tracker actualizado');
    }
  } catch (error) {
    console.error('Error en onInstalled:', error);
  }
});

// Manejar clics en el icono de la extensión (solo si no hay popup)
// chrome.action.onClicked.addListener((tab) => {
//   // Verificar si estamos en Instagram
//   if (!tab.url.includes('instagram.com')) {
//     // Si no estamos en Instagram, abrir una nueva pestaña
//     chrome.tabs.create({
//       url: 'https://www.instagram.com'
//     });
//   }
// });

// Manejar mensajes entre content script y popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // Manejar diferentes tipos de mensajes
    switch (message.type) {
      case 'contentScriptReady':
        console.log('Content script listo');
        sendResponse({ success: true });
        break;
        
      case 'analysisProgress':
      case 'analysisComplete':
      case 'analysisError':
        // Estos mensajes se manejan directamente entre content script y popup
        break;
        
      case 'trackUsage':
        // Estadísticas de uso (opcional)
        console.log('Uso registrado:', message.action);
        sendResponse({ success: true });
        break;
        
      default:
        console.log('Mensaje no reconocido:', message.type);
    }
  } catch (error) {
    console.error('Error manejando mensaje:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Mantener el canal abierto para respuestas asíncronas
});

// Limpiar datos antiguos periódicamente
chrome.alarms.onAlarm.addListener((alarm) => {
  try {
    if (alarm.name === 'cleanup') {
      // Limpiar storage local si es necesario
      chrome.storage.local.clear().then(() => {
        console.log('Datos temporales limpiados');
      }).catch((error) => {
        console.error('Error limpiando storage:', error);
      });
    }
  } catch (error) {
    console.error('Error en alarma:', error);
  }
});

// Manejar errores de instalación del service worker
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker iniciado');
});

// Log para debugging
console.log('Background script cargado correctamente');