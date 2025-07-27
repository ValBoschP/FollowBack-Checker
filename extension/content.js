// content.js - Script que se ejecuta en la página de Instagram
(() => {
  'use strict';

  // Variables globales
  let isAnalysisRunning = false;
  let shouldStop = false;

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

  // Función principal adaptada
  async function analyzeUnfollowers(progressCallback) {
    const csrftoken = getCookie('csrftoken');
    const ds_user_id = getCookie('ds_user_id');
    
    if (!csrftoken || !ds_user_id) {
      throw new Error('No se puede acceder a las cookies de Instagram. Asegúrate de estar logueado.');
    }

    const initialURL = `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${ds_user_id}","include_reel":"true","fetch_mutual":"false","first":"24"}`;
    
    let followedPeople = 0;
    let doNext = true;
    let filteredList = [];
    let getUnfollowCounter = 0;
    let scrollCycle = 0;
    let currentURL = initialURL;

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

      return {
        success: true,
        users: filteredList,
        total: followedPeople,
        unfollowers: filteredList.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        users: filteredList
      };
    }
  }

  // Función para exportar resultados
  function exportResults(users) {
    const data = {
      exportDate: new Date().toISOString(),
      totalUnfollowers: users.length,
      users: users.map(user => ({
        username: user.username,
        full_name: user.full_name,
        is_verified: user.is_verified
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instagram-unfollowers-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  // Comunicación con popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'checkStatus':
        sendResponse(checkInstagramStatus());
        break;

      case 'startAnalysis':
        if (isAnalysisRunning) {
          sendResponse({ success: false, error: 'El análisis ya está en curso' });
          return;
        }

        isAnalysisRunning = true;
        shouldStop = false;

        analyzeUnfollowers((progress) => {
          // Enviar progreso al popup
          chrome.runtime.sendMessage({
            type: 'analysisProgress',
            data: progress
          });
        }).then(result => {
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

        sendResponse({ success: true });
        break;

      case 'stopAnalysis':
        shouldStop = true;
        isAnalysisRunning = false;
        sendResponse({ success: true });
        break;

      case 'exportResults':
        if (request.users && request.users.length > 0) {
          exportResults(request.users);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No hay datos para exportar' });
        }
        break;

      default:
        sendResponse({ success: false, error: 'Acción no reconocida' });
    }
  });

  // Notificar que el content script está listo
  chrome.runtime.sendMessage({ type: 'contentScriptReady' });
})();