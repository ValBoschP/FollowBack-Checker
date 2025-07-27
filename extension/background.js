// background.js - Service Worker simplificado y funcional

console.log('Background script iniciado');

// Configuración básica de la extensión
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extensión instalada/actualizada:', details.reason);
  
  // Solo crear alarmas si están disponibles
  if (chrome.alarms) {
    chrome.alarms.create('cleanup', { periodInMinutes: 60 });
    console.log('Alarma de limpieza creada');
  }
});

// Manejar mensajes de forma segura
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Mensaje recibido:', message.type);
  
  try {
    switch (message.type) {
      case 'contentScriptReady':
        console.log('Content script está listo');
        sendResponse({ success: true });
        break;
        
      case 'analysisProgress':
        // Reenviar al popup si es necesario
        console.log('Progreso del análisis recibido');
        break;
        
      case 'analysisComplete':
        console.log('Análisis completado');
        break;
        
      case 'analysisError':
        console.log('Error en análisis:', message.data?.error);
        break;
        
      case 'trackUsage':
        console.log('Uso registrado:', message.action);
        sendResponse({ success: true });
        break;
        
      default:
        console.log('Tipo de mensaje desconocido:', message.type);
        sendResponse({ success: false, error: 'Mensaje no reconocido' });
    }
  } catch (error) {
    console.error('Error procesando mensaje:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Mantener canal abierto
});

// Manejar alarmas solo si están disponibles
if (chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Alarma activada:', alarm.name);
    
    if (alarm.name === 'cleanup') {
      // Limpiar storage de forma segura
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.clear()
          .then(() => console.log('Storage limpiado'))
          .catch(error => console.error('Error limpiando storage:', error));
      }
    }
  });
}

// Evento de inicio
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker reiniciado');
});

// background.js - Versión mínima para testing

// Solo lo esencial para que funcione
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extensión instalada correctamente');
});

// Manejar mensajes básicos
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Mensaje:', message.type);
  sendResponse({ success: true });
  return true;  // Importante: mantener el canal abierto
});

console.log('Background script configurado correctamente');