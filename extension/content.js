// content.js - Script que se ejecuta en la página de Instagram
(() => {
  'use strict';

  // Variables globales
  let isAnalysisRunning = false;
  let shouldStop = false;

  // Funciones utilitarias (adaptadas de tu script original)
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function afterUrlGenerator(after) {
    const ds_user_id = getCookie('ds_user_id');
    return `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${ds_user_id}","include_reel":"true","fetch_mutual":"false","first":"24","after":"${after}"}`;
  }

  // Función principal adaptada con persistencia
  async function analyzeUnfollowers(progressCallback, resumeFrom = null) {
    const csrftoken = getCookie('csrftoken');
    const ds_user_id = getCookie('ds_user_id');
    
    if (!csrftoken || !ds_user_id) {
      throw new Error('No se puede acceder a las cookies de Instagram. Asegúrate de estar logueado.');
    }

    let followedPeople = resumeFrom?.followedPeople || 0;
    let doNext = true;
    let filteredList = resumeFrom?.filteredList || [];
    let getUnfollowCounter = resumeFrom?.getUnfollowCounter || 0;
    let scrollCycle = resumeFrom?.scrollCycle || 0;
    let currentURL = resumeFrom?.currentURL || `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${ds_user_id}","include_reel":"true","fetch_mutual":"false","first":"24"}`;

    try {
      while (doNext && !shouldStop) {
        let response;
        
        try {
          response = await fetch(currentURL);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          response = await response.json();
        } catch (error) {
          console.log('Error en la solicitud, reintentando...', error);
          await sleep(2000);
          continue;
        }

        // Primera iteración: obtener el total
        if (!followedPeople) {
          followedPeople = response.data.user.edge_follow.count;
        }

        // Procesar usuarios
        const edges = response.data.user.edge_follow.edges;
        edges.forEach(edge => {
          if (!edge.node.follows_viewer) {
            filteredList.push({
              id: edge.node.id,
              username: edge.node.username,
              full_name: edge.node.full_name,
              profile_pic_url: edge.node.profile_pic_url,
              is_verified: edge.node.is_verified
            });
          }
        });

        getUnfollowCounter += edges.length;
        
        // Guardar estado actual para poder resumir
        const currentState = {
          followedPeople,
          filteredList: [...filteredList],
          getUnfollowCounter,
          scrollCycle,
          currentURL,
          doNext: response.data.user.edge_follow.page_info.has_next_page,
          nextCursor: response.data.user.edge_follow.page_info.end_cursor
        };
        
        await saveAnalysisState(currentState);
        
        // Actualizar progreso
        const progress = Math.min(100, Math.round((getUnfollowCounter / followedPeople) * 100));
        progressCallback({
          progress: progress,
          processed: getUnfollowCounter,
          total: followedPeople,
          unfollowers: filteredList.length,
          users: [...filteredList] // Copia para evitar referencias
        });

        // Verificar si hay más páginas
        doNext = response.data.user.edge_follow.page_info.has_next_page;
        if (doNext) {
          currentURL = afterUrlGenerator(response.data.user.edge_follow.page_info.end_cursor);
        }

        // Pausa para evitar rate limiting
        const randomDelay = Math.floor(Math.random() * 400) + 1000;
        await sleep(randomDelay);

        // Pausa más larga cada 6 ciclos
        scrollCycle++;
        if (scrollCycle > 6) {
          scrollCycle = 0;
          console.log('Pausa preventiva para evitar bloqueo temporal...');
          await sleep(10000); // 10 segundos
        }
      }

      const finalResult = {
        success: true,
        users: filteredList,
        total: followedPeople,
        unfollowers: filteredList.length
      };

      // Guardar análisis completado y limpiar estado temporal
      if (!shouldStop) {
        await saveCompletedAnalysis(finalResult);
        await clearAnalysisState();
      }

      return finalResult;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        users: filteredList
      };
    }
  }

  // Verificar si estamos en Instagram
  function checkInstagramStatus() {
    const isInstagram = window.location.hostname === 'www.instagram.com';
    const isLoggedIn = !!getCookie('ds_user_id');
    
    return {
      isInstagram,
      isLoggedIn,
      canAnalyze: isInstagram && isLoggedIn
    };
  }

  // Función para exportar resultados en formato TXT
  function exportResults(users, format = 'txt') {
    const date = new Date().toLocaleDateString('es-ES');
    const time = new Date().toLocaleTimeString('es-ES');
    
    let content, filename, mimeType;
    
    if (format === 'txt') {
      // Formato de texto legible
      content = `=== INSTAGRAM UNFOLLOW TRACKER ===
Fecha: ${date} ${time}
Total de usuarios que no te siguen: ${users.length}

${users.length === 0 ? '¡Genial! Todos tus seguidos te siguen de vuelta 🎉' : 'Lista de usuarios que no te siguen de vuelta:'}

${users.map((user, index) => 
  `${index + 1}. @${user.username}${user.full_name ? ` (${user.full_name})` : ''}${user.is_verified ? ' ✓' : ''}`
).join('\n')}

${users.length > 0 ? `\n--- FIN DE LA LISTA ---\nTotal: ${users.length} usuarios` : ''}

Generado con Instagram Unfollow Tracker
¡Usa esta información de manera responsable! 😊`;

      filename = `instagram-unfollowers-${new Date().toISOString().split('T')[0]}.txt`;
      mimeType = 'text/plain';
    } else {
      // Formato JSON (opción alternativa)
      const data = {
        exportDate: new Date().toISOString(),
        totalUnfollowers: users.length,
        users: users.map(user => ({
          username: user.username,
          full_name: user.full_name,
          is_verified: user.is_verified
        }))
      };
      content = JSON.stringify(data, null, 2);
      filename = `instagram-unfollowers-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Funciones para persistencia de datos
  async function saveAnalysisState(state) {
    try {
      await chrome.storage.local.set({
        analysisState: {
          ...state,
          timestamp: Date.now()
        }
      });
      console.log('Estado guardado:', state);
    } catch (error) {
      console.error('Error guardando estado:', error);
    }
  }

  async function loadAnalysisState() {
    try {
      const result = await chrome.storage.local.get(['analysisState']);
      if (result.analysisState) {
        // Verificar que no sea muy antiguo (más de 24 horas)
        const hoursSinceLastSave = (Date.now() - result.analysisState.timestamp) / (1000 * 60 * 60);
        if (hoursSinceLastSave < 24) {
          console.log('Estado recuperado:', result.analysisState);
          return result.analysisState;
        } else {
          // Limpiar estado antiguo
          await chrome.storage.local.remove(['analysisState']);
          console.log('Estado expirado, limpiado');
        }
      }
    } catch (error) {
      console.error('Error cargando estado:', error);
    }
    return null;
  }

  async function clearAnalysisState() {
    try {
      await chrome.storage.local.remove(['analysisState']);
      console.log('Estado limpiado');
    } catch (error) {
      console.error('Error limpiando estado:', error);
    }
  }

  // Guardar resultados completados
  async function saveCompletedAnalysis(results) {
    try {
      const previousResults = await chrome.storage.local.get(['previousAnalysis']);
      const history = previousResults.previousAnalysis || [];
      
      // Mantener solo los últimos 5 análisis
      history.unshift({
        date: new Date().toISOString(),
        totalUnfollowers: results.users.length,
        users: results.users,
        totalFollowing: results.total
      });
      
      if (history.length > 5) {
        history.splice(5);
      }
      
      await chrome.storage.local.set({ previousAnalysis: history });
      console.log('Análisis guardado en historial');
    } catch (error) {
      console.error('Error guardando análisis:', error);
    }
  }

  // Comunicación con popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'checkStatus':
        sendResponse(checkInstagramStatus());
        break;

      case 'getPreviousAnalysis':
        chrome.storage.local.get(['previousAnalysis', 'analysisState']).then(result => {
          sendResponse({
            success: true,
            previousAnalysis: result.previousAnalysis || [],
            canResume: !!result.analysisState
          });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true; // Respuesta asíncrona

      case 'startAnalysis':
        if (isAnalysisRunning) {
          sendResponse({ success: false, error: 'El análisis ya está en curso' });
          return;
        }

        isAnalysisRunning = true;
        shouldStop = false;

        // Verificar si podemos resumir un análisis anterior
        loadAnalysisState().then(savedState => {
          const resumeFrom = request.resume ? savedState : null;
          
          if (resumeFrom) {
            console.log('Resumiendo análisis desde:', resumeFrom);
          }

          analyzeUnfollowers((progress) => {
            // Enviar progreso al popup
            chrome.runtime.sendMessage({
              type: 'analysisProgress',
              data: progress
            });
          }, resumeFrom).then(result => {
            isAnalysisRunning = false;
            chrome.runtime.sendMessage({
              type: 'analysisComplete',
              data: result
            });
          }).catch(error => {
            isAnalysisRunning = false;
            chrome.runtime.sendMessage({
              type: 'analysisError',
              data: { error: error.message }
            });
          });
        });

        sendResponse({ success: true });
        break;

      case 'stopAnalysis':
        shouldStop = true;
        isAnalysisRunning = false;
        sendResponse({ success: true });
        break;

      case 'exportResults':
        if (request.users && request.users.length > 0) {
          exportResults(request.users, request.format || 'txt');
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No hay datos para exportar' });
        }
        break;

      case 'clearHistory':
        chrome.storage.local.remove(['previousAnalysis', 'analysisState']).then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true; // Respuesta asíncrona

      default:
        sendResponse({ success: false, error: 'Acción no reconocida' });
    }
  });

  // Notificar que el content script está listo
  chrome.runtime.sendMessage({ type: 'contentScriptReady' });
})();