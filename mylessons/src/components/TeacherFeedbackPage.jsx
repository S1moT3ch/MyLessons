import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, CircularProgress, IconButton,
    Card, Stack, Paper, useMediaQuery, useTheme,
    ToggleButton, ToggleButtonGroup, Tab, Tabs,
    Divider, Button, Collapse, Dialog, DialogTitle,
    DialogContent, DialogActions, Snackbar, Alert
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    CalendarMonth as CalendarIcon,
    CheckCircle as DoneIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

export default function TeacherFeedbackPage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // --- LOGICA DI CACHE: Recupero immediato dei dati ---
    const [feedbackList, setFeedbackList] = useState(() => {
        const saved = localStorage.getItem('cache_feedbacks');
        return saved ? JSON.parse(saved) : [];
    });

    const [fullSchedule, setFullSchedule] = useState(() => {
        const saved = localStorage.getItem('cache_schedules');
        return saved ? JSON.parse(saved) : [];
    });

    const [isResolving, setIsResolving] = useState(null); // Conterrà l'ID o l'indice del feedback in elaborazione

    // Se abbiamo dati in cache, non mostriamo lo spinner all'inizio
    const [loading, setLoading] = useState(feedbackList.length === 0);

    // 1. Stato per il Dialog di CONFERMA (Prima di agire)
    const [confirmDialog, setConfirmDialog] = useState({ open: false, item: null, idx: null });

    // 2. Stato per lo SNACKBAR (Feedback rapido dopo il successo)
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

    // 3. Stato per il DIALOG DI ERRORE (Se qualcosa va storto)
    const [errorDialog, setErrorDialog] = useState({ open: false, title: '', message: '' });

    // Filtri
    const [viewFilter, setViewFilter] = useState('today');
    const [selectedDay, setSelectedDay] = useState(
        new Date().toLocaleDateString('it-IT', { weekday: 'long' }).charAt(0).toUpperCase() +
        new Date().toLocaleDateString('it-IT', { weekday: 'long' }).slice(1)
    );

    const giorniSettimana = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    const fetchData = useCallback(async (isSilent = false) => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return navigate('/login');
        const session = JSON.parse(sessionStr);
        const teacherFullName = `${session.given_name} ${session.family_name}`;

        if (!isSilent) setLoading(true);

        try {
            const [resFb, resSched] = await Promise.all([
                fetch(`${APPS_SCRIPT_URL}?action=getTeacherFeedbackSummary&teacherName=${encodeURIComponent(teacherFullName)}&token=${session.id_token}`),
                fetch(`${APPS_SCRIPT_URL}?action=getStudentSchedules&teacherName=${encodeURIComponent(teacherFullName)}&token=${session.id_token}`)
            ]);

            const resultFb = await resFb.json();
            const resultSched = await resSched.json();

            if (resultFb.status === "success") {
                setFeedbackList(resultFb.data);
                // Aggiorniamo la cache globale
                localStorage.setItem('cache_feedbacks', JSON.stringify(resultFb.data));

                // Aggiorniamo anche la cache assenze per il badge della dashboard
                const absences = resultFb.data.filter(f => f.status === "Assente");
                localStorage.setItem('cache_absences', JSON.stringify(absences));
            }

            if (resultSched.status === "success") {
                setFullSchedule(resultSched.data);
                localStorage.setItem('cache_schedules', JSON.stringify(resultSched.data));
            }

        } catch (e) {
            console.error("Errore fetch feedback:", e);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        // Caricamento silenzioso se abbiamo già i dati salvati
        const hasCache = feedbackList.length > 0;
        fetchData(hasCache);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchData]);

    // Questa funzione viene chiamata dal tasto "Segna come risolto" sulla card
    const askResolveConfirmation = (item, idx) => {
        setConfirmDialog({ open: true, item, idx });
    };

// Questa è la funzione che esegue la logica reale (chiamata dal Dialog)
    const handleResolveFeedback = async () => {
        const { item, idx } = confirmDialog;
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr || !item) return;
        const session = JSON.parse(sessionStr);

        // Chiudiamo subito il dialog di conferma
        setConfirmDialog({ ...confirmDialog, open: false });

        // Avviamo l'animazione di caricamento sulla card
        setIsResolving(idx);

        try {
            const oraPulita = item.ora.replace(":", "").trim();
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: "resolveFeedback",
                    teacherName: `${session.given_name} ${session.family_name}`.trim(),
                    studentName: item.studentName,
                    ora: oraPulita,
                    giorno: item.giorno.trim(),
                    studentEmail: item.studentEmail
                })
            });

            const result = await response.text();

            if (result.includes("Success")) {
                // Effetto UX di uscita
                setIsResolving(`exiting-${idx}`);
                await new Promise(res => setTimeout(res, 350));

                setFeedbackList(prev => {
                    const newList = prev.filter((_, i) => i !== prev.indexOf(item));
                    localStorage.setItem('cache_feedbacks', JSON.stringify(newList));
                    localStorage.setItem('cache_absences', JSON.stringify(newList.filter(f => f.status === "Assente")));
                    return newList;
                });

                // Mostriamo lo snackbar di successo
                setNotification({ open: true, message: 'Lezione risolta correttamente!', severity: 'success' });

            } else {
                setErrorDialog({ open: true, title: 'Errore', message: `Database: ${result}` });
            }
        } catch (e) {
            setErrorDialog({ open: true, title: 'Errore Rete', message: 'Controlla la connessione internet.' });
        } finally {
            setIsResolving(null);
        }
    };

    const timeToMinutes = (timeStr) => {
        const [hrs, mins] = timeStr.replace('.', ':').split(':').map(Number);
        return hrs * 60 + mins;
    };

    const checkOverlap = (start1, duration1, start2) => {
        const s1 = timeToMinutes(start1);
        const e1 = s1 + Number(duration1);
        const s2 = timeToMinutes(start2);

        // Ritorna true se l'orario proposto (s2) cade tra l'inizio (s1) e la fine (e1) dello slot esistente
        // Usiamo >= e < per permettere a una lezione di iniziare esattamente quando finisce l'altra
        return s2 >= s1 && s2 < e1;
    };

    const getOccupantAt = (preferenzaString) => {
        if (!preferenzaString || !fullSchedule.length) return null;

        // Regex per estrarre Giorno e Ora (es: "Lunedì 15:30")
        const match = preferenzaString.match(/^([a-zA-Zàèìòù]+)\s+(\d{2})[:.](\d{2})$/i);
        if (!match) return null;

        const giornoProposto = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        const oraProposta = `${match[2]}:${match[3]}`;

        // Cerchiamo slot nel giorno proposto che si sovrappongono all'orario scelto dallo studente
        const occupanti = fullSchedule.filter(slot => {
            // 1. Deve essere lo stesso giorno
            if (slot.giorno !== giornoProposto) return false;

            // 2. Verifichiamo se l'ora proposta cade dentro questo slot
            // Se lo slot non ha durata, assumiamo 60 minuti come default
            return checkOverlap(slot.ora, slot.durata || 60, oraProposta);
        });

        // Se troviamo dei match, restituiamo i nomi degli studenti
        if (occupanti.length > 0) {
            // Raccogliamo tutti i nomi degli studenti in quegli slot (gestendo anche gli slot multipli/gruppi)
            const nomi = occupanti.flatMap(slot =>
                slot.students ? slot.students.map(st => st.nome) : []
            );

            // Rimuoviamo eventuali duplicati e uniamo i nomi
            return [...new Set(nomi)].join(", ");
        }

        return null;
    };

    const renderFeedbackCard = (item, idx) => {
        const occupante = getOccupantAt(item.preferenza);
        const isAssente = item.status === "Assente";

        // Gestione stati animazione
        const resolving = isResolving === idx; // Sta caricando
        const exiting = isResolving === `exiting-${idx}`; // Il server ha risposto, sta uscendo

        return (
            <Collapse in={!exiting} timeout={300} unmountOnExit key={idx}>
                <Card elevation={0} sx={{
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: isAssente ? '#ffebee' : '#f0f0f0',
                    bgcolor: 'white',
                    mb: 2, // Il margine inferiore deve stare dentro il Collapse per animarsi
                    overflow: 'hidden',
                    // Feedback visivo durante il caricamento (resolving)
                    opacity: resolving ? 0.6 : 1,
                    // Feedback visivo durante l'uscita (exiting)
                    transform: exiting ? 'scale(0.95)' : 'scale(1)',
                    transition: 'all 0.3s ease-out',
                    position: 'relative' // Per posizionare lo spinner se vuoi
                }}>
                    <Box sx={{ display: 'flex' }}>
                        <Box sx={{ width: 6, bgcolor: isAssente ? '#f44336' : '#4caf50' }} />

                        <Box sx={{ p: 2, flexGrow: 1 }}>
                            {/* Header Card */}
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                                <Box>
                                    <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1, color: '#2c3e50' }}>
                                        {item.ora.replace(":", "") === item.ora ? `${item.ora.slice(0, 2)}:${item.ora.slice(2)}` : item.ora}
                                    </Typography>
                                    <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                                        {viewFilter === 'all' ? item.giorno : 'Slot Orario'}
                                    </Typography>
                                </Box>

                                <Box sx={{
                                    px: 1.5, py: 0.5, borderRadius: 2,
                                    bgcolor: isAssente ? '#fff5f5' : '#e8f5e9',
                                    border: '1px solid',
                                    borderColor: isAssente ? '#feb2b2' : '#c6f6d5'
                                }}>
                                    <Typography variant="caption" fontWeight="900" color={isAssente ? "#c53030" : "#22543d"}>
                                        {isAssente ? "NON DISPONIBILE" : "CONFERMATO"}
                                    </Typography>
                                </Box>
                            </Stack>

                            <Typography variant="body1" fontWeight="800" sx={{ mb: 1.5, fontSize: '1.1rem' }}>
                                {item.studentName}
                            </Typography>

                            {/* Proposta Alternativa */}
                            {isAssente && item.preferenza && (
                                <Paper elevation={0} sx={{
                                    p: 1.5, mb: 1.5, borderRadius: 3,
                                    bgcolor: '#f8faff', border: '1px solid #e0e7ff'
                                }}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                        <CalendarIcon sx={{ fontSize: 18, color: '#3f51b5' }} />
                                        <Typography variant="caption" fontWeight="900" color="#3f51b5">
                                            PROPOSTA ALTERNATIVA
                                        </Typography>
                                    </Stack>
                                    <Typography variant="body2" fontWeight="800" sx={{ mb: 0.5 }}>
                                        {item.preferenza.toUpperCase()}
                                    </Typography>
                                    <Box sx={{
                                        display: 'inline-flex', alignItems: 'center', gap: 0.5,
                                        px: 1, py: 0.3, borderRadius: 1.5,
                                        bgcolor: occupante ? '#fffaf0' : '#f0fff4',
                                        color: occupante ? '#9c4221' : '#276749',
                                        border: '1px solid',
                                        borderColor: occupante ? '#feebc8' : '#c6f6d5'
                                    }}>
                                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
                                            {occupante ? `⚠️ OCCUPATO DA: ${occupante}` : "✅ SLOT LIBERO"}
                                        </Typography>
                                    </Box>
                                </Paper>
                            )}

                            {/* Note */}
                            {item.note && (
                                <Box sx={{ p: 1.5, mb: isAssente ? 2 : 0, bgcolor: '#f1f3f5', borderRadius: '12px 12px 12px 4px' }}>
                                    <Typography variant="body2" sx={{ color: '#495057', fontSize: '0.85rem', fontStyle: 'italic', lineHeight: 1.4 }}>
                                        "{item.note}"
                                    </Typography>
                                </Box>
                            )}

                            {/* MOSTRA IL TASTO SOLO SE LA LEZIONE È ROSSA (isAssente) */}
                            {isAssente && (
                                <>
                                    <Divider sx={{ my: 1.5, opacity: 0.5 }} />
                                    <Stack direction="row" justifyContent="flex-end">
                                        <Button
                                            size="small"
                                            color="success"
                                            variant="text"
                                            onClick={() => askResolveConfirmation(item, idx)}
                                            // Disabilitato sia se carica, sia se esce
                                            disabled={resolving || exiting}
                                            startIcon={(resolving || exiting) ? <CircularProgress size={16} color="inherit" /> : <DoneIcon />}
                                            sx={{
                                                fontWeight: '900',
                                                borderRadius: 2,
                                                textTransform: 'none'
                                            }}
                                        >
                                            {(resolving || exiting) ? 'Risoluzione...' : 'Segna come risolto'}
                                        </Button>
                                    </Stack>
                                </>
                            )}
                        </Box>
                    </Box>
                </Card>
            </Collapse>
        );
    };

    const renderContent = () => {
        if (loading && feedbackList.length === 0) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
        let displayData = [];
        if (viewFilter !== 'all') {
            displayData = feedbackList.filter(f => f.giorno === selectedDay).sort((a, b) => a.ora.localeCompare(b.ora));
            return (
                <Stack spacing={1.5}>
                    {displayData.length > 0 ? displayData.map((item, idx) => renderFeedbackCard(item, idx)) : (
                        <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mt: 4 }}>Nessuna risposta per {selectedDay}</Typography>
                    )}
                </Stack>
            );
        }
        return giorniSettimana.map(giorno => {
            const dayData = feedbackList.filter(f => f.giorno === giorno).sort((a, b) => a.ora.localeCompare(b.ora));
            if (dayData.length === 0) return null;
            return (
                <Box key={giorno} sx={{ mb: 4 }}>
                    <Typography variant="subtitle2" color="primary" fontWeight="900" sx={{ mb: 1.5, ml: 1, textTransform: 'uppercase' }}>{giorno}</Typography>
                    <Stack spacing={1.5}>{dayData.map((item, idx) => renderFeedbackCard(item, idx))}</Stack>
                </Box>
            );
        });
    };

    return (
        <Box sx={{ p: isMobile ? 2 : 3, pb: 10, maxWidth: 650, mx: 'auto', bgcolor: '#f8f9fa', minHeight: '100vh' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" fontWeight="900">Risposte</Typography>
                </Stack>
                <ToggleButtonGroup value={viewFilter} exclusive onChange={(e, val) => val && setViewFilter(val)} size="small" color="primary" sx={{ bgcolor: 'white' }}>
                    <ToggleButton value="specific" sx={{ px: 2, fontWeight: 'bold' }}>Giorno</ToggleButton>
                    <ToggleButton value="all" sx={{ px: 2, fontWeight: 'bold' }}>Settimana</ToggleButton>
                </ToggleButtonGroup>
            </Stack>
            {viewFilter !== 'all' && (
                <Paper elevation={0} sx={{ mb: 3, borderRadius: 4, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
                    <Tabs value={giorniSettimana.indexOf(selectedDay)} onChange={(e, val) => setSelectedDay(giorniSettimana[val])} variant="scrollable" scrollButtons="auto" sx={{ bgcolor: 'white' }}>
                        {giorniSettimana.map((g, i) => (
                            <Tab key={i} label={isMobile ? g.substring(0, 3) : g} sx={{ fontWeight: 'bold', minWidth: isMobile ? 60 : 100 }} />
                        ))}
                    </Tabs>
                </Paper>
            )}
            <Box sx={{ mt: 2 }}>{renderContent()}</Box>
            {/* 1. DIALOG DI CONFERMA */}
            <Dialog
                open={confirmDialog.open}
                onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
                PaperProps={{ sx: { borderRadius: 5, p: 1 } }}
            >
                <DialogTitle sx={{ fontWeight: '900' }}>Confermi l'azione?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Segnando come risolta la lezione di <b>{confirmDialog.item?.studentName}</b>,
                        la risposta verrà rimossa definitivamente dal database.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })} sx={{ fontWeight: 'bold' }}>
                        Annulla
                    </Button>
                    <Button
                        onClick={handleResolveFeedback}
                        variant="contained"
                        color="success"
                        sx={{ borderRadius: 3, fontWeight: 'bold', px: 3 }}
                    >
                        Sì, Risolto
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 2. SNACKBAR SUCCESSO */}
            <Snackbar
                open={notification.open}
                autoHideDuration={4000}
                onClose={() => setNotification({ ...notification, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={notification.severity} variant="filled" sx={{ borderRadius: 3, width: '100%' }}>
                    {notification.message}
                </Alert>
            </Snackbar>

            {/* 3. DIALOG ERRORE */}
            <Dialog open={errorDialog.open} onClose={() => setErrorDialog({ ...errorDialog, open: false })}>
                <DialogTitle sx={{ fontWeight: '900', color: 'error.main' }}>Attenzione</DialogTitle>
                <DialogContent><Typography variant="body2">{errorDialog.message}</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={() => setErrorDialog({ ...errorDialog, open: false })} fontWeight="bold">Chiudi</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}