// popup.js - UI logic
document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const startBtn = document.getElementById('startAnalysis');
  const resumeBtn = document.getElementById('resumeAnalysis');
  const stopBtn = document.getElementById('stopAnalysis');
  const exportBtn = document.getElementById('exportBtn');
  const exportFormat = document.getElementById('exportFormat');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const statusDescription = document.getElementById('statusDescription');
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const resultsContainer = document.getElementById('resultsContainer');
  const resultsCount = document.getElementById('resultsCount');
  const userList = document.getElementById('userList');
  const previousResults = document.getElementById('previousResults');
  const previousResultsContent = document.getElementById('previousResultsContent');
  const loadPreviousBtn = document.getElementById('loadPreviousBtn');
  const exportPreviousBtn = document.getElementById('exportPreviousBtn');

  // App state
  let currentResults = [];
  let previousAnalysisData = [];
  let isAnalyzing = false;
  let canResume = false;

  // Load previous analysis
  async function loadPreviousAnalysis() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPreviousAnalysis' });
      
      if (response.success) {
        previousAnalysisData = response.previousAnalysis;
        canResume = response.canResume;
        
        // Show resume button if there is a pending analysis
        if (canResume) {
          resumeBtn.style.display = 'block';
          updateStatus('warning', 'Pending analysis', 'You can continue where you left off');
        }
        
        // Show last analysis if exists
        if (previousAnalysisData.length > 0) {
          const lastAnalysis = previousAnalysisData[0];
          previousResults.style.display = 'block';
          
          const date = new Date(lastAnalysis.date).toLocaleDateString('en-US');
          const time = new Date(lastAnalysis.date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });
          
          previousResultsContent.innerHTML = `
            <div style="font-size: 12px; opacity: 0.8;">
              ${date} ${time}
            </div>
            <div style="font-size: 13px; font-weight: 500; margin-top: 4px;">
              ${lastAnalysis.totalUnfollowers} users don't follow you
            </div>
            <div style="font-size: 11px; opacity: 0.7;">
              Out of ${lastAnalysis.totalFollowing} you follow
            </div>
          `;
        }
      }
    } catch (error) {
      console.error('Error loading previous analysis:', error);
    }
  }
  // Check initial status
  async function checkStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('instagram.com')) {
        updateStatus('error', "You're not on Instagram", 'Go to www.instagram.com to use this extension');
        startBtn.disabled = true;
        resumeBtn.disabled = true;
        return false;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkStatus' });
      
      if (!response.isInstagram) {
        updateStatus('error', "You're not on Instagram", 'Go to www.instagram.com to use this extension');
        startBtn.disabled = true;
        resumeBtn.disabled = true;
        return false;
      }

      if (!response.isLoggedIn) {
        updateStatus('warning', "You're not logged in", 'Please log in to Instagram first');
        startBtn.disabled = true;
        resumeBtn.disabled = true;
        return false;
      }

      if (!canResume) {
        updateStatus('success', 'Ready to analyze', 'Everything is set up correctly');
      }
      startBtn.disabled = false;
      resumeBtn.disabled = false;
      return true;

    } catch (error) {
      updateStatus('error', 'Connection error', 'Reload the Instagram page and try again');
      startBtn.disabled = true;
      resumeBtn.disabled = true;
      return false;
    }
  }

  // Update visual status
  function updateStatus(type, text, description = '') {
    statusDot.className = `status-dot ${type === 'success' ? '' : type}`;
    statusText.textContent = text;
    statusDescription.textContent = description;
  }

  // Update progress
  function updateProgress(data) {
    progressFill.style.width = `${data.progress}%`;
    progressText.textContent = `${data.progress}% - ${data.processed}/${data.total} processed`;
    
    // Update real-time results
    if (data.users && data.users.length > 0) {
      currentResults = data.users;
      updateResults(data.users);
    }
  }

  // Update results list
  function updateResults(users) {
    resultsCount.textContent = `${users.length} users don't follow you`;
    
    // Clear previous list
    userList.innerHTML = '';
    
    // Show up to 50 users to avoid slowness
    const displayUsers = users.slice(0, 50);
    
    displayUsers.forEach(user => {
      const userItem = document.createElement('div');
      userItem.className = 'user-item';
      
      userItem.innerHTML = `
        <div class="user-info">
          <div class="username">@${user.username} ${user.is_verified ? '✓' : ''}</div>
          <div class="full-name">${user.full_name || ''}</div>
        </div>
      `;
      
      // Click to go to profile
      userItem.addEventListener('click', () => {
        chrome.tabs.create({ 
          url: `https://www.instagram.com/${user.username}/` 
        });
      });
      
      userList.appendChild(userItem);
    });

    // Show notice if there are more users
    if (users.length > 50) {
      const moreItem = document.createElement('div');
      moreItem.className = 'user-item';
      moreItem.style.textAlign = 'center';
      moreItem.style.opacity = '0.7';
      moreItem.innerHTML = `<div style="flex: 1;">... and ${users.length - 50} more users</div>`;
      userList.appendChild(moreItem);
    }

    resultsContainer.style.display = 'block';
  }

  // Function to start analysis (new or resume)
  async function startAnalysis(resume = false) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'startAnalysis',
        resume: resume
      });
      
      if (response.success) {
        isAnalyzing = true;
        startBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        progressContainer.style.display = 'block';
        previousResults.style.display = 'none';
        
        const statusMsg = resume ? 'Resuming analysis...' : 'Analyzing...';
        updateStatus('warning', statusMsg, 'This process may take several minutes');
        
        // Clear previous results if new analysis
        if (!resume) {
          resultsContainer.style.display = 'none';
          currentResults = [];
        }
      } else {
        updateStatus('error', 'Error', response.error || 'Could not start analysis');
      }
    } catch (error) {
      updateStatus('error', 'Communication error', 'Reload Instagram and try again');
    }
  }

  // Event listeners for buttons
  startBtn.addEventListener('click', () => startAnalysis(false));
  resumeBtn.addEventListener('click', () => startAnalysis(true));

  // Stop analysis
  stopBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'stopAnalysis' });
      
      isAnalyzing = false;
      startBtn.style.display = 'block';
      resumeBtn.style.display = canResume ? 'block' : 'none';
      stopBtn.style.display = 'none';
      updateStatus('warning', 'Analysis stopped', 'You can continue later');
    } catch (error) {
      console.error('Error stopping analysis:', error);
    }
  });

  // Export current results
  exportBtn.addEventListener('click', async () => {
    if (currentResults.length === 0) {
      alert('No results to export');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const format = exportFormat.value;
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'exportResults', 
        users: currentResults,
        format: format
      });
      
      if (response.success) {
        // Show visual confirmation
        const originalText = exportBtn.textContent;
        exportBtn.textContent = 'Exported';
        setTimeout(() => {
          exportBtn.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      alert('Error exporting results');
    }
  });

  // Load previous results
  loadPreviousBtn.addEventListener('click', () => {
    if (previousAnalysisData.length > 0) {
      const lastAnalysis = previousAnalysisData[0];
      currentResults = lastAnalysis.users;
      updateResults(lastAnalysis.users);
      
      // Hide previous analysis section
      previousResults.style.display = 'none';
    }
  });

  // Export previous analysis
  exportPreviousBtn.addEventListener('click', async () => {
    if (previousAnalysisData.length === 0) {
      alert('No previous analysis');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const lastAnalysis = previousAnalysisData[0];
      const format = exportFormat.value;
      
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'exportResults', 
        users: lastAnalysis.users,
        format: format
      });
      
      if (response.success) {
        const originalText = exportPreviousBtn.textContent;
        exportPreviousBtn.textContent = 'Exported';
        setTimeout(() => {
          exportPreviousBtn.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      alert('Error exporting previous analysis');
    }
  });

  // Clear history
  const clearLink = document.getElementById('clearHistoryLink');
  if (clearLink) {
    clearLink.addEventListener('click', async (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to clear all analysis history?')) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          // ...
        } catch (error) {
          console.error('Error clearing history:', error);
        }
      }
    });
  }


  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'analysisProgress':
        updateProgress(message.data);
        break;
        
      case 'analysisComplete':
        isAnalyzing = false;
        startBtn.style.display = 'block';
        resumeBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        canResume = false;
        
        if (message.data.success) {
          updateStatus('success', 'Analysis complete', `${message.data.unfollowers} users found`);
          currentResults = message.data.users;
          updateResults(message.data.users);
          
          // Hide previous analysis since we have a new one
          previousResults.style.display = 'none';
        } else {
          updateStatus('error', 'Analysis error', message.data.error);
        }
        break;
        
      case 'analysisError':
        isAnalyzing = false;
        startBtn.style.display = 'block';
        resumeBtn.style.display = canResume ? 'block' : 'none';
        stopBtn.style.display = 'none';
        updateStatus('error', 'Error', message.data.error);
        break;
    }
  });
  const privacyLink = document.getElementById('privacyLink');
  if (privacyLink) {
    privacyLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://tu-sitio.com/privacy' });
    });
  }

  const supportLink = document.getElementById('supportLink');
  if (supportLink) {
    supportLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://tu-sitio.com/support' });
    });
  }

  // Footer links
  document.getElementById('privacyLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://tu-sitio.com/privacy' });
  });

  document.getElementById('supportLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://tu-sitio.com/support' });
  });

  // Check initial status and load data
  await checkStatus();
  await loadPreviousAnalysis();
});