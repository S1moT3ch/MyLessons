import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, CircularProgress, IconButton,
    Card, Stack, Chip, Avatar, useTheme, useMediaQuery,
    ToggleButton, ToggleButtonGroup, Button, Dialog,
    DialogTitle, DialogContent, DialogActions, FormControl,
    Select, MenuItem, TextField, Fab, Zoom, Paper, LinearProgress, Tooltip, Badge
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    AccessTimeFilled as AccessTimeFilledIcon,
    Edit as EditIcon,
    DeleteSweep as DeleteSweepIcon,
    DeleteForever as DeleteForeverIcon,
    Save as SaveIcon,
    Refresh as RefreshIcon,
    WarningAmber as WarningAmberIcon,
    AddCircleOutline as AddCircleOutlineIcon,
} from '@mui/icons-material';
import FeedbackIcon from '@mui/icons-material/Feedback';
import { useNavigate, useLocation } from 'react-router-dom';
import Cookies from 'js-cookie';
import {APPS_SCRIPT_URL} from "./config/config";

// --- HELPERS ---

const getStudentColor = (email) => {
    if (!email) return '#9c27b0';
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 65%, 40%)`;
};

const calculateEndTime = (startTime, durationMinutes) => {
    if (!startTime) return "12:00";
    const [hours, minutes] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes + Number(durationMinutes), 0);
    return date.getHours().toString().padStart(2, '0') + ":" +
        date.getMinutes().toString().padStart(2, '0');
};

// Logica di ricalcolo sequenziale per garantire la cascata su tutti gli slot
const applyCascade = (slots) => {
    if (slots.length === 0) return [];

    const sorted = [...slots].sort((a, b) => a.ora.localeCompare(b.ora));
    const result = [];

    sorted.forEach((slot, idx) => {
        if (idx === 0) {
            result.push(slot);
        } else {
            const prevSlot = result[idx - 1]; // Riferimento allo slot appena ricalcolato
            const newStart = calculateEndTime(prevSlot.ora, prevSlot.durata || 60);
            result.push({ ...slot, ora: newStart });
        }
    });
    return result;
};

export default function SchedulePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [pendingChanges, setPendingChanges] = useState(false);
    const [hadChangesBeforeEditing, setHadChangesBeforeEditing] = useState(false);

    const [localSchedules, setLocalSchedules] = useState(() => {
        const saved = localStorage.getItem('cache_schedules');
        return saved ? JSON.parse(saved) : [];
    });
    const [subscribers, setSubscribers] = useState([]);
    const [loading, setLoading] = useState(localSchedules.length === 0);

    const [viewMode, setViewMode] = useState('giorno');
    const [filterDay, setFilterDay] = useState(() => {
        // Se arriviamo dalla pagina feedback, leggiamo il giorno dallo state
        if (location.state?.initialDay) {
            return location.state.initialDay;
        }

        // Altrimenti, default sul giorno odierno
        return new Date().toLocaleDateString('it-IT', { weekday: 'long' }).charAt(0).toUpperCase() +
            new Date().toLocaleDateString('it-IT', { weekday: 'long' }).slice(1);
    });

    const [editingSlot, setEditingSlot] = useState(null);
    const [openConfirmClearDay, setOpenConfirmClearDay] = useState(false);
    const [openConfirmClearWeek, setOpenConfirmClearWeek] = useState(false);
    const [openTimeDialog, setOpenTimeDialog] = useState(false);
    const [timeData, setTimeData] = useState({ old: '', new: '', index: null });

    const giorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    const getAuthData = useCallback(() => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return null;
        try { return JSON.parse(sessionStr); } catch (e) { return null; }
    }, []);

    const fetchData = useCallback(async (isSilent = false) => {
        const session = getAuthData();
        if (!session?.id_token) return navigate('/login');
        const teacherFullName = `${session.given_name} ${session.family_name}`;

        if (!isSilent) setLoading(true);

        try {
            const [resSched, resSubs] = await Promise.all([
                fetch(`${APPS_SCRIPT_URL}?action=getStudentSchedules&teacherName=${encodeURIComponent(teacherFullName)}&token=${session.id_token}`),
                fetch(`${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${session.sub}&token=${session.id_token}`)
            ]);

            const dataSched = await resSched.json();
            const dataSubs = await resSubs.json();

            if (dataSched.status === "success") {
                setLocalSchedules(dataSched.data);
                // --- AGGIUNGI QUESTA RIGA ---
                localStorage.setItem('cache_schedules', JSON.stringify(dataSched.data));
                // ----------------------------
            }

            if (dataSubs.status === "success") {
                setSubscribers(dataSubs.data);
                // Opzionale: puoi salvare anche questi se vuoi la lista studenti istantanea in modifica
                localStorage.setItem('cache_subscribers', JSON.stringify(dataSubs.data));
            }

            setHasChanges(false);
        } catch (error) {
            console.error("Errore recupero dati:", error);
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [getAuthData, navigate]);

    useEffect(() => {
        // 1. Se l'utente sta modificando (editingSlot non è null),
        // BLOCCA assolutamente ogni fetch dal server.
        if (editingSlot !== null) return;

        // 2. Se ci sono cambiamenti pendenti non salvati, non caricare.
        if (hasChanges) return;

        const hasCache = localSchedules && localSchedules.length > 0;

        // Solo se non stiamo editando e non abbiamo modifiche, sincronizziamo.
        fetchData(hasCache);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchData, hasChanges, editingSlot]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            // Ricarica solo se la pagina è visibile E NON ci sono modifiche non salvate
            if (document.visibilityState === 'visible' && !hasChanges) {
                console.log("Bentornato! Sincronizzazione silenziosa...");
                fetchData(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [fetchData, hasChanges]);

    const saveFullDay = async () => {
        if (saving) return;

        const session = getAuthData();
        if (!session?.id_token) {
            window.location.href = '/login';
            return;
        }

        setSaving(true);

        // Non resettiamo hasChanges qui!
        // Lo lasciamo true così il tasto resta visibile in stato "Invio..."

        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: "saveFullSchedule",
                    id_token: session.id_token,
                    teacherName: `${session.given_name} ${session.family_name}`,
                    allSchedules: localSchedules
                })
            });

            const resultText = await response.text();

            if (resultText.includes("Success")) {
                // Se l'invio ha successo, sincronizziamo i dati dal server
                await fetchData(true);

                // IMPORTANTE: Resettiamo hasChanges solo se nel frattempo
                // l'utente non ha aperto altri slot (pendingChanges è false)
                if (!pendingChanges) {
                    setHasChanges(false);
                }
            } else {
                setHasChanges(true);
                alert("Errore nel salvataggio.");
            }
        } catch (e) {
            setHasChanges(true);
            alert("Errore di rete.");
        } finally {
            setSaving(false);
            // Se durante il caricamento l'utente ha cliccato "Fatto" su un altro slot,
            // hasChanges sarà tornato true e il tasto diventerà di nuovo cliccabile.
        }
    };

    const handleAddEmptySlot = () => {
        const daySlots = localSchedules.filter(s => s.giorno === filterDay);
        let nextTime = "12:00";

        if (daySlots.length > 0) {
            const lastSlot = [...daySlots].sort((a,b) => a.ora.localeCompare(b.ora)).pop();
            nextTime = calculateEndTime(lastSlot.ora, 60);
        }

        const newSlot = { giorno: filterDay, ora: nextTime, email: "", nome: "", durata: 60 };
        setLocalSchedules([...localSchedules, newSlot]);
        setHasChanges(true);
    };

    const getLessonsData = useCallback((targetDay) => {
        return localSchedules
            .map((slot, globalIdx) => ({ ...slot, globalIdx }))
            .filter(slot => slot.giorno === targetDay)
            .sort((a, b) => a.ora.localeCompare(b.ora));
    }, [localSchedules]);

    const handleRemoveSlotCompletely = async (globalIdx) => {
        const slotToRemove = localSchedules[globalIdx];
        const targetDay = slotToRemove.giorno;
        const isOccupied = slotToRemove.email !== "";

        if (isOccupied && !window.confirm(`Rimuovendo lo slot eliminerai anche la lezione per ${slotToRemove.nome}. Confermi?`)) return;

        setEditingSlot(null);

        const filteredGlobal = localSchedules.filter((_, idx) => idx !== globalIdx);
        const daySlots = filteredGlobal.filter(s => s.giorno === targetDay);
        const recalculatedDay = applyCascade(daySlots);

        const finalSchedules = [
            ...filteredGlobal.filter(s => s.giorno !== targetDay),
            ...recalculatedDay
        ];

        setLocalSchedules(finalSchedules);
        setHasChanges(true);

    };

    const handleUpdateLocalSlot = (studentEmail, globalIdx, action = "add", studentIdx = null) => {
        const updated = [...localSchedules];
        // Usiamo una copia profonda per evitare problemi di riferimento
        const currentSlot = { ...updated[globalIdx] };

        // 1. Inizializzazione Array (Compatibilità dati vecchi/nuovi)
        if (!currentSlot.students) {
            // Se c'è una stringa email con virgole, la splittiamo, altrimenti usiamo il singolo valore
            if (currentSlot.email && currentSlot.email.includes(",")) {
                const emails = currentSlot.email.split(",");
                const nomi = currentSlot.nome ? currentSlot.nome.split(",") : [];
                currentSlot.students = emails.map((em, i) => ({
                    email: em.trim(),
                    nome: nomi[i] ? nomi[i].trim() : em.trim()
                }));
            } else {
                currentSlot.students = currentSlot.email
                    ? [{ email: currentSlot.email, nome: currentSlot.nome }]
                    : [];
            }
        }

        // 2. Logica di Aggiunta/Rimozione
        if (action === "add") {
            const student = subscribers.find(s => s.studentEmail.toLowerCase() === studentEmail.toLowerCase());
            // Verifichiamo che lo studente esista e non sia già presente nell'elenco di questo slot
            if (student && !currentSlot.students.find(s => s.email.toLowerCase() === studentEmail.toLowerCase())) {
                currentSlot.students.push({
                    email: student.studentEmail,
                    nome: student.studentName
                });
            }
        } else if (action === "remove") {
            currentSlot.students.splice(studentIdx, 1);
        }

        // 3. SERIALIZZAZIONE PER IL BACKEND (Punto cruciale)
        // Trasformiamo l'array in stringhe separate da virgola che Apps Script può processare
        currentSlot.email = currentSlot.students.map(s => s.email).join(",");
        currentSlot.nome = currentSlot.students.map(s => s.nome).join(", ");

        // 4. Aggiornamento Stato
        updated[globalIdx] = currentSlot;
        setLocalSchedules(updated);
        setPendingChanges(true);
    };

    const handleClearFullDayLocal = () => {
        const updated = localSchedules.map(slot =>
            slot.giorno === filterDay ? { ...slot, email: "", nome: "" } : slot
        );
        setLocalSchedules(updated);
        setHasChanges(true);
        setOpenConfirmClearDay(false);
    };

    const handleUpdateLocalTime = () => {
        const slotIdx = timeData.index;
        if (slotIdx === null || !localSchedules[slotIdx]) return;

        const targetDay = localSchedules[slotIdx].giorno;

        // 1. Creiamo la copia aggiornata con il NUOVO orario inserito dall'utente
        const updatedSchedules = localSchedules.map((slot, idx) => {
            if (idx === slotIdx) {
                return { ...slot, ora: timeData.new };
            }
            return slot;
        });

        // 2. Separiamo gli slot del giorno e ordiniamoli
        const daySlots = updatedSchedules
            .filter(s => s.giorno === targetDay)
            .sort((a, b) => a.ora.localeCompare(b.ora));

        // 3. APPLICHIAMO LA CASCATA SOLO DA QUELLO MODIFICATO IN POI
        // Troviamo la nuova posizione dello slot modificato dopo l'ordinamento
        const newIdxInDay = daySlots.findIndex(s => s.ora === timeData.new);

        const recalculatedDay = [...daySlots];
        for (let i = newIdxInDay + 1; i < recalculatedDay.length; i++) {
            const prev = recalculatedDay[i - 1];
            recalculatedDay[i] = {
                ...recalculatedDay[i],
                ora: calculateEndTime(prev.ora, prev.durata || 60)
            };
        }

        // 4. Ricomponiamo l'array globale
        const otherDays = updatedSchedules.filter(s => s.giorno !== targetDay);
        setLocalSchedules([...otherDays, ...recalculatedDay]);

        setOpenTimeDialog(false);
        setEditingSlot(null);
    };

    const handleResetForNewWeek = async () => {
        const session = getAuthData();
        if (!session?.id_token) {
            navigate('/login');
            return;
        }
        setSaving(true);
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({
                    action: "resetScheduleForNewWeek",
                    id_token: session.id_token,
                    teacherName: `${session.given_name} ${session.family_name}`
                })
            });
            if ((await response.text()).includes("Success")) {
                fetchData();
                setOpenConfirmClearWeek(false);
            }
        } catch (e) { alert("Errore reset."); } finally { setSaving(false); }
    };

    const getStatusBorderColor = (giorno, ora, emailStudenteInAgenda) => {
        if (!emailStudenteInAgenda) return 'transparent';

        const savedFeedbacks = JSON.parse(localStorage.getItem('cache_feedbacks') || "[]");

        // Normalizziamo l'ora per gestire i formati HH:mm o HHmm
        const normalizeTime = (t) => t.toString().replace(/[:.]/g, '');

        const feedback = savedFeedbacks.find(f =>
            f.giorno === giorno &&
            normalizeTime(f.ora) === normalizeTime(ora) &&
            f.studentEmail?.toLowerCase().trim() === emailStudenteInAgenda.toLowerCase().trim()
        );

        if (!feedback) return 'rgba(0,0,0,0.1)';
        return feedback.status === "Assente" ? '#f44336' : '#4caf50';
    };

    return (
        <Box sx={{ p: isMobile ? 1.5 : 3, pb: isMobile ? 22 : 12, maxWidth: 650, mx: 'auto', bgcolor: '#f8f9fa', minHeight: '100vh' }}>
            {/* BARRA DI PROGRESSO ATTECCATA IN ALTO */}
            {/* Appare solo quando saving è true */}
            <Box sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 2000, // Sopra a tutto
                height: 4
            }}>
                {saving && <LinearProgress color="success" sx={{ height: 4 }} />}
            </Box>

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                    <IconButton onClick={() => navigate(-1)} size="large"><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" fontWeight="800">Agenda</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                    {/* NUOVO TASTO FEEDBACK */}
                    <Tooltip title="Vedi risposte studenti">
                        <IconButton
                            onClick={() => navigate("/dashboard/feedbacks")}
                            sx={{
                                bgcolor: 'white',
                                boxShadow: 1,
                                border: '1px solid',
                                borderColor: 'primary.light',
                                color: 'primary.main',
                                '&:hover': { bgcolor: 'primary.light', color: 'white' }
                            }}
                        >
                            {/* Il Badge mostra un puntino se ci sono nuovi feedback (opzionale) */}
                            <Badge variant="dot" color="error" overlap="circular">
                                <FeedbackIcon />
                            </Badge>
                        </IconButton>
                    </Tooltip>
                    <ToggleButtonGroup value={viewMode} exclusive onChange={(e, next) => next && setViewMode(next)} size="small">
                        <ToggleButton value="giorno">Giorno</ToggleButton>
                        <ToggleButton value="settimana">Settimana</ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
            </Stack>

            {viewMode === 'giorno' && (
                <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', mb: 3, pb: 1 }}>
                    {giorni.map((g) => (
                        <Chip
                            key={g}
                            label={g}
                            clickable
                            color={filterDay === g ? "primary" : "default"}
                            variant={filterDay === g ? "filled" : "outlined"}
                            onClick={() => setFilterDay(g)}
                            sx={{ fontWeight: 'bold' }}
                        />
                    ))}
                </Box>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>
            ) : (
                <Box>
                    {(viewMode === 'giorno' ? [filterDay] : giorni).map((currentDay) => {
                        const lessons = getLessonsData(currentDay);
                        if (viewMode === 'settimana' && lessons.length === 0) return null;

                        return (
                            <Box key={currentDay} sx={{ mb: 4 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                    <Typography variant="overline" color="text.secondary" fontWeight="900" sx={{ ml: 1 }}>{currentDay}</Typography>
                                    {viewMode === 'giorno' && (
                                        <Button startIcon={<AddCircleOutlineIcon />} size="small" onClick={handleAddEmptySlot} sx={{ fontWeight: 'bold' }}>Nuovo Slot</Button>
                                    )}
                                </Stack>
                                <Stack spacing={1.5}>
                                    {lessons.map((slot) => {
                                        const isEditing = editingSlot === `${slot.globalIdx}`;
                                        const hasStudents = slot.students && slot.students.length > 0;

                                        return (
                                            <Card key={slot.globalIdx} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: isEditing ? 'primary.main' : '#e0e0e0', mb: 1.5, overflow: 'hidden' }}>
                                                <Box sx={{ display: 'flex', flexDirection: isEditing ? 'column' : 'row' }}>

                                                    {/* Sezione Orario (Sempre visibile) */}
                                                    <Box sx={{
                                                        p: 1,
                                                        minWidth: isEditing ? '100%' : 75,
                                                        display: 'flex',
                                                        flexDirection: isEditing ? 'row' : 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        borderRight: isEditing ? 'none' : '1px solid #eee',
                                                        borderBottom: isEditing ? '1px solid #eee' : 'none',
                                                        bgcolor: '#fafafa',
                                                        gap: isEditing ? 2 : 0
                                                    }}>
                                                        <Typography variant="body2" fontWeight="800">{slot.ora}</Typography>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                setTimeData({
                                                                    old: slot.ora,
                                                                    new: slot.ora,
                                                                    index: slot.globalIdx // Questo deve essere l'indice originale di localSchedules
                                                                });
                                                                setOpenTimeDialog(true);
                                                            }}
                                                        >
                                                            <AccessTimeFilledIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                        {isEditing && <Typography variant="caption" fontWeight="bold" color="primary">MODIFICA PARTECIPANTI</Typography>}
                                                    </Box>

                                                    {/* Sezione Studenti */}
                                                    <Box sx={{ p: 1.5, flexGrow: 1 }}>
                                                        {isEditing ? (
                                                            <Stack spacing={2}>
                                                                {/* Lista Partecipanti con tasto rimozione */}
                                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                                    {(slot.students || []).map((s, idx) => (
                                                                        <Paper key={idx} variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 2, bgcolor: '#fdfdfd' }}>
                                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                                <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>{s.nome[0]}</Avatar>
                                                                                <Typography variant="body2" fontWeight="700">{s.nome}</Typography>
                                                                            </Stack>
                                                                            <IconButton size="small" color="error" onClick={() => handleUpdateLocalSlot(null, slot.globalIdx, "remove", idx)}>
                                                                                <DeleteSweepIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Paper>
                                                                    ))}
                                                                </Box>

                                                                {/* Selettore Aggiunta */}
                                                                <FormControl fullWidth size="small">
                                                                    <Select
                                                                        value=""
                                                                        displayEmpty
                                                                        onChange={(e) => handleUpdateLocalSlot(e.target.value, slot.globalIdx, "add")}
                                                                        sx={{ borderRadius: 3 }}
                                                                    >
                                                                        <MenuItem value="" disabled><em>+ Aggiungi studente...</em></MenuItem>

                                                                        {/* FILTRO: Mostra solo i subscribers che NON sono già in slot.students */}
                                                                        {[...subscribers]
                                                                            .filter(sub =>
                                                                                !(slot.students || []).some(s => s.email.toLowerCase() === sub.studentEmail.toLowerCase())
                                                                            )
                                                                            .sort((a, b) => a.studentName.localeCompare(b.studentName))
                                                                            .map((sub) => (
                                                                                <MenuItem key={sub.studentEmail} value={sub.studentEmail}>
                                                                                    {sub.studentName}
                                                                                </MenuItem>
                                                                            ))
                                                                        }
                                                                    </Select>
                                                                </FormControl>

                                                                <Button
                                                                    fullWidth
                                                                    variant="contained"
                                                                    onClick={() => {
                                                                        // PRIMA segnaliamo che ci sono modifiche da salvare
                                                                        if (pendingChanges || hadChangesBeforeEditing) {
                                                                            setHasChanges(true);
                                                                        }

                                                                        // POI chiudiamo l'interfaccia di editing
                                                                        // Questo ordine è CRUCIALE per evitare il refresh automatico
                                                                        setEditingSlot(null);
                                                                        setPendingChanges(false);
                                                                    }}
                                                                    sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 'bold' }}
                                                                >
                                                                    Fatto
                                                                </Button>
                                                            </Stack>
                                                        ) : (
                                                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                                                {/* Chip con scorrimento orizzontale su Mobile */}
                                                                <Box sx={{
                                                                    flexGrow: 1,
                                                                    display: 'flex',
                                                                    overflowX: 'auto',
                                                                    gap: 0.5,
                                                                    py: 0.5,
                                                                    '&::-webkit-scrollbar': { display: 'none' } // Nasconde scrollbar
                                                                }}>
                                                                    {hasStudents ? (
                                                                        slot.students.map((s, idx) => {
                                                                            const statusColor = getStatusBorderColor(slot.giorno, slot.ora, s.email);

                                                                            return (
                                                                                <Tooltip key={idx} title={statusColor === '#f44336' ? "Assente" : statusColor === '#4caf50' ? "Confermato" : "In attesa"}>
                                                                                    <Box sx={{
                                                                                        display: 'inline-flex',
                                                                                        p: '1.5px',
                                                                                        borderRadius: '16px',
                                                                                        border: '2.5px solid',
                                                                                        borderColor: statusColor,
                                                                                        mr: 0.5,
                                                                                        transition: 'all 0.3s ease'
                                                                                    }}>
                                                                                        <Chip
                                                                                            label={s.nome.split(' ')[0]}
                                                                                            size="small"
                                                                                            sx={{ bgcolor: getStudentColor(s.email), color: 'white', fontWeight: 'bold', height: 20 }}
                                                                                        />
                                                                                    </Box>
                                                                                </Tooltip>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>Libero</Typography>
                                                                    )}
                                                                </Box>

                                                                <Stack direction="row">
                                                                    <IconButton onClick={() => {
                                                                        setHadChangesBeforeEditing(hasChanges);
                                                                        // NON resettiamo hasChanges qui se saving è true,
                                                                        // altrimenti il tasto "Invio..." sparirebbe mentre salva
                                                                        if (!saving) setHasChanges(false);

                                                                        setPendingChanges(false);
                                                                        setEditingSlot(`${slot.globalIdx}`);
                                                                    }}>
                                                                        <EditIcon fontSize="small" color="primary" />
                                                                    </IconButton>
                                                                    <IconButton onClick={() => handleRemoveSlotCompletely(slot.globalIdx)}><DeleteSweepIcon fontSize="small" color="error" /></IconButton>
                                                                </Stack>
                                                            </Stack>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </Card>
                                        );
                                    })}
                                </Stack>
                            </Box>
                        );
                    })}
                    {/* Azioni Mobile */}
                    <Paper elevation={10} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 2, borderRadius: '24px 24px 0 0', display: isMobile ? 'block' : 'none', bgcolor: 'white', zIndex: 1000 }}>
                        <Stack direction="row" spacing={2}>
                            <Button fullWidth variant="outlined" color="error" startIcon={<DeleteSweepIcon />} onClick={() => setOpenConfirmClearDay(true)}>
                                Svuota {filterDay.slice(0,3)}
                            </Button>
                            <Button fullWidth variant="contained" color="error" startIcon={<DeleteForeverIcon />} onClick={() => setOpenConfirmClearWeek(true)}>
                                Reset Settimana
                            </Button>
                        </Stack>
                    </Paper>

                    {/* Azioni Desktop */}
                    {!isMobile && (
                        <Box sx={{ mt: 4, textAlign: 'center' }}>
                            <Stack direction="row" spacing={2} justifyContent="center">
                                <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />} onClick={() => setOpenConfirmClearDay(true)}>Svuota Giorno Corrente</Button>
                                <Button variant="contained" color="error" startIcon={<DeleteForeverIcon />} onClick={() => setOpenConfirmClearWeek(true)}>Reset Settimana</Button>
                            </Stack>
                        </Box>
                    )}

                    {/* Dialogs di conferma */}
                </Box>
            )}

            <Dialog open={openConfirmClearWeek} onClose={() => setOpenConfirmClearWeek(false)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ textAlign: 'center' }}><WarningAmberIcon color="error" fontSize="large" /><br/>Reset Settimana?</DialogTitle>
                <DialogActions sx={{ p: 2, justifyContent: 'center' }}>
                    <Button onClick={() => setOpenConfirmClearWeek(false)}>Annulla</Button>
                    <Button onClick={handleResetForNewWeek} variant="contained" color="error" disabled={saving}>Svuota (Nuova Settimana)</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openConfirmClearDay} onClose={() => setOpenConfirmClearDay(false)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ textAlign: 'center' }}>Svuota {filterDay}</DialogTitle>
                <DialogContent><Typography textAlign="center">Rimuovere gli studenti assegnati a {filterDay}?</Typography></DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: 'center' }}>
                    <Button onClick={() => setOpenConfirmClearDay(false)}>Annulla</Button>
                    <Button onClick={handleClearFullDayLocal} variant="contained" color="error">Conferma</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openTimeDialog} onClose={() => setOpenTimeDialog(false)}>
                <DialogTitle>Modifica Orario</DialogTitle>
                <DialogContent>
                    <TextField fullWidth type="time" value={timeData.new} onChange={(e) => setTimeData({...timeData, new: e.target.value})} sx={{ mt: 1 }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenTimeDialog(false)}>Annulla</Button>
                    <Button onClick={handleUpdateLocalTime} variant="contained">Aggiorna</Button>
                </DialogActions>
            </Dialog>

            <Zoom in={hasChanges}>
                <Box sx={{ position: 'fixed', bottom: isMobile ? 110 : 30, right: 30, zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 2 }}>

                    {/* Tasto REFRESH: disabilitato se stiamo salvando */}
                    <Fab color="error" size="small" onClick={() => fetchData()} disabled={saving}>
                        <RefreshIcon />
                    </Fab>

                    {/* Tasto SALVA:
            - Se saving è true: mostra la rotellina e non è cliccabile.
            - Appena saving torna false, se hasChanges è ancora true (perché hai fatto altre modifiche),
              il tasto torna verde e cliccabile per il secondo invio.
        */}
                    <Fab
                        color="success"
                        variant="extended"
                        onClick={saveFullDay}
                        disabled={saving}
                        sx={{ minWidth: 150, boxShadow: 4 }}
                    >
                        {saving ? (
                            <>
                                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                                <Typography variant="button" sx={{ fontWeight: 'bold' }}>Invio...</Typography>
                            </>
                        ) : (
                            <>
                                <SaveIcon sx={{ mr: 1 }} />
                                <Typography variant="button" sx={{ fontWeight: 'bold' }}>Salva</Typography>
                            </>
                        )}
                    </Fab>
                </Box>
            </Zoom>
        </Box>
    );
}