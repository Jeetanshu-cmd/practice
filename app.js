const starterPrompts = [
  'Explain the critical findings in simple language.',
  'Which values should I monitor more closely over time?',
  'What lifestyle changes may help improve elevated markers?',
  'What questions should I ask my doctor at my next visit?',
  'Can you summarize this report for a family member?'
];

const demoAnalysis = {
  critical: ['Upload a report to generate an AI-assisted summary of urgent findings.'],
  moderate: ['Moderate findings will appear here once the document is analyzed.'],
  elevated: ['Elevated markers and trend observations will be listed here.'],
  metrics: [
    {
      name: 'Hemoglobin',
      value: '--',
      unit: '',
      severity: 'moderate',
      summary: 'Waiting for report upload',
      tip: 'Balanced nutrition, hydration, and clinician-guided supplements can help when levels are low.'
    },
    {
      name: 'Glucose',
      value: '--',
      unit: '',
      severity: 'elevated',
      summary: 'Awaiting analysis',
      tip: 'Consistent meals, fewer refined sugars, and routine exercise often support glucose control.'
    },
    {
      name: 'Vitamin D',
      value: '--',
      unit: '',
      severity: 'critical',
      summary: 'No recent report yet',
      tip: 'Sunlight exposure and doctor-recommended supplementation may help improve vitamin D status.'
    }
  ]
};

const state = {
  config: null,
  supabase: null,
  session: null,
  user: null,
  chart: null,
  reports: [],
  selectedReport: null,
  chatSessionId: null,
  chatMessages: [],
  authMode: 'oauth',
  theme: localStorage.getItem('medinsight-theme') || 'light'
};

const els = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindEvents();
  applyTheme(state.theme);
  renderStarterPrompts();
  renderFindings(demoAnalysis);
  renderMetrics(demoAnalysis.metrics, els.metricList);
  renderHistory([]);
  renderChatThread([
    {
      role: 'assistant',
      content: 'I can explain findings, compare markers, and help prepare questions for your doctor once you are signed in and connected.'
    }
  ]);
  await bootstrapConfig();
}

function cacheElements() {
  Object.assign(els, {
    authTitle: document.getElementById('authTitle'),
    authStatusBadge: document.getElementById('authStatusBadge'),
    authCopy: document.getElementById('authCopy'),
    authHelperText: document.getElementById('authHelperText'),
    signedOutState: document.getElementById('signedOutState'),
    signedInState: document.getElementById('signedInState'),
    toggleAuthModeBtn: document.getElementById('toggleAuthModeBtn'),
    googleSignInBtn: document.getElementById('googleSignInBtn'),
    signOutBtn: document.getElementById('signOutBtn'),
    refreshDataBtn: document.getElementById('refreshDataBtn'),
    authForm: document.getElementById('authForm'),
    authEmail: document.getElementById('authEmail'),
    authPassword: document.getElementById('authPassword'),
    authSubmitBtn: document.getElementById('authSubmitBtn'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    themeToggle: document.getElementById('themeToggle'),
    themeToggleIcon: document.getElementById('themeToggleIcon'),
    reportInput: document.getElementById('reportInput'),
    uploadTriggerBtn: document.getElementById('uploadTriggerBtn'),
    analysisStatusPill: document.getElementById('analysisStatusPill'),
    metricList: document.getElementById('metricList'),
    criticalFindings: document.getElementById('criticalFindings'),
    moderateFindings: document.getElementById('moderateFindings'),
    elevatedFindings: document.getElementById('elevatedFindings'),
    historyTable: document.getElementById('historyTable'),
    promptList: document.getElementById('promptList'),
    chatThread: document.getElementById('chatThread'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),
    chatSubmitBtn: document.getElementById('chatSubmitBtn'),
    toast: document.getElementById('toast'),
    reportDetailModal: document.getElementById('reportDetailModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    modalReportTitle: document.getElementById('modalReportTitle'),
    modalMeta: document.getElementById('modalMeta'),
    modalCriticalFindings: document.getElementById('modalCriticalFindings'),
    modalModerateFindings: document.getElementById('modalModerateFindings'),
    modalElevatedFindings: document.getElementById('modalElevatedFindings'),
    modalMetricList: document.getElementById('modalMetricList'),
    openFileLink: document.getElementById('openFileLink'),
    viewLatestDetailsBtn: document.getElementById('viewLatestDetailsBtn')
  });
}

function bindEvents() {
  document.querySelectorAll('[data-view-trigger]').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.viewTrigger));
  });

  els.themeToggle.addEventListener('click', () => {
    applyTheme(state.theme === 'light' ? 'dark' : 'light');
  });

  els.uploadTriggerBtn.addEventListener('click', () => {
    if (!state.session) {
      showToast('Sign in before uploading a report.');
      return;
    }
    els.reportInput.click();
  });

  els.reportInput.addEventListener('change', async (event) => {
    const [file] = event.target.files;
    if (file) {
      await uploadReport(file);
    }
    event.target.value = '';
  });

  els.toggleAuthModeBtn.addEventListener('click', toggleAuthMode);
  els.googleSignInBtn.addEventListener('click', signInWithGoogle);
  els.signOutBtn.addEventListener('click', signOut);
  els.refreshDataBtn.addEventListener('click', refreshAuthenticatedData);
  els.authForm.addEventListener('submit', submitAuthForm);
  els.chatForm.addEventListener('submit', submitChatMessage);
  els.closeModalBtn.addEventListener('click', closeDetailModal);
  els.viewLatestDetailsBtn.addEventListener('click', () => openReportModal(state.selectedReport));
  els.reportDetailModal.addEventListener('click', (event) => {
    if (event.target === els.reportDetailModal) closeDetailModal();
  });
}

async function bootstrapConfig() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Config endpoint unavailable');

    state.config = await response.json();

    if (!state.config.supabaseUrl || !state.config.supabaseAnonKey) {
      els.authStatusBadge.textContent = 'Configuration needed';
      els.authHelperText.textContent = 'Add Supabase URL and anon key to Vercel environment variables to enable authentication.';
      renderChart([]);
      return;
    }

    state.supabase = window.supabase.createClient(state.config.supabaseUrl, state.config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    const { data } = await state.supabase.auth.getSession();
    state.session = data.session;
    state.user = data.session?.user || null;
    state.supabase.auth.onAuthStateChange(async (_event, session) => {
      state.session = session;
      state.user = session?.user || null;
      await updateAuthUi();
      if (session) await refreshAuthenticatedData();
    });

    await updateAuthUi();

    if (state.session) {
      await refreshAuthenticatedData();
    } else {
      renderChart([]);
    }
  } catch (error) {
    console.error(error);
    els.authStatusBadge.textContent = 'Backend unavailable';
    els.authHelperText.textContent = 'Could not load runtime configuration. The UI is available, but auth and storage are disabled until the backend is configured.';
    renderChart([]);
  }
}

async function updateAuthUi() {
  const connected = Boolean(state.session);

  els.signedOutState.classList.toggle('hidden', connected);
  els.signedInState.classList.toggle('hidden', !connected);
  els.authTitle.textContent = connected ? 'Workspace connected' : 'Secure sign in';
  els.authCopy.textContent = connected
    ? 'Your reports, history, and Dr.AI conversations are tied to your secure account.'
    : 'Sign in to store reports, sync your history, and continue conversations with Dr.AI.';
  els.authStatusBadge.textContent = connected ? 'Connected' : state.supabase ? 'Ready' : 'Offline ready';

  if (connected) {
    const displayName = state.user.user_metadata?.full_name || state.user.email?.split('@')[0] || 'MedInsight user';
    els.profileName.textContent = displayName;
    els.profileEmail.textContent = state.user.email || 'Authenticated user';
    els.profileAvatar.textContent = initials(displayName);
  }

  const usingEmailMode = state.authMode === 'email';
  els.authForm.classList.toggle('hidden', !usingEmailMode || connected);
  els.googleSignInBtn.classList.toggle('hidden', usingEmailMode || connected);
  els.toggleAuthModeBtn.classList.toggle('hidden', connected);
  els.toggleAuthModeBtn.textContent = usingEmailMode ? 'Back to Google sign-in' : 'Use email instead';
  els.authSubmitBtn.textContent = usingEmailMode ? 'Sign in / Sign up' : 'Sign in';
}

function toggleAuthMode() {
  state.authMode = state.authMode === 'oauth' ? 'email' : 'oauth';
  updateAuthUi();
}

async function signInWithGoogle() {
  if (!state.supabase) {
    showToast('Supabase config is missing.');
    return;
  }

  const { error } = await state.supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) {
    showToast(error.message);
  }
}

async function submitAuthForm(event) {
  event.preventDefault();

  if (!state.supabase) {
    showToast('Supabase config is missing.');
    return;
  }

  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) return;

  const signInAttempt = await state.supabase.auth.signInWithPassword({ email, password });
  if (!signInAttempt.error) {
    showToast('Signed in successfully.');
    return;
  }

  const signUpAttempt = await state.supabase.auth.signUp({ email, password });
  if (signUpAttempt.error) {
    showToast(signUpAttempt.error.message);
    return;
  }

  showToast('Account created. Check your email if confirmation is enabled.');
}

async function signOut() {
  if (!state.supabase) return;
  await state.supabase.auth.signOut();
  state.reports = [];
  state.selectedReport = null;
  state.chatMessages = [];
  state.chatSessionId = null;
  renderHistory([]);
  renderFindings(demoAnalysis);
  renderMetrics(demoAnalysis.metrics, els.metricList);
  renderChatThread([
    { role: 'assistant', content: 'You have signed out. Sign back in to continue stored conversations.' }
  ]);
  renderChart([]);
}

async function refreshAuthenticatedData() {
  if (!state.supabase || !state.session) return;

  await Promise.all([loadReports(), loadChatSession()]);
}

async function loadReports() {
  const { data, error } = await state.supabase
    .from('reports')
    .select('id, file_name, file_type, storage_path, uploaded_at, analysis_status, summary_json')
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error(error);
    showToast('Unable to load reports.');
    return;
  }

  state.reports = data || [];
  renderHistory(state.reports);

  if (state.reports[0]) {
    await hydrateLatestReport(state.reports[0].id);
  } else {
    renderFindings(demoAnalysis);
    renderMetrics(demoAnalysis.metrics, els.metricList);
    renderChart([]);
    els.analysisStatusPill.textContent = 'Awaiting report';
  }
}

async function hydrateLatestReport(reportId) {
  const report = await loadReportDetail(reportId);
  if (!report) return;
  state.selectedReport = report;
  const summary = report.summary_json || {};

  els.analysisStatusPill.textContent = readableStatus(report.analysis_status || 'completed');
  els.viewLatestDetailsBtn.classList.remove('hidden');
  renderFindings(summary);
  renderMetrics(report.metrics, els.metricList);
  renderChart(report.metrics);
}

async function loadReportDetail(reportId) {
  const { data: report, error: reportError } = await state.supabase
    .from('reports')
    .select('id, file_name, file_type, storage_path, uploaded_at, analysis_status, summary_json')
    .eq('id', reportId)
    .single();

  if (reportError) {
    console.error(reportError);
    showToast('Unable to load report details.');
    return null;
  }

  const { data: metrics } = await state.supabase
    .from('report_metrics')
    .select('metric_name, value, unit, severity, summary, tip')
    .eq('report_id', reportId)
    .order('metric_name');

  return {
    ...report,
    metrics: metrics || []
  };
}

async function uploadReport(file) {
  if (!state.supabase || !state.session) {
    showToast('Please sign in first.');
    return;
  }

  try {
    els.analysisStatusPill.textContent = 'Uploading';
    const extension = (file.name.split('.').pop() || 'bin').toLowerCase();
    const objectPath = `${state.user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await state.supabase.storage
      .from('reports')
      .upload(objectPath, file, { upsert: false, contentType: file.type || mimeFromExtension(extension) });

    if (uploadError) throw uploadError;

    const { data: reportRow, error: insertError } = await state.supabase
      .from('reports')
      .insert({
        user_id: state.user.id,
        file_name: file.name,
        file_type: extension,
        storage_path: objectPath,
        analysis_status: 'processing'
      })
      .select('id, file_name, file_type, storage_path, uploaded_at, analysis_status, summary_json')
      .single();

    if (insertError) throw insertError;

    showToast('Report uploaded. Starting analysis...');
    els.analysisStatusPill.textContent = 'Analyzing';

    const token = state.session.access_token;
    const response = await fetch('/api/analyze-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ reportId: reportRow.id })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Analysis failed');
    }

    showToast('Analysis complete.');
    await loadReports();
    switchView('dashboard');
  } catch (error) {
    console.error(error);
    els.analysisStatusPill.textContent = 'Upload failed';
    showToast(error.message || 'Upload failed.');
  }
}

function renderHistory(reports) {
  if (!reports.length) {
    els.historyTable.innerHTML = `<div class="empty-state">No reports uploaded yet. Your report history will appear here with timestamps and quick detail access.</div>`;
    return;
  }

  els.historyTable.innerHTML = reports
    .map((report) => {
      const uploaded = new Date(report.uploaded_at);
      return `
        <article class="history-row">
          <div class="history-file">
            <strong>${escapeHtml(report.file_name)}</strong>
            <span>Status: ${escapeHtml(readableStatus(report.analysis_status || 'processing'))}</span>
          </div>
          <div class="history-meta">${uploaded.toLocaleDateString()}</div>
          <div class="history-meta">${uploaded.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <button class="secondary-btn history-eye" type="button" data-open-report="${report.id}">Eye</button>
        </article>
      `;
    })
    .join('');

  els.historyTable.querySelectorAll('[data-open-report]').forEach((button) => {
    button.addEventListener('click', async () => {
      const report = await loadReportDetail(button.dataset.openReport);
      if (report) {
        openReportModal(report);
      }
    });
  });
}

function openReportModal(report) {
  if (!report) return;
  state.selectedReport = report;
  const summary = report.summary_json || {};
  const uploaded = new Date(report.uploaded_at);

  els.modalReportTitle.textContent = report.file_name;
  els.modalMeta.innerHTML = [
    `<span>${escapeHtml(readableStatus(report.analysis_status || 'processing'))}</span>`,
    `<span>${uploaded.toLocaleDateString()}</span>`,
    `<span>${uploaded.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`
  ].join('');

  renderList(els.modalCriticalFindings, summary.critical || ['No critical findings recorded.']);
  renderList(els.modalModerateFindings, summary.moderate || ['No moderate findings recorded.']);
  renderList(els.modalElevatedFindings, summary.elevated || ['No elevated findings recorded.']);
  renderMetrics(report.metrics || [], els.modalMetricList);

  els.openFileLink.classList.add('hidden');
  resolveReportLink(report.storage_path).then((url) => {
    if (url) {
      els.openFileLink.href = url;
      els.openFileLink.classList.remove('hidden');
    }
  });

  els.reportDetailModal.showModal();
}

function closeDetailModal() {
  if (els.reportDetailModal.open) els.reportDetailModal.close();
}

async function resolveReportLink(storagePath) {
  if (!state.supabase || !storagePath) return null;
  const { data } = await state.supabase.storage.from('reports').createSignedUrl(storagePath, 60 * 10);
  return data?.signedUrl || null;
}

function renderFindings(summary) {
  renderList(els.criticalFindings, summary.critical || ['No critical findings noted.']);
  renderList(els.moderateFindings, summary.moderate || ['No moderate findings noted.']);
  renderList(els.elevatedFindings, summary.elevated || ['No elevated findings noted.']);
}

function renderList(element, items) {
  element.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderMetrics(metrics, target) {
  if (!metrics?.length) {
    target.innerHTML = `<div class="empty-state">Metric cards will appear here after report analysis.</div>`;
    return;
  }

  target.innerHTML = metrics
    .map((metric) => {
      const severity = metric.severity || 'moderate';
      return `
        <article class="metric-item" tabindex="0" data-severity="${escapeHtml(severity)}">
          <div class="metric-tip">${escapeHtml(metric.tip || 'No balancing tip available for this metric yet.')}</div>
          <header>
            <div>
              <strong>${escapeHtml(metric.metric_name || metric.name)}</strong>
              <span class="muted-text">${escapeHtml(metric.summary || 'Clinical marker')}</span>
            </div>
            <span class="status-pill">${escapeHtml(readableStatus(severity))}</span>
          </header>
          <div class="metric-value">${escapeHtml(String(metric.value ?? '--'))} ${escapeHtml(metric.unit || '')}</div>
          <div class="metric-meta">Hover for a practical balancing tip tailored to this marker.</div>
        </article>
      `;
    })
    .join('');
}

function renderChart(metrics) {
  const ctx = document.getElementById('analysisChart');
  if (!ctx) return;

  const chartMetrics = (metrics || []).slice(0, 6);
  const labels = chartMetrics.map((metric) => metric.metric_name || metric.name);
  const values = chartMetrics.map((metric, index) => severityScore(metric.severity) + index * 0.1);
  const colors = chartMetrics.map((metric) => severityColor(metric.severity));

  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Awaiting upload'],
      datasets: [
        {
          label: 'Priority score',
          data: values.length ? values : [0],
          backgroundColor: colors.length ? colors : ['rgba(47, 111, 237, 0.35)'],
          borderRadius: 10,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              if (!chartMetrics.length) return 'Upload a report to visualize severity.';
              const metric = chartMetrics[context.dataIndex];
              return `${metric.metric_name || metric.name}: ${readableStatus(metric.severity)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: cssVar('--text-soft') },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          suggestedMax: 3.5,
          ticks: {
            stepSize: 1,
            color: cssVar('--text-soft'),
            callback(value) {
              return value === 0 ? '' : value;
            }
          },
          grid: { color: colorWithAlpha(cssVar('--border-strong'), 0.45) }
        }
      }
    }
  });
}

async function loadChatSession() {
  const { data: sessions } = await state.supabase
    .from('chat_sessions')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1);

  let sessionId = sessions?.[0]?.id;
  if (!sessionId) {
    const { data: created, error } = await state.supabase
      .from('chat_sessions')
      .insert({ user_id: state.user.id, title: 'General medical questions' })
      .select('id')
      .single();
    if (error) {
      console.error(error);
      return;
    }
    sessionId = created.id;
  }

  state.chatSessionId = sessionId;
  const { data: messages } = await state.supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  state.chatMessages = messages || [];
  renderChatThread(
    state.chatMessages.length
      ? state.chatMessages
      : [{ role: 'assistant', content: 'Ask me about your reports, trends, or clinical terms and I will help explain them clearly.' }]
  );
}

function renderStarterPrompts() {
  els.promptList.innerHTML = starterPrompts
    .map((prompt) => `<button class="prompt-chip" type="button">${escapeHtml(prompt)}</button>`)
    .join('');

  els.promptList.querySelectorAll('.prompt-chip').forEach((button) => {
    button.addEventListener('click', () => {
      els.chatInput.value = button.textContent;
      els.chatInput.focus();
    });
  });
}

function renderChatThread(messages) {
  els.chatThread.innerHTML = messages
    .map(
      (message) =>
        `<article class="chat-bubble ${escapeHtml(message.role)}">${escapeHtml(message.content)}</article>`
    )
    .join('');
  els.chatThread.scrollTop = els.chatThread.scrollHeight;
}

async function submitChatMessage(event) {
  event.preventDefault();
  const message = els.chatInput.value.trim();
  if (!message) return;

  if (!state.session || !state.chatSessionId) {
    showToast('Sign in to use Dr.AI.');
    return;
  }

  const optimistic = [...state.chatMessages, { role: 'user', content: message }];
  renderChatThread([...optimistic, { role: 'assistant', content: 'Thinking...' }]);
  els.chatInput.value = '';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.session.access_token}`
      },
      body: JSON.stringify({ sessionId: state.chatSessionId, message })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Chat request failed');
    }

    state.chatMessages = payload.messages || optimistic;
    renderChatThread(state.chatMessages);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Unable to send message.');
    renderChatThread(optimistic);
  }
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.dataset.view === viewName);
  });
  document.querySelectorAll('.nav-btn[data-view-trigger]').forEach((button) => {
    button.classList.toggle('active', button.dataset.viewTrigger === viewName);
  });
}

function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem('medinsight-theme', theme);
  document.body.dataset.theme = theme;
  els.themeToggleIcon.textContent = theme === 'light' ? '☾' : '☀';
  if (state.chart) {
    renderChart(state.selectedReport?.metrics || []);
  }
}

function severityScore(severity = '') {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 3;
    case 'elevated':
      return 2;
    case 'moderate':
      return 1;
    default:
      return 0.5;
  }
}

function severityColor(severity = '') {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'rgba(199, 76, 76, 0.75)';
    case 'elevated':
      return 'rgba(190, 106, 51, 0.75)';
    case 'moderate':
      return 'rgba(208, 138, 28, 0.75)';
    default:
      return 'rgba(47, 111, 237, 0.55)';
  }
}

function readableStatus(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function sanitizeFileName(fileName) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
}

function mimeFromExtension(extension) {
  const types = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain'
  };
  return types[extension] || 'application/octet-stream';
}

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function colorWithAlpha(color, alpha) {
  const temp = document.createElement('div');
  temp.style.color = color;
  document.body.appendChild(temp);
  const rgb = getComputedStyle(temp).color.match(/\d+/g) || ['0', '0', '0'];
  temp.remove();
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove('show');
  }, 3200);
}
