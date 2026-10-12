HTML_CONTENT = """<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyLessons - Audit & Confronto Dati</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #090d16;
            --bg-surface: #101726;
            --bg-elevated: #162033;
            --bg-card: rgba(22, 32, 51, 0.7);
            --border: rgba(255, 255, 255, 0.08);
            --border-hover: rgba(99, 102, 241, 0.4);
            --accent-primary: #6366f1;
            --accent-secondary: #06b6d4;
            --accent-glow: rgba(99, 102, 241, 0.25);
            --success: #10b981;
            --success-bg: rgba(16, 185, 129, 0.12);
            --warning: #f59e0b;
            --warning-bg: rgba(245, 158, 11, 0.12);
            --danger: #ef4444;
            --danger-bg: rgba(239, 68, 68, 0.12);
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
                radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.12) 0%, transparent 40%),
                radial-gradient(circle at 85% 75%, rgba(6, 182, 212, 0.1) 0%, transparent 40%);
            background-attachment: fixed;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 24px;
        }

        /* Glassmorphism Card Base */
        .glass-panel {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            transition: border-color 0.2s ease, transform 0.2s ease;
        }

        /* Navbar Header */
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 18px 24px;
            margin-bottom: 24px;
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
            box-shadow: 0 4px 14px var(--accent-glow);
        }

        .brand-title {
            font-size: 1.25rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            background: linear-gradient(to right, #ffffff, #cbd5e1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .brand-subtitle {
            font-size: 0.8rem;
            color: var(--text-secondary);
            font-weight: 500;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        /* Controls */
        select, input, button {
            font-family: inherit;
            font-size: 0.875rem;
        }

        select, input[type="text"], input[type="password"] {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            color: var(--text-primary);
            padding: 10px 16px;
            border-radius: var(--radius-md);
            outline: none;
            transition: all 0.2s ease;
        }

        select:focus, input:focus {
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 18px;
            border-radius: var(--radius-md);
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.2s ease;
            text-decoration: none;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--accent-primary), #4f46e5);
            color: white;
            box-shadow: 0 4px 12px var(--accent-glow);
        }

        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(99, 102, 241, 0.4);
        }

        .btn-secondary {
            background: var(--bg-elevated);
            color: var(--text-primary);
            border: 1px solid var(--border);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: var(--border-hover);
        }

        .btn-success {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
        }

        .btn-sm {
            padding: 6px 12px;
            font-size: 0.8rem;
            border-radius: var(--radius-sm);
        }

        /* KPI Cards Grid */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 18px;
            margin-bottom: 24px;
        }

        .kpi-card {
            padding: 20px;
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
            opacity: 0.6;
        }

        .kpi-label {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            font-weight: 700;
            margin-bottom: 6px;
        }

        .kpi-value {
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #fff;
            display: flex;
            align-items: baseline;
            gap: 8px;
        }

        .kpi-sub {
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-top: 4px;
        }

        /* Audit Table Container */
        .table-container {
            overflow: hidden;
            margin-bottom: 30px;
        }

        .table-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
        }

        .table-title {
            font-size: 1.1rem;
            font-weight: 700;
        }

        .search-box {
            position: relative;
            width: 280px;
        }

        .search-box input {
            width: 100%;
            padding-left: 36px;
        }

        .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 14px;
        }

        /* Table */
        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 0.875rem;
        }

        th {
            background: rgba(15, 23, 42, 0.4);
            padding: 14px 18px;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--text-muted);
            font-weight: 700;
            border-bottom: 1px solid var(--border);
        }

        td {
            padding: 16px 18px;
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

        /* Comparison Badges */
        .pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.02em;
        }

        .pill-success {
            background: var(--success-bg);
            color: var(--success);
            border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .pill-warning {
            background: var(--warning-bg);
            color: var(--warning);
            border: 1px solid rgba(245, 158, 11, 0.2);
        }

        .pill-info {
            background: rgba(6, 182, 212, 0.15);
            color: #22d3ee;
            border: 1px solid rgba(6, 182, 212, 0.3);
        }
        .btn-warning {
            background: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .btn-warning:hover {
            background: rgba(245, 158, 11, 0.25);
            border-color: #fbbf24;
        }
        .pill-danger {
            background: var(--danger-bg);
            color: var(--danger);
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .metric-badge {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            font-size: 0.85rem;
        }

        .diff-tag {
            font-size: 0.75rem;
            margin-left: 6px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 700;
        }

        .diff-plus {
            background: var(--warning-bg);
            color: var(--warning);
        }

        .diff-minus {
            background: var(--danger-bg);
            color: var(--danger);
        }

        /* Modal Dettagli */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.25s ease;
        }

        .modal-overlay.active {
            opacity: 1;
            visibility: visible;
        }

        .modal-content {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            width: 90%;
            max-width: 650px;
            max-height: 85vh;
            overflow-y: auto;
            padding: 28px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            transform: scale(0.95);
            transition: transform 0.25s ease;
        }

        .modal-overlay.active .modal-content {
            transform: scale(1);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .lessons-timeline {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 14px;
        }

        .timeline-item {
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            padding: 12px 16px;
            border-radius: var(--radius-md);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .timeline-date {
            font-weight: 600;
            font-size: 0.85rem;
        }

        .timeline-fp {
            font-size: 0.7rem;
            color: var(--text-muted);
            font-family: 'JetBrains Mono', monospace;
        }

        /* Toast notification */
        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: var(--bg-elevated);
            color: #fff;
            padding: 12px 20px;
            border-radius: var(--radius-md);
            border: 1px solid var(--border);
            box-shadow: 0 10px 25px rgba(0,0,0,0.4);
            z-index: 2000;
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .toast.show {
            transform: translateY(0);
            opacity: 1;
        }

        /* Auth Gate Modal */
        #authModal .modal-content {
            max-width: 420px;
            text-align: center;
        }

        .lock-icon {
            font-size: 40px;
            margin-bottom: 14px;
            color: var(--accent-primary);
        }

        /* Responsive */
        @media (max-width: 768px) {
            header {
                flex-direction: column;
                gap: 16px;
                align-items: flex-start;
            }
            .header-actions {
                flex-wrap: wrap;
                width: 100%;
            }
            .search-box {
                width: 100%;
            }
        }
    </style>
</head>
<body>

    <!-- Auth Password Modal -->
    <div id="authModal" class="modal-overlay">
        <div class="modal-content">
            <div class="lock-icon">🔒</div>
            <h2 style="margin-bottom: 8px;">Accesso Protetto</h2>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">
                Inserisci la password di amministrazione (<code>ADMIN_STATS_KEY</code>) per consultare e confrontare i dati.
            </p>
            <input type="password" id="authKeyInput" placeholder="Password di accesso" style="width: 100%; margin-bottom: 16px; text-align: center;" onkeydown="if(event.key==='Enter') verifyAndLoad()">
            <button class="btn btn-primary" style="width: 100%;" onclick="verifyAndLoad()">Accedi all'Audit</button>
            <p id="authErrorMsg" style="color: var(--danger); font-size: 0.8rem; margin-top: 12px; display: none;">Password non corretta. Riprova.</p>
        </div>
    </div>

    <!-- Main Dashboard Container -->
    <div class="container" id="mainDashboard" style="display: none;">
        <!-- Header -->
        <header class="glass-panel">
            <div class="brand-box">
                <div class="brand-icon">⚡</div>
                <div>
                    <div class="brand-title">MyLessons Data Audit</div>
                    <div class="brand-subtitle">Confronto Incrociato Google Sheets ↔ Calendar & DB</div>
                </div>
            </div>
            <div class="header-actions">
                <select id="teacherSelect" onchange="loadStats()">
                    <option value="">Tutti gli Insegnanti</option>
                </select>
                <button class="btn btn-secondary" onclick="loadStats()">
                    🔄 Aggiorna
                </button>
                <button class="btn btn-warning" onclick="triggerSaveOffsets()" title="Ricalcola e memorizza nel DB gli offset storici delle lezioni">
                    ⚡ Salva Offset nel DB
                </button>
                <button class="btn btn-primary" onclick="triggerBackfill()">
                    📥 Sincronizza da Calendar
                </button>
                <button class="btn btn-secondary" onclick="logout()" title="Esci">
                    🚪 Esci
                </button>
            </div>
        </header>

        <!-- KPI Summary Cards -->
        <div class="kpi-grid">
            <div class="glass-panel kpi-card">
                <div class="kpi-label">Lezioni Svolte Reali</div>
                <div class="kpi-value" id="kpiSvolte">0</div>
                <div class="kpi-sub" id="kpiSvolteSub">Verificate da Google Calendar</div>
            </div>
            <div class="glass-panel kpi-card">
                <div class="kpi-label">Lezioni Future Programmate</div>
                <div class="kpi-value" id="kpiProgrammate" style="color: var(--accent-secondary);">0</div>
                <div class="kpi-sub">In agenda per i prossimi giorni</div>
            </div>
            <div class="glass-panel kpi-card">
                <div class="kpi-label">Stato Allineamento Dati</div>
                <div class="kpi-value" id="kpiAllineamento">0%</div>
                <div class="kpi-sub" id="kpiAllineamentoSub">Tasso di concordanza Foglio/Calendar</div>
            </div>
            <div class="glass-panel kpi-card">
                <div class="kpi-label">Importo Totale Dovuto</div>
                <div class="kpi-value" id="kpiRevenue" style="color: var(--success);">0 €</div>
                <div class="kpi-sub" id="kpiRevenueSub">Calcolato su tariffa oraria reale</div>
            </div>
        </div>

        <!-- Audit Table -->
        <div class="glass-panel table-container">
            <div class="table-header">
                <div>
                    <div class="table-title">Matrice di Confronto e Audit per Studente</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Confronto tra i conteggi registrati nel foglio e gli appuntamenti reali</div>
                </div>
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="searchInput" placeholder="Cerca studente..." oninput="filterTable()">
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Insegnante</th>
                            <th>Studente</th>
                            <th>Foglio (Excel)</th>
                            <th>Calendar Salvate</th>
                            <th>Offset Storico (DB)</th>
                            <th>Totale Svolte</th>
                            <th>Differenza (&Delta;)</th>
                            <th>Stato</th>
                            <th>Tariffa</th>
                            <th>Importo Dovuto</th>
                            <th style="text-align: right;">Azioni</th>
                        </tr>
                    </thead>
                    <tbody id="auditTableBody">
                        <!-- Popolato dinamicamente da JS -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Modal Dettaglio Lezioni Studente -->
    <div id="detailModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <div>
                    <h3 id="modalStudentName">Dettaglio Lezioni</h3>
                    <div id="modalStudentEmail" style="font-size: 0.75rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;"></div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="closeModal()">✕ Chiudi</button>
            </div>
            <div style="margin-bottom: 12px; font-size: 0.85rem; color: var(--text-secondary);">
                Elenco di tutti gli appuntamenti associati recuperati dal calendario:
            </div>
            <div class="lessons-timeline" id="modalLessonsList"></div>
        </div>
    </div>

    <!-- Toast Notification -->
    <div id="toast" class="toast">Notifica</div>

    <script>
        let currentAuthKey = "";
        let fullData = [];

        function showToast(msg) {
            const t = document.getElementById("toast");
            t.innerText = msg;
            t.classList.add("show");
            setTimeout(() => t.classList.remove("show"), 3500);
        }

        // Controllo autenticazione iniziale
        window.addEventListener("DOMContentLoaded", () => {
            const params = new URLSearchParams(window.location.search);
            const keyFromUrl = params.get("key") || params.get("password");
            const storedKey = sessionStorage.getItem("admin_stats_key");

            if (keyFromUrl) {
                currentAuthKey = keyFromUrl;
                sessionStorage.setItem("admin_stats_key", currentAuthKey);
                loadStats();
            } else if (storedKey) {
                currentAuthKey = storedKey;
                loadStats();
            } else {
                document.getElementById("authModal").classList.add("active");
            }
        });

        async function verifyAndLoad() {
            const inputVal = document.getElementById("authKeyInput").value.trim();
            if (!inputVal) return;
            currentAuthKey = inputVal;
            const success = await loadStats();
            if (success) {
                sessionStorage.setItem("admin_stats_key", currentAuthKey);
                document.getElementById("authModal").classList.remove("active");
                document.getElementById("authErrorMsg").style.display = "none";
            } else {
                document.getElementById("authErrorMsg").style.display = "block";
            }
        }

        function logout() {
            sessionStorage.removeItem("admin_stats_key");
            currentAuthKey = "";
            document.getElementById("mainDashboard").style.display = "none";
            document.getElementById("authModal").classList.add("active");
        }

        async function loadStats() {
            const teacherSelect = document.getElementById("teacherSelect");
            const selectedTeacher = teacherSelect.value;
            let url = `/api?action=getTeacherRealLessonStats&key=${encodeURIComponent(currentAuthKey)}`;
            if (selectedTeacher) {
                url += `&teacher=${encodeURIComponent(selectedTeacher)}`;
            }

            try {
                const res = await fetch(url);
                if (res.status === 401) return false;
                const json = await res.json();

                if (json.status === "success") {
                    fullData = json.data || [];
                    document.getElementById("mainDashboard").style.display = "block";
                    updateTeacherDropdown();
                    renderKPIs();
                    renderTable();
                    return true;
                }
                return false;
            } catch (e) {
                console.error(e);
                return false;
            }
        }

        function updateTeacherDropdown() {
            const select = document.getElementById("teacherSelect");
            const currentVal = select.value;
            const uniqueTeachers = fullData.map(t => t.teacherName);

            // Mantieni la selezione attuale se valida
            select.innerHTML = '<option value="">Tutti gli Insegnanti</option>';
            uniqueTeachers.forEach(tName => {
                const opt = document.createElement("option");
                opt.value = tName;
                opt.textContent = tName;
                if (tName === currentVal) opt.selected = true;
                select.appendChild(opt);
            });
        }

        function renderKPIs() {
            let totalSvolte = 0;
            let totalProgrammate = 0;
            let totalRevenue = 0;
            let totalStudents = 0;
            let alignedStudents = 0;

            fullData.forEach(t => {
                totalSvolte += t.totalLessonsSvolte || 0;
                totalProgrammate += t.totalLessonsProgrammate || 0;
                totalRevenue += t.totalRevenueDue || 0;
                (t.students || []).forEach(s => {
                    totalStudents++;
                    // Nel confronto il dato è allineato se il conteggio coincide
                    if ((s.lezioniSvolte || 0) === (s.lezioniDaPagare || 0)) {
                        alignedStudents++;
                    }
                });
            });

            document.getElementById("kpiSvolte").innerText = totalSvolte;
            document.getElementById("kpiProgrammate").innerText = totalProgrammate;
            document.getElementById("kpiRevenue").innerText = totalRevenue.toFixed(2) + " €";

            const alignRate = totalStudents > 0 ? Math.round((alignedStudents / totalStudents) * 100) : 100;
            document.getElementById("kpiAllineamento").innerText = alignRate + "%";
            document.getElementById("kpiAllineamentoSub").innerText = `${alignedStudents} su ${totalStudents} studenti perfettamente allineati`;
        }

        function renderTable() {
            const tbody = document.getElementById("auditTableBody");
            tbody.innerHTML = "";
            const search = document.getElementById("searchInput").value.toLowerCase();

            fullData.forEach(t => {
                (t.students || []).forEach(s => {
                    const sName = s.studentName || s.studentEmail || "Sconosciuto";
                    const sEmail = s.studentEmail || "";
                    if (search && !sName.toLowerCase().includes(search) && !sEmail.toLowerCase().includes(search)) {
                        return;
                    }

                    const calSvolte = s.calLezioniSvolte !== undefined ? s.calLezioniSvolte : (s.lezioniSvolte || 0);
                    const calProgrammate = s.lezioniProgrammate || 0;
                    const offsetSvolte = s.offsetSvolte || 0;
                    const totaleSvolte = s.lezioniSvolteTotali !== undefined ? s.lezioniSvolteTotali : (calSvolte + offsetSvolte);
                    const sheetSvolte = s.sheetLezioniSvolte !== undefined ? s.sheetLezioniSvolte : (s.lezioniDaPagare || 0);
                    const diff = s.diff !== undefined ? s.diff : (totaleSvolte - sheetSvolte);
                    const tariffa = s.tariffa || 0;
                    const amountDue = s.amountDue || 0;
                    const daPagare = s.lezioniDaPagare !== undefined ? s.lezioniDaPagare : totaleSvolte;

                    const tr = document.createElement("tr");

                    // Status pill
                    let statusPill = '';
                    if (diff === 0) {
                        statusPill = '<span class="pill pill-success">✓ Allineato</span>';
                    } else if (diff > 0) {
                        statusPill = `<span class="pill pill-warning">⚠️ +${diff} non a foglio</span>`;
                    } else {
                        statusPill = `<span class="pill pill-danger">⚠️ ${diff} discrepanza</span>`;
                    }

                    tr.innerHTML = `
                        <td><b style="color: #cbd5e1;">${t.teacherName}</b></td>
                        <td>
                            <div class="student-cell">
                                <span class="student-name">${sName}</span>
                                <span class="student-email">${sEmail}</span>
                            </div>
                        </td>
                        <td>
                            <span class="metric-badge">${sheetSvolte} lez.</span>
                        </td>
                        <td>
                            <span class="metric-badge" style="color: var(--accent-secondary);">${calSvolte} sal.</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 2px;">(+${calProgrammate} prog.)</span>
                        </td>
                        <td>
                            <span class="pill pill-info">+${offsetSvolte} prec.</span>
                        </td>
                        <td>
                            <b style="color: #818cf8; font-size: 0.95rem;">${totaleSvolte}</b>
                        </td>
                        <td>
                            ${diff === 0 ? '<b style="color: var(--success);">0</b>' : `<span class="diff-tag ${diff > 0 ? 'diff-plus' : 'diff-minus'}">${diff > 0 ? '+' : ''}${diff}</span>`}
                        </td>
                        <td>${statusPill}</td>
                        <td><span class="metric-badge">${tariffa > 0 ? tariffa + ' €/h' : '-'}</span></td>
                        <td>
                            <div>
                                <b style="color: var(--success);">${amountDue.toFixed(2)} €</b>
                                <div style="font-size: 0.72rem; color: var(--text-muted);">${daPagare} da pagare</div>
                            </div>
                        </td>
                        <td style="text-align: right;">
                            <button class="btn btn-secondary btn-sm" onclick='openDetails(${JSON.stringify(s).replace(/'/g, "&#39;")})'>
                                🔍 Lezioni (${s.lessons ? s.lessons.length : 0})
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            });

            if (tbody.children.length === 0) {
                tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 30px; color: var(--text-muted);">Nessun dato trovato per i filtri selezionati.</td></tr>';
            }
        }

        function filterTable() {
            renderTable();
        }

        function openDetails(student) {
            document.getElementById("modalStudentName").innerText = student.studentName || "Dettaglio Studente";
            document.getElementById("modalStudentEmail").innerText = student.studentEmail || "";
            const list = document.getElementById("modalLessonsList");
            list.innerHTML = "";

            const lessons = student.lessons || [];
            if (lessons.length === 0) {
                list.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">Nessun evento registrato.</div>';
            } else {
                lessons.sort((a,b) => (b.date || "").localeCompare(a.date || "")).forEach(l => {
                    const item = document.createElement("div");
                    item.className = "timeline-item";
                    const isSvolta = l.status === "svolta";
                    item.innerHTML = `
                        <div>
                            <div class="timeline-date">${formatIsoDate(l.date)}</div>
                            <div class="timeline-fp">${l.id}</div>
                        </div>
                        <span class="pill ${isSvolta ? 'pill-success' : 'pill-warning'}">
                            ${isSvolta ? '✓ Svolta' : '⏳ Programmata'}
                        </span>
                    `;
                    list.appendChild(item);
                });
            }

            document.getElementById("detailModal").classList.add("active");
        }

        function closeModal() {
            document.getElementById("detailModal").classList.remove("active");
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
            showToast("Sincronizzazione in corso...");
            try {
                const res = await fetch(`/api?action=backfillRedisFromCalendar&key=${encodeURIComponent(currentAuthKey)}`);
                const json = await res.json();
                if (json.status === "success") {
                    showToast("Sincronizzazione completata con successo!");
                    loadStats();
                } else {
                    showToast("Errore durante la sincronizzazione: " + (json.message || "Errore sconosciuto"));
                }
            } catch(e) {
                showToast("Errore di rete durante la sincronizzazione.");
            }
        }
    </script>
</body>
</html>
"""
"""
Modulo per servire l'interfaccia interattiva di Audit e Confronto Dati
"""
def get_stats_ui_html() -> str:
    return HTML_CONTENT
