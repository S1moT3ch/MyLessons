HTML_CONTENT = """<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyLessons • Gestione Database Redis & Audit</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #090d16;
            --bg-surface: #101726;
            --bg-elevated: #162033;
            --bg-card: rgba(22, 32, 51, 0.75);
            --border: rgba(255, 255, 255, 0.08);
            --border-hover: rgba(99, 102, 241, 0.4);
            --accent-primary: #6366f1;
            --accent-secondary: #06b6d4;
            --accent-glow: rgba(99, 102, 241, 0.3);
            --success: #10b981;
            --success-bg: rgba(16, 185, 129, 0.14);
            --warning: #f59e0b;
            --warning-bg: rgba(245, 158, 11, 0.14);
            --danger: #ef4444;
            --danger-bg: rgba(239, 68, 68, 0.14);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --radius-sm: 8px;
            --radius-md: 14px;
            --radius-lg: 20px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-base);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.5;
            background-image: 
                radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.14) 0%, transparent 45%),
                radial-gradient(circle at 85% 85%, rgba(6, 182, 212, 0.12) 0%, transparent 45%);
            background-attachment: fixed;
        }

        .container {
            max-width: 1440px;
            margin: 0 auto;
            padding: 24px;
        }

        .glass-panel {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        }

        /* Header */
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 18px 24px;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 16px;
        }

        .brand-box {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .brand-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            font-weight: 800;
            color: #fff;
            box-shadow: 0 4px 16px var(--accent-glow);
        }

        .brand-title {
            font-size: 1.25rem;
            font-weight: 800;
            letter-spacing: -0.3px;
        }

        .brand-sub {
            font-size: 0.75rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        /* Buttons & Badges */
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            font-size: 0.85rem;
            font-weight: 600;
            border-radius: var(--radius-sm);
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.2s ease;
            text-decoration: none;
            font-family: inherit;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--accent-primary), #4f46e5);
            color: #fff;
            box-shadow: 0 2px 10px var(--accent-glow);
        }
        .btn-primary:hover {
            opacity: 0.92;
            transform: translateY(-1px);
        }

        .btn-success {
            background: linear-gradient(135deg, var(--success), #059669);
            color: #fff;
        }
        .btn-success:hover {
            opacity: 0.92;
            transform: translateY(-1px);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.06);
            color: var(--text-secondary);
            border-color: var(--border);
        }
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-primary);
        }

        .btn-danger {
            background: var(--danger-bg);
            color: var(--danger);
            border-color: rgba(239, 68, 68, 0.3);
        }
        .btn-danger:hover {
            background: rgba(239, 68, 68, 0.25);
        }

        .btn-sm {
            padding: 5px 10px;
            font-size: 0.78rem;
            border-radius: 6px;
        }

        .badge-live {
            background: rgba(16, 185, 129, 0.15);
            color: var(--success);
            border: 1px solid rgba(16, 185, 129, 0.3);
            font-size: 0.75rem;
            padding: 4px 10px;
            border-radius: 9999px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .badge-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--success);
            box-shadow: 0 0 8px var(--success);
        }

        /* Filter Tabs */
        .filter-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 16px;
        }

        .teacher-tabs {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .tab-pill {
            padding: 8px 16px;
            border-radius: 9999px;
            font-size: 0.85rem;
            font-weight: 700;
            cursor: pointer;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-secondary);
            border: 1px solid var(--border);
            transition: all 0.2s;
        }
        .tab-pill:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }
        .tab-pill.active {
            background: var(--accent-primary);
            color: #fff;
            border-color: var(--accent-primary);
            box-shadow: 0 2px 10px var(--accent-glow);
        }

        .search-box {
            position: relative;
            min-width: 260px;
        }

        .search-box input {
            width: 100%;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 8px 12px 8px 36px;
            color: #fff;
            font-size: 0.85rem;
            outline: none;
            transition: border-color 0.2s;
        }
        .search-box input:focus {
            border-color: var(--accent-primary);
        }
        .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 14px;
        }

        /* KPI Grid */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 18px;
            margin-bottom: 24px;
        }

        .kpi-card {
            padding: 20px 24px;
            position: relative;
            overflow: hidden;
        }
        .kpi-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--accent-primary), transparent);
            opacity: 0.7;
        }

        .kpi-label {
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            font-weight: 700;
            margin-bottom: 6px;
        }

        .kpi-value {
            font-size: 2rem;
            font-weight: 800;
            color: #fff;
            display: flex;
            align-items: baseline;
            gap: 8px;
        }

        .kpi-sub {
            font-size: 0.78rem;
            color: var(--text-secondary);
            margin-top: 4px;
        }

        /* Table */
        .table-container {
            overflow: hidden;
            margin-bottom: 30px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
            text-align: left;
        }

        th {
            background: rgba(15, 23, 42, 0.5);
            padding: 14px 18px;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--text-muted);
            font-weight: 700;
            border-bottom: 1px solid var(--border);
        }

        td {
            padding: 14px 18px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            vertical-align: middle;
        }

        tr:hover td {
            background: rgba(255, 255, 255, 0.02);
        }

        .student-cell {
            display: flex;
            flex-direction: column;
        }
        .student-name {
            font-weight: 700;
            color: #fff;
        }
        .student-email {
            font-size: 0.75rem;
            color: var(--text-muted);
            font-family: 'JetBrains Mono', monospace;
        }

        .pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
        }
        .pill-success {
            background: var(--success-bg);
            color: var(--success);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .pill-warning {
            background: var(--warning-bg);
            color: var(--warning);
            border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .pill-info {
            background: rgba(6, 182, 212, 0.15);
            color: #22d3ee;
            border: 1px solid rgba(6, 182, 212, 0.3);
        }

        .metric-badge {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            color: #cbd5e1;
        }

        .action-cell {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
        }

        /* Modals */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(4, 7, 13, 0.82);
            backdrop-filter: blur(10px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
        }
        .modal-overlay.active {
            display: flex;
        }

        .modal-content {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            width: 100%;
            max-width: 540px;
            padding: 28px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
            max-height: 90vh;
            overflow-y: auto;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 14px;
        }
        .modal-title {
            font-size: 1.2rem;
            font-weight: 800;
        }

        .form-group {
            margin-bottom: 18px;
        }
        .form-label {
            display: block;
            font-size: 0.8rem;
            font-weight: 700;
            color: var(--text-secondary);
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .form-input {
            width: 100%;
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 10px 14px;
            color: #fff;
            font-size: 0.95rem;
            outline: none;
            transition: border-color 0.2s;
            font-family: inherit;
        }
        .form-input:focus {
            border-color: var(--accent-primary);
        }
        .form-help {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 4px;
        }

        .input-row {
            display: flex;
            gap: 12px;
        }

        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 24px;
            border-top: 1px solid var(--border);
            padding-top: 18px;
        }

        /* Timeline list */
        .timeline-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            font-size: 0.85rem;
        }
        .timeline-date {
            font-weight: 600;
            color: #fff;
        }
        .timeline-fp {
            font-size: 0.7rem;
            color: var(--text-muted);
            font-family: 'JetBrains Mono', monospace;
        }

        /* Toast */
        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 12px 20px;
            border-radius: var(--radius-md);
            background: var(--bg-surface);
            border: 1px solid var(--border);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            color: #fff;
            font-size: 0.9rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 2000;
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .toast.show {
            transform: translateY(0);
            opacity: 1;
        }
    </style>
</head>
<body>
    <div class="container">

        <!-- AUTH MODAL (Password di Accesso) -->
        <div id="authModal" class="modal-overlay">
            <div class="modal-content" style="max-width: 420px; text-align: center;">
                <div class="brand-icon" style="margin: 0 auto 16px;">🔐</div>
                <h2 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 6px;">Accesso Amministrazione DB</h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px;">
                    Inserisci la password di amministrazione o il codice segreto docente per gestire il database Redis.
                </p>
                <div class="form-group" style="text-align: left;">
                    <label class="form-label">Password / Chiave Segreta</label>
                    <input type="password" id="authKeyInput" class="form-input" placeholder="Inserisci password..." onkeydown="if(event.key==='Enter') verifyAndLoad()">
                    <div id="authErrorMsg" style="color: var(--danger); font-size: 0.8rem; margin-top: 6px; display: none;">
                        ❌ Password errata. Riprova.
                    </div>
                </div>
                <button class="btn btn-primary" style="width: 100%; justify-content: center; padding: 12px;" onclick="verifyAndLoad()">
                    Sblocca Gestione DB
                </button>
            </div>
        </div>

        <!-- MAIN DASHBOARD -->
        <div id="mainDashboard" style="display: none;">
            <!-- Header -->
            <header class="glass-panel">
                <div class="brand-box">
                    <div class="brand-icon">⚡</div>
                    <div>
                        <div class="brand-title">MyLessons • Gestione Database Redis</div>
                        <div class="brand-sub">Visualizzazione & Aggiornamento Manuale per Insegnante</div>
                    </div>
                </div>
                <div class="header-actions">
                    <div id="dbProviderBadge" class="badge-live">
                        <span class="badge-dot"></span>
                        <span id="dbProviderText">Upstash REST</span>
                    </div>
                    <button class="btn btn-success" onclick="openNewStudentModal()">
                        ➕ Nuovo Studente
                    </button>
                    <button class="btn btn-secondary" onclick="triggerBackfill()" title="Ricarica eventi da Google Calendar">
                        📥 Sync Calendar
                    </button>
                    <button class="btn btn-secondary" onclick="loadStats()" title="Aggiorna tabella">
                        🔄 Ricarica
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="logout()" title="Chiudi sessione">
                        🚪 Esci
                    </button>
                </div>
            </header>

            <!-- Teacher Tabs & Search Filter -->
            <div class="glass-panel filter-bar">
                <div class="teacher-tabs" id="teacherTabs">
                    <button class="tab-pill active" onclick="setTeacherFilter('')">Tutti gli Insegnanti</button>
                    <!-- Insegnanti aggiunti dinamicamente da JS -->
                </div>
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="searchInput" placeholder="Cerca per nome o email..." oninput="renderTable()">
                </div>
            </div>

            <!-- KPI Cards -->
            <div class="kpi-grid">
                <div class="glass-panel kpi-card">
                    <div class="kpi-label">Studenti Gestiti</div>
                    <div class="kpi-value" id="kpiTotalStudents">0</div>
                    <div class="kpi-sub">Nel filtro selezionato</div>
                </div>
                <div class="glass-panel kpi-card">
                    <div class="kpi-label">Lezioni Svolte Totali</div>
                    <div class="kpi-value" id="kpiSvolte" style="color: #818cf8;">0</div>
                    <div class="kpi-sub" id="kpiSvolteSub">Calendar + Offset Storico</div>
                </div>
                <div class="glass-panel kpi-card">
                    <div class="kpi-label">Lezioni Da Saldare (Debito)</div>
                    <div class="kpi-value" id="kpiDaPagare" style="color: var(--warning);">0</div>
                    <div class="kpi-sub">Ancora non pagate</div>
                </div>
                <div class="glass-panel kpi-card">
                    <div class="kpi-label">Importo Totale Dovuto</div>
                    <div class="kpi-value" id="kpiRevenue" style="color: var(--success);">0.00 €</div>
                    <div class="kpi-sub">Calcolato su tariffa oraria</div>
                </div>
            </div>

            <!-- Tabella Dati Studenti / Insegnanti -->
            <div class="glass-panel table-container">
                <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 700; font-size: 1rem;">Studenti & Dati Registrati nel DB</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Clicca su <b>✏️ Modifica</b> per aggiornare lezioni o saldi nel DB</div>
                </div>
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Insegnante</th>
                                <th>Studente</th>
                                <th>Lezioni Svolte</th>
                                <th>Da Pagare</th>
                                <th>Tariffa</th>
                                <th>Totale Dovuto</th>
                                <th>Stato Pagamento</th>
                                <th style="text-align: right;">Azioni nel DB</th>
                            </tr>
                        </thead>
                        <tbody id="studentsTableBody">
                            <!-- Popolato dinamicamente -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- MODAL 1: MODIFICA DATI STUDENTE NEL DB -->
        <div id="editModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h3 class="modal-title">✏️ Modifica Dati Studente nel DB</h3>
                        <div id="editSubTitle" style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;"></div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="closeEditModal()">✕</button>
                </div>
                <form id="editForm" onsubmit="event.preventDefault(); submitStudentEdit();">
                    <input type="hidden" id="editTeacherName">
                    <input type="hidden" id="editStudentEmail">
                    
                    <div class="form-group">
                        <label class="form-label">Offset Storico Lezioni Svolte</label>
                        <input type="number" id="editOffset" class="form-input" min="0" required oninput="calcEditTotals()">
                        <div class="form-help" id="editOffsetHelp">
                            Totale Svolte = Lezioni Calendar (<span id="editCalCount">0</span>) + Offset (<span id="editOffsetPreview">0</span>) = <b id="editTotalePreview" style="color: #818cf8;">0</b>
                        </div>
                    </div>

                    <div class="form-group">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <label class="form-label" style="margin-bottom: 0;">Lezioni Da Pagare (Debito)</label>
                            <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem;" onclick="document.getElementById('editDaPagare').value=0; calcEditTotals();">
                                ✓ Saldato (0)
                            </button>
                        </div>
                        <input type="number" id="editDaPagare" class="form-input" min="0" required oninput="calcEditTotals()">
                        <div class="form-help">Numero di lezioni che lo studente deve ancora corrispondere all'insegnante.</div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Tariffa Oraria (€ / ora)</label>
                        <input type="number" step="0.5" id="editTariffa" class="form-input" min="0" required oninput="calcEditTotals()">
                        <div class="form-help">
                            Importo Dovuto Calcolato: <b id="editAmountPreview" style="color: var(--success);">0.00 €</b>
                        </div>
                    </div>

                    <div style="background: rgba(255, 255, 255, 0.03); padding: 12px; border-radius: 8px; border: 1px solid var(--border); margin-top: 16px;">
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="editSyncSheet" checked style="accent-color: var(--accent-primary);">
                            <span>Sincronizza anche il Foglio Google Sheets per backup</span>
                        </label>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeEditModal()">Annulla</button>
                        <button type="submit" class="btn btn-primary" id="saveEditBtn">💾 Salva nel DB Redis</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- MODAL 2: AGGIUNGI LEZIONE MANUALE -->
        <div id="addLessonModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h3 class="modal-title">➕ Registra Lezione Manuale nel DB</h3>
                        <div id="addLessonSubTitle" style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;"></div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="closeAddLessonModal()">✕</button>
                </div>
                <form id="addLessonForm" onsubmit="event.preventDefault(); submitAddLesson();">
                    <input type="hidden" id="addLessonTeacher">
                    <input type="hidden" id="addLessonEmail">
                    <input type="hidden" id="addLessonName">

                    <div class="form-group">
                        <label class="form-label">Data e Ora Lezione</label>
                        <input type="datetime-local" id="addLessonDate" class="form-input" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Stato Lezione</label>
                        <select id="addLessonStatus" class="form-input">
                            <option value="svolta">✓ Svolta (conteggiata subito)</option>
                            <option value="programmata">⏳ Programmata (futura)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Tariffa Applicata (€)</label>
                        <input type="number" step="0.5" id="addLessonTariffa" class="form-input">
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeAddLessonModal()">Annulla</button>
                        <button type="submit" class="btn btn-success" id="saveLessonBtn">➕ Aggiungi al DB</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- MODAL 3: NUOVO STUDENTE -->
        <div id="newStudentModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h3 class="modal-title">➕ Inserisci Nuovo Studente nel DB</h3>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Associa uno studente al docente con offset iniziale</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="closeNewStudentModal()">✕</button>
                </div>
                <form id="newStudentForm" onsubmit="event.preventDefault(); submitNewStudent();">
                    <div class="form-group">
                        <label class="form-label">Insegnante</label>
                        <select id="newStudentTeacher" class="form-input" required>
                            <!-- Popolato da JS -->
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Email Studente</label>
                        <input type="email" id="newStudentEmail" class="form-input" placeholder="studente@gmail.com" required>
                    </div>

                    <div class="input-row">
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">Lezioni Svolte</label>
                            <input type="number" id="newStudentOffset" class="form-input" value="0" min="0">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">Da Pagare</label>
                            <input type="number" id="newStudentDaPagare" class="form-input" value="0" min="0">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">Tariffa (€/h)</label>
                            <input type="number" step="0.5" id="newStudentTariffa" class="form-input" value="18" min="0">
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeNewStudentModal()">Annulla</button>
                        <button type="submit" class="btn btn-primary" id="saveNewStudentBtn">➕ Salva nel DB</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- MODAL 4: DETTAGLIO LEZIONI STUDENTE -->
        <div id="detailModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h3 class="modal-title" id="modalStudentName">Dettaglio Lezioni</h3>
                        <div id="modalStudentEmail" style="font-size: 0.75rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;"></div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="closeDetailModal()">✕ Chiudi</button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">Elenco appuntamenti nel DB Redis:</span>
                    <button class="btn btn-success btn-sm" id="detailAddBtn" onclick="">➕ Nuova Lezione</button>
                </div>
                <div class="lessons-timeline" id="modalLessonsList" style="max-height: 400px; overflow-y: auto;"></div>
            </div>
        </div>

        <!-- TOAST NOTIFICATION -->
        <div id="toast" class="toast">Notifica</div>

    </div>

    <script>
        let currentAuthKey = "";
        let fullData = [];
        let activeTeacherFilter = "";
        let currentEditingStudent = null;

        function showToast(msg, isError = false) {
            const t = document.getElementById("toast");
            t.innerText = msg;
            t.style.borderColor = isError ? "var(--danger)" : "var(--success)";
            t.classList.add("show");
            setTimeout(() => t.classList.remove("show"), 3500);
        }

        // Init & Auth Check
        window.addEventListener("DOMContentLoaded", () => {
            const params = new URLSearchParams(window.location.search);
            const keyFromUrl = params.get("key") || params.get("password");
            const storedKey = sessionStorage.getItem("admin_stats_key") || localStorage.getItem("admin_stats_key");

            if (keyFromUrl) {
                currentAuthKey = keyFromUrl;
                saveAuthKey(currentAuthKey);
                loadStats();
            } else if (storedKey) {
                currentAuthKey = storedKey;
                loadStats();
            } else {
                document.getElementById("authModal").classList.add("active");
            }
        });

        function saveAuthKey(key) {
            sessionStorage.setItem("admin_stats_key", key);
            localStorage.setItem("admin_stats_key", key);
        }

        async function verifyAndLoad() {
            const val = document.getElementById("authKeyInput").value.trim();
            if (!val) return;
            currentAuthKey = val;
            const success = await loadStats();
            if (success) {
                saveAuthKey(currentAuthKey);
                document.getElementById("authModal").classList.remove("active");
                document.getElementById("authErrorMsg").style.display = "none";
            } else {
                document.getElementById("authErrorMsg").style.display = "block";
            }
        }

        function logout() {
            sessionStorage.removeItem("admin_stats_key");
            localStorage.removeItem("admin_stats_key");
            currentAuthKey = "";
            document.getElementById("mainDashboard").style.display = "none";
            document.getElementById("authModal").classList.add("active");
            document.getElementById("authKeyInput").value = "";
        }

        async function loadStats() {
            try {
                const res = await fetch(`/api?action=getTeacherRealLessonStats&key=${encodeURIComponent(currentAuthKey)}`);
                if (res.status === 401) return false;
                const json = await res.json();

                if (json.status === "success") {
                    fullData = json.data || [];
                    document.getElementById("dbProviderText").innerText = json.databaseProvider || "Upstash REST";
                    document.getElementById("mainDashboard").style.display = "block";
                    renderTeacherTabs();
                    renderKPIs();
                    renderTable();
                    return true;
                }
                return false;
            } catch (e) {
                console.error("Errore recupero statistiche:", e);
                return false;
            }
        }

        function setTeacherFilter(tName) {
            activeTeacherFilter = tName;
            renderTeacherTabs();
            renderKPIs();
            renderTable();
        }

        function renderTeacherTabs() {
            const tabsContainer = document.getElementById("teacherTabs");
            const teachers = fullData.map(t => t.teacherName);

            let html = `<button class="tab-pill ${activeTeacherFilter === '' ? 'active' : ''}" onclick="setTeacherFilter('')">Tutti gli Insegnanti</button>`;
            teachers.forEach(tName => {
                html += `<button class="tab-pill ${activeTeacherFilter === tName ? 'active' : ''}" onclick="setTeacherFilter('${tName}')">${tName}</button>`;
            });
            tabsContainer.innerHTML = html;
        }

        function getFilteredTeachers() {
            if (!activeTeacherFilter) return fullData;
            return fullData.filter(t => t.teacherName === activeTeacherFilter);
        }

        function renderKPIs() {
            const targetTeachers = getFilteredTeachers();
            let totalStudents = 0;
            let totalSvolte = 0;
            let totalDaPagare = 0;
            let totalRevenue = 0;

            targetTeachers.forEach(t => {
                totalStudents += (t.students || []).length;
                (t.students || []).forEach(s => {
                    totalSvolte += (s.lezioniSvolte || s.lezioniSvolteTotali || 0);
                    totalDaPagare += (s.lezioniDaPagare || 0);
                    totalRevenue += (s.amountDue || 0);
                });
            });

            document.getElementById("kpiTotalStudents").innerText = totalStudents;
            document.getElementById("kpiSvolte").innerText = totalSvolte;
            document.getElementById("kpiDaPagare").innerText = totalDaPagare;
            document.getElementById("kpiRevenue").innerText = totalRevenue.toFixed(2) + " €";
        }

        function renderTable() {
            const tbody = document.getElementById("studentsTableBody");
            tbody.innerHTML = "";
            const search = (document.getElementById("searchInput").value || "").toLowerCase().trim();
            const targetTeachers = getFilteredTeachers();

            let rowCount = 0;

            targetTeachers.forEach(t => {
                (t.students || []).forEach(s => {
                    const sName = s.studentName || s.studentEmail || "Sconosciuto";
                    const sEmail = s.studentEmail || "";
                    if (search && !sName.toLowerCase().includes(search) && !sEmail.toLowerCase().includes(search)) {
                        return;
                    }

                    rowCount++;
                    const calSvolte = s.calLezioniSvolte || 0;
                    const offsetSvolte = s.offsetSvolte || 0;
                    const totaleSvolte = s.lezioniSvolte || (calSvolte + offsetSvolte);
                    const daPagare = s.lezioniDaPagare !== undefined ? s.lezioniDaPagare : totaleSvolte;
                    const tariffa = s.tariffa || 0;
                    const amountDue = s.amountDue || (daPagare * tariffa);

                    const isSettled = (daPagare === 0);
                    const statusPill = isSettled 
                        ? '<span class="pill pill-success">✓ Saldato</span>' 
                        : `<span class="pill pill-warning">⚠️ ${daPagare} da pagare</span>`;

                    const studentObjJson = JSON.stringify({
                        teacherName: t.teacherName,
                        studentName: sName,
                        studentEmail: sEmail,
                        calLezioniSvolte: calSvolte,
                        offsetSvolte: offsetSvolte,
                        lezioniSvolte: totaleSvolte,
                        lezioniDaPagare: daPagare,
                        tariffa: tariffa,
                        amountDue: amountDue,
                        lessons: s.lessons || []
                    }).replace(/'/g, "&#39;");

                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><b style="color: #cbd5e1;">${t.teacherName}</b></td>
                        <td>
                            <div class="student-cell">
                                <span class="student-name">${sName}</span>
                                <span class="student-email">${sEmail}</span>
                            </div>
                        </td>
                        <td>
                            <b style="color: #818cf8; font-size: 1rem;">${totaleSvolte}</b>
                            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                                ${calSvolte} cal. + ${offsetSvolte} off.
                            </div>
                        </td>
                        <td>
                            <b style="color: ${isSettled ? 'var(--success)' : 'var(--warning)'}; font-size: 1rem;">${daPagare}</b>
                        </td>
                        <td>
                            <span class="metric-badge">${tariffa > 0 ? tariffa + ' €/h' : '-'}</span>
                        </td>
                        <td>
                            <b style="color: ${amountDue > 0 ? 'var(--success)' : 'var(--text-muted)'}; font-size: 0.95rem;">
                                ${amountDue.toFixed(2)} €
                            </b>
                        </td>
                        <td>${statusPill}</td>
                        <td>
                            <div class="action-cell">
                                <button class="btn btn-secondary btn-sm" onclick='openEditModal(${studentObjJson})' title="Modifica dati nel DB">
                                    ✏️ Modifica
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick='openAddLessonModal(${studentObjJson})' title="Aggiungi lezione manuale">
                                    ➕ Lezione
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick='openDetailModal(${studentObjJson})' title="Dettagli e storico lezioni">
                                    🔍 (${(s.lessons || []).length})
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            });

            if (rowCount === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">Nessuno studente trovato per i filtri selezionati.</td></tr>';
            }
        }

        // --- MODAL 1: MODIFICA DATI STUDENTE ---
        function openEditModal(student) {
            currentEditingStudent = student;
            document.getElementById("editTeacherName").value = student.teacherName;
            document.getElementById("editStudentEmail").value = student.studentEmail;
            document.getElementById("editSubTitle").innerText = `${student.teacherName} • ${student.studentName} (${student.studentEmail})`;

            document.getElementById("editOffset").value = student.offsetSvolte;
            document.getElementById("editDaPagare").value = student.lezioniDaPagare;
            document.getElementById("editTariffa").value = student.tariffa;
            document.getElementById("editCalCount").innerText = student.calLezioniSvolte;

            calcEditTotals();
            document.getElementById("editModal").classList.add("active");
        }

        function closeEditModal() {
            document.getElementById("editModal").classList.remove("active");
            currentEditingStudent = null;
        }

        function calcEditTotals() {
            const cal = currentEditingStudent ? currentEditingStudent.calLezioniSvolte : 0;
            const offset = parseInt(document.getElementById("editOffset").value, 10) || 0;
            const daPagare = parseInt(document.getElementById("editDaPagare").value, 10) || 0;
            const tariffa = parseFloat(document.getElementById("editTariffa").value) || 0;

            document.getElementById("editOffsetPreview").innerText = offset;
            document.getElementById("editTotalePreview").innerText = cal + offset;
            document.getElementById("editAmountPreview").innerText = (daPagare * tariffa).toFixed(2) + " €";
        }

        async function submitStudentEdit() {
            const saveBtn = document.getElementById("saveEditBtn");
            saveBtn.disabled = true;
            saveBtn.innerText = "Salvataggio...";

            const tName = document.getElementById("editTeacherName").value;
            const sEmail = document.getElementById("editStudentEmail").value;
            const offset = document.getElementById("editOffset").value;
            const daPagare = document.getElementById("editDaPagare").value;
            const tariffa = document.getElementById("editTariffa").value;
            const syncSheet = document.getElementById("editSyncSheet").checked;

            try {
                const res = await fetch("/api", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "updateStudentDbData",
                        key: currentAuthKey,
                        teacherName: tName,
                        studentEmail: sEmail,
                        offsetSvolte: parseInt(offset, 10),
                        lezioniDaPagare: parseInt(daPagare, 10),
                        tariffa: parseFloat(tariffa),
                        syncSheet: syncSheet
                    })
                });

                const json = await res.json();
                if (json.status === "success") {
                    showToast("✅ Dati studente aggiornati con successo nel DB!");
                    closeEditModal();
                    loadStats();
                } else {
                    showToast("❌ Errore durante il salvataggio: " + (json.message || "Errore sconosciuto"), true);
                }
            } catch (e) {
                showToast("❌ Errore di rete durante il salvataggio", true);
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerText = "💾 Salva nel DB Redis";
            }
        }

        // --- MODAL 2: AGGIUNGI LEZIONE ---
        function openAddLessonModal(student) {
            document.getElementById("addLessonTeacher").value = student.teacherName;
            document.getElementById("addLessonEmail").value = student.studentEmail;
            document.getElementById("addLessonName").value = student.studentName;
            document.getElementById("addLessonSubTitle").innerText = `${student.teacherName} • ${student.studentName} (${student.studentEmail})`;
            
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById("addLessonDate").value = now.toISOString().slice(0, 16);
            document.getElementById("addLessonTariffa").value = student.tariffa || 0;

            document.getElementById("addLessonModal").classList.add("active");
        }

        function closeAddLessonModal() {
            document.getElementById("addLessonModal").classList.remove("active");
        }

        async function submitAddLesson() {
            const btn = document.getElementById("saveLessonBtn");
            btn.disabled = true;
            btn.innerText = "Registrazione...";

            const tName = document.getElementById("addLessonTeacher").value;
            const sEmail = document.getElementById("addLessonEmail").value;
            const sName = document.getElementById("addLessonName").value;
            const dt = document.getElementById("addLessonDate").value;
            const st = document.getElementById("addLessonStatus").value;
            const tar = parseFloat(document.getElementById("addLessonTariffa").value) || 0;

            try {
                const res = await fetch("/api", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "addManualLesson",
                        key: currentAuthKey,
                        teacherName: tName,
                        studentEmail: sEmail,
                        studentName: sName,
                        startTime: dt,
                        status: st,
                        tariffa: tar
                    })
                });

                const json = await res.json();
                if (json.status === "success") {
                    showToast("✅ Lezione registrata con successo nel DB!");
                    closeAddLessonModal();
                    loadStats();
                } else {
                    showToast("❌ Errore registrazione lezione: " + (json.message || "Errore sconosciuto"), true);
                }
            } catch (e) {
                showToast("❌ Errore di rete", true);
            } finally {
                btn.disabled = false;
                btn.innerText = "➕ Aggiungi al DB";
            }
        }

        // --- MODAL 3: NUOVO STUDENTE ---
        function openNewStudentModal() {
            const sel = document.getElementById("newStudentTeacher");
            sel.innerHTML = "";
            const teachers = fullData.map(t => t.teacherName);
            teachers.forEach(tName => {
                const opt = document.createElement("option");
                opt.value = tName;
                opt.innerText = tName;
                if (activeTeacherFilter && activeTeacherFilter === tName) opt.selected = true;
                sel.appendChild(opt);
            });
            document.getElementById("newStudentModal").classList.add("active");
        }

        function closeNewStudentModal() {
            document.getElementById("newStudentModal").classList.remove("active");
        }

        async function submitNewStudent() {
            const btn = document.getElementById("saveNewStudentBtn");
            btn.disabled = true;
            btn.innerText = "Salvataggio...";

            const tName = document.getElementById("newStudentTeacher").value;
            const sEmail = document.getElementById("newStudentEmail").value.trim();
            const off = parseInt(document.getElementById("newStudentOffset").value, 10) || 0;
            const dp = parseInt(document.getElementById("newStudentDaPagare").value, 10) || 0;
            const tar = parseFloat(document.getElementById("newStudentTariffa").value) || 0;

            try {
                const res = await fetch("/api", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "updateStudentDbData",
                        key: currentAuthKey,
                        teacherName: tName,
                        studentEmail: sEmail,
                        offsetSvolte: off,
                        lezioniDaPagare: dp,
                        tariffa: tar,
                        syncSheet: true
                    })
                });

                const json = await res.json();
                if (json.status === "success") {
                    showToast("✅ Nuovo studente aggiunto con successo nel DB!");
                    closeNewStudentModal();
                    loadStats();
                } else {
                    showToast("❌ Errore inserimento: " + (json.message || "Errore sconosciuto"), true);
                }
            } catch (e) {
                showToast("❌ Errore di rete", true);
            } finally {
                btn.disabled = false;
                btn.innerText = "➕ Salva nel DB";
            }
        }

        // --- MODAL 4: DETTAGLI LEZIONI ---
        function openDetailModal(student) {
            document.getElementById("modalStudentName").innerText = student.studentName || "Dettaglio Studente";
            document.getElementById("modalStudentEmail").innerText = `${student.teacherName} • ${student.studentEmail}`;
            document.getElementById("detailAddBtn").onclick = () => {
                closeDetailModal();
                openAddLessonModal(student);
            };

            const list = document.getElementById("modalLessonsList");
            list.innerHTML = "";

            const lessons = student.lessons || [];
            if (lessons.length === 0) {
                list.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 24px;">Nessuna lezione registrata in memoria nel DB.</div>';
            } else {
                lessons.sort((a,b) => (b.date || "").localeCompare(a.date || "")).forEach(l => {
                    const item = document.createElement("div");
                    item.className = "timeline-item";
                    const isSvolta = l.status === "svolta";
                    const isAnnullata = l.status === "annullata";

                    let statusBadge = isSvolta 
                        ? '<span class="pill pill-success">✓ Svolta</span>' 
                        : isAnnullata 
                            ? '<span class="pill pill-warning" style="color: var(--danger); background: var(--danger-bg);">🚫 Annullata</span>' 
                            : '<span class="pill pill-warning">⏳ Programmata</span>';

                    item.innerHTML = `
                        <div>
                            <div class="timeline-date">${formatIsoDate(l.date)}</div>
                            <div class="timeline-fp">${l.id}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${statusBadge}
                            ${!isSvolta ? `<button class="btn btn-secondary btn-sm" onclick="changeLessonStatus('${l.id}', 'svolta')">Segna Svolta</button>` : ''}
                            ${!isAnnullata ? `<button class="btn btn-secondary btn-sm" onclick="changeLessonStatus('${l.id}', 'annullata')">Annulla</button>` : ''}
                            <button class="btn btn-danger btn-sm" onclick="deleteLesson('${student.teacherName}', '${l.id}')">🗑️</button>
                        </div>
                    `;
                    list.appendChild(item);
                });
            }

            document.getElementById("detailModal").classList.add("active");
        }

        function closeDetailModal() {
            document.getElementById("detailModal").classList.remove("active");
        }

        async function changeLessonStatus(fp, newStatus) {
            try {
                const res = await fetch("/api", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "updateLessonStatus",
                        key: currentAuthKey,
                        fingerprint: fp,
                        status: newStatus
                    })
                });
                const json = await res.json();
                if (json.status === "success") {
                    showToast(`✅ Stato lezione aggiornato a "${newStatus}"!`);
                    closeDetailModal();
                    loadStats();
                } else {
                    showToast("❌ Errore aggiornamento stato", true);
                }
            } catch (e) {
                showToast("❌ Errore di rete", true);
            }
        }

        async function deleteLesson(teacherName, fp) {
            if (!confirm("Sei sicuro di voler eliminare definitivamente questa lezione dal Database?")) return;
            try {
                const res = await fetch("/api", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "deleteLesson",
                        key: currentAuthKey,
                        teacherName: teacherName,
                        fingerprint: fp
                    })
                });
                const json = await res.json();
                if (json.status === "success") {
                    showToast("✅ Lezione eliminata dal DB!");
                    closeDetailModal();
                    loadStats();
                } else {
                    showToast("❌ Errore eliminazione", true);
                }
            } catch (e) {
                showToast("❌ Errore di rete", true);
            }
        }

        function formatIsoDate(isoStr) {
            if (!isoStr) return "-";
            try {
                const d = new Date(isoStr);
                return d.toLocaleDateString("it-IT", { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            } catch(e) {
                return isoStr;
            }
        }

        async function triggerBackfill() {
            if (!confirm("Avviare la sincronizzazione e indicizzazione di tutti gli eventi da Google Calendar nel Database?")) return;
            showToast("Sincronizzazione da Calendar in corso...");
            try {
                const res = await fetch(`/api?action=backfillRedisFromCalendar&key=${encodeURIComponent(currentAuthKey)}`);
                const json = await res.json();
                if (json.status === "success") {
                    showToast("✅ Sincronizzazione completata con successo!");
                    loadStats();
                } else {
                    showToast("❌ Errore: " + (json.message || "Errore sconosciuto"), true);
                }
            } catch(e) {
                showToast("❌ Errore di rete durante la sincronizzazione", true);
            }
        }
    </script>
</body>
</html>
"""

def get_stats_ui_html() -> str:
    """Restituisce il codice HTML completo dell'interfaccia web di gestione DB."""
    return HTML_CONTENT
