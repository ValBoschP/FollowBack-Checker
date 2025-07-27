// popup.js - Lógica de la interfaz de usuario
document.addEventListener('DOMContentLoaded', async () => {
  // Elementos DOM
  const startBtn = document.getElementById('startAnalysis');
  const stopBtn = document.getElementById('stopAnalysis');
  const exportBtn = document.getElementById('exportBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const statusDescription = document.getElementById('statusDescription');
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const resultsContainer = document.getElementById('resultsContainer');
  const resultsCount = document.getElementById('resultsCount');
  const userList = document.getElementById('userList');

  // Estado de la aplicación
  let currentResults = [];
  let isAnalyzing = false;

  // Verificar estado inicial
  async function checkStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('instagram.com')) {
        updateStatus('error', 'No estás en Instagram', 'Ve a www.instagram.com para usar esta extensión');
        startBtn.disabled = true;
        return false;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkStatus' });
      
      if (!response.isInstagram) {
        updateStatus('error', 'No estás en Instagram', 'Ve a www.instagram.com para usar esta extensión');
        startBtn.disabled = true;
        return false;
      }

      if (!response.isLoggedIn) {
        updateStatus('warning', 'No estás logueado', 'Inicia sesión en Instagram primero');
        startBtn.disabled = true;
        return false;
      }

      updateStatus('success', 'Listo para analizar', 'Todo configurado correctamente');
      startBtn.disabled = false;
      return true;

    } catch (error) {
      updateStatus('error', 'Error de conexión', 'Recarga la página de Instagram e intenta de nuevo');
      startBtn.disabled = true;
      return false;
    }
  }

  // Actualizar estado visual
  function updateStatus(type, text, description = '') {
    statusDot.className = `status-dot ${type === 'success' ? '' : type}`;
    statusText.textContent = text;
    statusDescription.textContent = description;
  }

  // Actualizar progreso
  function updateProgress(data) {
    progressFill.style.width = `${data.progress}%`;
    progressText.textContent = `${data.progress}% - ${data.processed}/${data.total} procesados`;
    
    // Actualizar resultados en tiempo real
    if (data.users && data.users.length > 0) {
      currentResults = data.users;
      updateResults(data.users);
    }
  }

  // Actualizar lista de resultados
  function updateResults(users) {
    resultsCount.textContent = `${users.length} usuarios no te siguen`;
    
    // Limpiar lista anterior
    userList.innerHTML = '';
    
    // Mostrar hasta 50 usuarios para evitar lentitud
    const displayUsers = users.slice(0, 50);
    
    displayUsers.forEach(user => {
      const userItem = document.createElement('div');
      userItem.className = 'user-item';
      
      userItem.innerHTML = `
        <img class="user-avatar" src="${user.profile_pic_url || 'icons/icon32.png'}" 
             onerror="this.src='icons/icon32.png'" alt="${user.username}">
        <div class="user-info">
          <div class="username">@${user.username} ${user.is_verified ? '✓' : ''}</div>
          <div class="full-name">${user.full_name || ''}</div>
        </div>
      `;
      
      // Hacer clic para ir al perfil
      userItem.addEventListener('click', () => {
        chrome.tabs.create({ 
          url: `https://www.instagram.com/${user.username}/` 
        });
      });
      
      userList.appendChild(userItem);
    });

    // Mostrar aviso si hay más usuarios
    if (users.length > 50) {
      const moreItem = document.createElement('div');
      moreItem.className = 'user-item';
      moreItem.style.textAlign = 'center';
      moreItem.style.opacity = '0.7';
      moreItem.innerHTML = `<div style="flex: 1;">... y ${users.length - 50} usuarios más</div>`;
      userList.appendChild(moreItem);
    }

    resultsContainer.style.display = 'block';
  }

  // Iniciar análisis
  startBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'startAnalysis' });
      
      if (response.success) {
        isAnalyzing = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        progressContainer.style.display = 'block';
        updateStatus('warning', 'Analizando...', 'Este proceso puede tomar varios minutos');
        
        // Limpiar resultados anteriores
        resultsContainer.style.display = 'none';
        currentResults = [];
      } else {
        updateStatus('error', 'Error', response.error || 'No se pudo iniciar el análisis');
      }
    } catch (error) {
      updateStatus('error', 'Error de comunicación', 'Recarga Instagram e intenta de nuevo');
    }
  });

  // Detener análisis
  stopBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'stopAnalysis' });
      
      isAnalyzing = false;
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      updateStatus('warning', 'Análisis detenido', 'Puedes reiniciar cuando quieras');
    } catch (error) {
      console.error('Error al detener análisis:', error);
    }
  });

  // Exportar resultados
  exportBtn.addEventListener('click', async () => {
    if (currentResults.length === 0) {
      alert('No hay resultados para exportar');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'exportResults', 
        users: currentResults 
      });
      
      if (response.success) {
        // Mostrar confirmación visual
        const originalText = exportBtn.textContent;
        exportBtn.textContent = '✅ Exportado';
        setTimeout(() => {
          exportBtn.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      alert('Error al exportar resultados');
    }
  });

  // Escuchar mensajes del content script
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'analysisProgress':
        updateProgress(message.data);
        break;
        
      case 'analysisComplete':
        isAnalyzing = false;
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        
        if (message.data.success) {
          updateStatus('success', 'Análisis completado', `Se encontraron ${message.data.unfollowers} usuarios`);
          currentResults = message.data.users;
          updateResults(message.data.users);
        } else {
          updateStatus('error', 'Error en el análisis', message.data.error);
        }
        break;
        
      case 'analysisError':
        isAnalyzing = false;
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        updateStatus('error', 'Error', message.data.error);
        break;
    }
  });

  // Enlaces del footer
  document.getElementById('privacyLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://tu-sitio.com/privacy' });
  });

  document.getElementById('supportLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://tu-sitio.com/support' });
  });

  // Verificar estado inicial
  await checkStatus();
});