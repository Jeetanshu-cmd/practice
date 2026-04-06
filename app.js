const starterPrompts = [
  'Explain the critical findings in simple language.',
  'Which values should I monitor more closely over time?',
  'What lifestyle changes may help improve elevated markers?',
  'What questions should I ask my doctor at my next visit?',
  'Can you summarize this report for a family member?'
];

const demoAnalysis = {
  overview:
    'No report has been analyzed yet. Once a report is uploaded, this section will provide a longer summary of the main abnormalities, what body systems may be affected, and symptoms that can be associated with the reported findings. This is a report-based interpretation and should still be confirmed with a clinician.',
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
  profileMenuOpen: false,
  chart: null,
  reports: [],
  selectedReport: null,
  chatSessionId: null,
  chatMessages: [],
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
  renderHistoryDetail(null);
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
    signOutBtn: document.getElementById('signOutBtn'),
    refreshDataBtn: document.getElementById('refreshDataBtn'),
    authForm: document.getElementById('authForm'),
    authEmail: document.getElementById('authEmail'),
    authPassword: document.getElementById('authPassword'),
    passwordToggleBtn: document.getElementById('passwordToggleBtn'),
    authSubmitBtn: document.getElementById('authSubmitBtn'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    profileQuickBtn: document.getElementById('profileQuickBtn'),
    profileQuickAvatar: document.getElementById('profileQuickAvatar'),
    profileMenuPanel: document.getElementById('profileMenuPanel'),
    themeToggle: document.getElementById('themeToggle'),
    themeToggleIcon: document.getElementById('themeToggleIcon'),
    reportInput: document.getElementById('reportInput'),
    uploadTriggerBtn: document.getElementById('uploadTriggerBtn'),
    analysisStatusPill: document.getElementById('analysisStatusPill'),
    chartSummary: document.getElementById('chartSummary'),
    analysisOverview: document.getElementById('analysisOverview'),
    metricList: document.getElementById('metricList'),
    criticalFindings: document.getElementById('criticalFindings'),
    moderateFindings: document.getElementById('moderateFindings'),
    elevatedFindings: document.getElementById('elevatedFindings'),
    historyTable: document.getElementById('historyTable'),
    historyDetailCard: document.getElementById('historyDetailCard'),
    historyDetailTitle: document.getElementById('historyDetailTitle'),
    historyDetailCopy: document.getElementById('historyDetailCopy'),
    historyDetailMeta: document.getElementById('historyDetailMeta'),
    historyCriticalFindings: document.getElementById('historyCriticalFindings'),
    historyModerateFindings: document.getElementById('historyModerateFindings'),
    historyElevatedFindings: document.getElementById('historyElevatedFindings'),
    historyMetricList: document.getElementById('historyMetricList'),
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

  els.profileQuickBtn.addEventListener('click', () => {
    toggleProfileMenu();
  });

  document.addEventListener('click', (event) => {
    if (!state.profileMenuOpen) return;
    const clickedInsideMenu = event.target.closest('.profile-menu');
    if (!clickedInsideMenu) {
      toggleProfileMenu(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.profileMenuOpen) {
      toggleProfileMenu(false);
      els.profileQuickBtn.focus();
    }
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

  els.signOutBtn.addEventListener('click', signOut);
  els.refreshDataBtn.addEventListener('click', refreshAuthenticatedData);
  els.passwordToggleBtn.addEventListener('click', togglePasswordVisibility);
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
    state.config = window.MEDINSIGHT_CONFIG || null;

    if (!state.config?.supabaseUrl || !state.config?.supabaseAnonKey) {
      const response = await fetch('/api/config');
      if (!response.ok) throw new Error('Config endpoint unavailable');
      state.config = await response.json();
    }

    if (!state.config.supabaseUrl || !state.config.supabaseAnonKey) {
      els.authStatusBadge.textContent = 'Configuration needed';
      els.authHelperText.textContent = 'Add Supabase public config to `config.js` or expose it through `/api/config`.';
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
    els.authHelperText.textContent = 'Could not load Supabase configuration. The UI is available, but auth and storage are disabled until configuration is reachable.';
    renderChart([]);
  }
}

async function updateAuthUi() {
  const connected = Boolean(state.session);

  els.signedOutState.classList.toggle('hidden', connected);
  els.signedInState.classList.toggle('hidden', !connected);
  els.authTitle.textContent = connected ? 'Account connected' : 'Secure sign in';
  els.authCopy.textContent = connected
    ? 'Your reports, history, and Dr.AI conversations are tied to your secure account.'
    : 'Sign in to store reports, sync your history, and continue conversations with Dr.AI.';
  els.authStatusBadge.textContent = connected ? 'Connected' : state.supabase ? 'Ready' : 'Offline ready';
  els.profileQuickAvatar.classList.toggle('hidden', !connected);
  els.profileQuickBtn.querySelector('.nav-icon').classList.toggle('hidden', connected);

  if (connected) {
    const displayName = state.user.user_metadata?.full_name || state.user.email?.split('@')[0] || 'MedInsight user';
    const shortName = initials(displayName);
    els.profileName.textContent = displayName;
    els.profileEmail.textContent = state.user.email || 'Authenticated user';
    els.profileAvatar.textContent = shortName;
    els.profileQuickAvatar.textContent = shortName;
  }

  els.authForm.classList.toggle('hidden', connected);
  els.authSubmitBtn.textContent = 'Sign in / Sign up';
  els.passwordToggleBtn.textContent = 'Show';
  els.passwordToggleBtn.setAttribute('aria-label', 'Show password');
  els.authPassword.type = 'password';
}

function togglePasswordVisibility() {
  const showing = els.authPassword.type === 'text';
  els.authPassword.type = showing ? 'password' : 'text';
  els.passwordToggleBtn.textContent = showing ? 'Show' : 'Hide';
  els.passwordToggleBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
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

  setButtonBusy(els.authSubmitBtn, true, 'Working...');

  const signInAttempt = await state.supabase.auth.signInWithPassword({ email, password });
  if (!signInAttempt.error) {
    setButtonBusy(els.authSubmitBtn, false, 'Sign in / Sign up');
    showToast('Signed in successfully.');
    toggleProfileMenu(false);
    return;
  }

  const signUpAttempt = await state.supabase.auth.signUp({ email, password });
  if (signUpAttempt.error) {
    setButtonBusy(els.authSubmitBtn, false, 'Sign in / Sign up');
    showToast(signUpAttempt.error.message);
    return;
  }

  setButtonBusy(els.authSubmitBtn, false, 'Sign in / Sign up');
  showToast('Account created. Check your email if confirmation is enabled.');
}

async function signOut() {
  if (!state.supabase) return;
  await state.supabase.auth.signOut();
  toggleProfileMenu(false);
  state.reports = [];
  state.selectedReport = null;
  state.chatMessages = [];
  state.chatSessionId = null;
  renderHistory([]);
  renderHistoryDetail(null);
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
    renderHistoryDetail(null);
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
  renderHistoryDetail(report);
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
    setButtonBusy(els.uploadTriggerBtn, true, 'Uploading...');
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
  } finally {
    setButtonBusy(els.uploadTriggerBtn, false, 'Upload report');
  }
}

function renderHistory(reports) {
  if (!reports.length) {
    els.historyTable.innerHTML = `
      <div class="empty-state">
        <span class="section-icon" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M10 3a7 7 0 1 0 7 7h-2a5 5 0 1 1-1.46-3.54L11 9h6V3l-2.04 2.04A6.96 6.96 0 0 0 10 3Zm-.75 3.5h1.5v4l3 1.8-.75 1.23-3.75-2.28V6.5Z"/></svg></span>
        <strong>No reports uploaded yet</strong>
      </div>
    `;
    return;
  }

  els.historyTable.innerHTML = reports
    .map((report) => {
      const uploaded = new Date(report.uploaded_at);
      const status = readableStatus(report.analysis_status || 'processing');
      const extension = String(report.file_type || '').toUpperCase();
      return `
        <article class="history-row">
          <div class="history-file">
            <div class="history-file-topline">
              <span class="history-file-type">${escapeHtml(extension || 'FILE')}</span>
              <span class="history-status history-status-${escapeHtml((report.analysis_status || 'processing').toLowerCase())}">${escapeHtml(status)}</span>
            </div>
            <strong>${escapeHtml(report.file_name)}</strong>
          </div>
          <div class="history-meta-block">
            <span class="history-meta-label">Date</span>
            <div class="history-meta">${uploaded.toLocaleDateString()}</div>
          </div>
          <div class="history-meta-block">
            <span class="history-meta-label">Time</span>
            <div class="history-meta">${uploaded.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <button class="secondary-btn history-eye" type="button" data-open-report="${report.id}">View</button>
        </article>
      `;
    })
    .join('');

  els.historyTable.querySelectorAll('[data-open-report]').forEach((button) => {
    button.addEventListener('click', async () => {
      const report = await loadReportDetail(button.dataset.openReport);
      if (report) {
        renderHistoryDetail(report);
        state.selectedReport = report;
      }
    });
  });
}

function renderHistoryDetail(report) {
  if (!report) {
    els.historyDetailCard.classList.remove('is-active');
    els.historyDetailTitle.textContent = 'Choose a report from history';
    els.historyDetailCopy.textContent = 'Its stored findings, metrics, and summary will appear here for side-by-side historical review.';
    els.historyDetailMeta.innerHTML = '';
    renderList(els.historyCriticalFindings, ['No report selected yet.']);
    renderList(els.historyModerateFindings, ['Select a report to inspect its stored analysis.']);
    renderList(els.historyElevatedFindings, ['Historical elevated markers will appear here.']);
    renderMetrics([], els.historyMetricList);
    return;
  }

  const summary = report.summary_json || {};
  const uploaded = new Date(report.uploaded_at);

  els.historyDetailCard.classList.add('is-active');
  els.historyDetailTitle.textContent = report.file_name;
  els.historyDetailCopy.textContent = 'This is the saved analysis snapshot for the selected historical report.';
  els.historyDetailMeta.innerHTML = [
    `<span>${escapeHtml(readableStatus(report.analysis_status || 'processing'))}</span>`,
    `<span>${uploaded.toLocaleDateString()}</span>`,
    `<span>${uploaded.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`
  ].join('');
  renderList(els.historyCriticalFindings, summary.critical || ['No critical findings recorded.']);
  renderList(els.historyModerateFindings, summary.moderate || ['No moderate findings recorded.']);
  renderList(els.historyElevatedFindings, summary.elevated || ['No elevated findings recorded.']);
  renderMetrics(report.metrics || [], els.historyMetricList);
  els.historyDetailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  els.analysisOverview.innerHTML = buildAnalysisNarrative(summary);
}

function buildAnalysisNarrative(summary = {}) {
  const sections = [];
  const overview = String(summary.overview || '').trim();
  const critical = normalizeFindings(summary.critical);
  const moderate = normalizeFindings(summary.moderate);
  const elevated = normalizeFindings(summary.elevated);

  sections.push(`<p>${escapeHtml(overview || 'No report summary is available yet. Upload a report to receive a readable AI explanation of the main findings and what they may mean.')}</p>`);

  if (critical.length) {
    sections.push(`<p><strong>Priority findings:</strong> ${escapeHtml(joinReadableList(critical))}.</p>`);
  }

  if (moderate.length) {
    sections.push(`<p><strong>Additional findings to review:</strong> ${escapeHtml(joinReadableList(moderate))}.</p>`);
  }

  if (elevated.length) {
    sections.push(`<p><strong>Markers to monitor:</strong> ${escapeHtml(joinReadableList(elevated))}.</p>`);
  }

  if (!critical.length && !moderate.length && !elevated.length) {
    sections.push('<p>The detailed findings will appear here after analysis, rewritten into a single patient-friendly explanation instead of separate columns.</p>');
  }

  return sections.join('');
}

function normalizeFindings(items) {
  return (items || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => !/^no\s+/i.test(item) && !/await/i.test(item) && !/upload a report/i.test(item));
}

function joinReadableList(items) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function renderList(element, items) {
  element.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderMetrics(metrics, target) {
  if (!metrics?.length) {
    target.innerHTML = `
      <div class="empty-state">
        <span class="section-icon" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M4 5h2v10H4V5Zm5-2h2v12H9V3Zm5 4h2v8h-2V7Z"/></svg></span>
        <strong>No extracted markers yet</strong>
      </div>
    `;
    return;
  }

  target.innerHTML = metrics
    .map((metric) => {
      const severity = metric.severity || 'moderate';
      const metricName = metric.metric_name || metric.name;
      const referenceRange = getReferenceRange(metricName, metric.unit);
      return `
        <article class="metric-item" tabindex="0" data-severity="${escapeHtml(severity)}">
          <div class="metric-tip">${escapeHtml(metric.tip || 'No balancing tip available for this metric yet.')}</div>
          <span class="metric-band metric-band-${escapeHtml(severity)}"></span>
          <header>
            <div>
              <span class="metric-label">${escapeHtml(readableStatus(severity))}</span>
              <strong>${escapeHtml(metricName)}</strong>
            </div>
            <span class="metric-value">${escapeHtml(String(metric.value ?? '--'))} ${escapeHtml(metric.unit || '')}</span>
          </header>
          <p class="metric-range">Reference range: ${escapeHtml(referenceRange)}</p>
          <div class="metric-footer">
            <span class="status-pill">${escapeHtml(readableStatus(severity))}</span>
          </div>
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
      animation: {
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: cssVar('--ink'),
          titleColor: cssVar('--surface-strong'),
          bodyColor: cssVar('--surface-strong'),
          padding: 12,
          cornerRadius: 14,
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
          ticks: { color: cssVar('--ink-soft') },
          grid: { display: false },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          suggestedMax: 3.5,
          ticks: {
            stepSize: 1,
            color: cssVar('--ink-soft'),
            callback(value) {
              return value === 0 ? '' : value;
            }
          },
          grid: { color: colorWithAlpha(cssVar('--line-strong'), 0.45) },
          border: { display: false }
        }
      }
    }
  });

  els.chartSummary.textContent = chartMetrics.length
    ? `Chart summary: ${chartMetrics
        .map((metric) => `${metric.metric_name || metric.name} is ${readableStatus(metric.severity)}`)
        .join('; ')}.`
    : 'Chart summary: no analyzed markers yet. Upload a report to populate the visualization.';
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
    .map(
      (prompt, index) => `
        <button class="prompt-chip" type="button">
          <span class="prompt-index">0${index + 1}</span>
          <span>${escapeHtml(prompt)}</span>
        </button>
      `
    )
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
        `
          <article class="chat-message ${escapeHtml(message.role)}">
            <span class="chat-speaker">${message.role === 'user' ? 'You' : 'Dr.AI'}</span>
            <div class="chat-bubble ${escapeHtml(message.role)}">${escapeHtml(message.content)}</div>
          </article>
        `
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
  setButtonBusy(els.chatSubmitBtn, true, 'Sending...');

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
  } finally {
    setButtonBusy(els.chatSubmitBtn, false, 'Send');
  }
}

function switchView(viewName) {
  toggleProfileMenu(false);
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.dataset.view === viewName);
  });
  document.querySelectorAll('.nav-btn[data-view-trigger]').forEach((button) => {
    button.classList.toggle('active', button.dataset.viewTrigger === viewName);
  });
  const activeView = document.querySelector(`.view[data-view="${viewName}"] h1`);
  if (activeView) {
    activeView.setAttribute('tabindex', '-1');
    activeView.focus();
  }
}

function toggleProfileMenu(force) {
  state.profileMenuOpen = typeof force === 'boolean' ? force : !state.profileMenuOpen;
  els.profileMenuPanel.classList.toggle('hidden', !state.profileMenuOpen);
  els.profileQuickBtn.setAttribute('aria-expanded', String(state.profileMenuOpen));

  if (!state.profileMenuOpen) return;

  const target = state.session ? els.profileName : els.authEmail;
  if (target) {
    target.setAttribute('tabindex', '-1');
    target.focus();
  }
}

function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem('medinsight-theme', theme);
  document.body.dataset.theme = theme;
  els.themeToggleIcon.textContent = theme === 'light' ? '☾' : '☀';
  els.themeToggle.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
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
      return 'rgba(167, 73, 73, 0.8)';
    case 'elevated':
      return 'rgba(179, 99, 57, 0.8)';
    case 'moderate':
      return 'rgba(169, 117, 34, 0.8)';
    default:
      return 'rgba(54, 95, 141, 0.58)';
  }
}

function readableStatus(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getReferenceRange(metricName, unit) {
  const label = String(metricName || '').toLowerCase();
  if (label.includes('hemoglobin')) return '12-16 g/dL';
  if (label.includes('glucose')) return '70-99 mg/dL fasting';
  if (label.includes('cholesterol')) return 'Below 200 mg/dL';
  if (label.includes('ldl')) return 'Below 100 mg/dL';
  if (label.includes('hdl')) return '40 mg/dL or higher';
  if (label.includes('vitamin d')) return '30-100 ng/mL';
  if (label.includes('creatinine')) return '0.6-1.3 mg/dL';
  if (label.includes('tsh')) return '0.4-4.0 uIU/mL';
  return unit ? `See lab-specific normal range (${unit})` : 'See lab-specific normal range';
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

function setButtonBusy(button, busy, label) {
  button.disabled = busy;
  button.dataset.label = button.dataset.label || button.textContent;
  button.textContent = label || (busy ? 'Loading...' : button.dataset.label);
  button.setAttribute('aria-busy', busy ? 'true' : 'false');
}
