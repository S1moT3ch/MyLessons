import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, CircularProgress, IconButton,
    Card, Stack, Paper, Divider, useMediaQuery, useTheme,
    ToggleButton, ToggleButtonGroup, Tab, Tabs
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    CheckCircle as ConfirmIcon,
    CalendarMonth as CalendarIcon,
    Cancel as CancelIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

export default function TeacherFeedbackPage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [loading, setLoading] = useState(true);
    const [feedbackList, setFeedbackList] = useState([]);
    const [fullSchedule, setFullSchedule] = useState([]);

    // Filtri: 'today', 'specific', 'all'
    const [viewFilter, setViewFilter] = useState('today');
    const [selectedDay, setSelectedDay] = useState(new Date().toLocaleDateString('it-IT', { weekday: 'long' }).charAt(0).toUpperCase() + new Date().toLocaleDateString('it-IT', { weekday: 'long' }).slice(1));

    const giorniSettimana = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    const fetchData = useCallback(async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return navigate('/login');
        const session = JSON.parse(sessionStr);
        const teacherFullName = `${session.given_name} ${session.family_name}`;

        setLoading(true);
        try {
            // 1. Recuperiamo i feedback (le risposte)
            const resFb = await fetch(`${APPS_SCRIPT_URL}?action=getTeacherFeedbackSummary&teacherName=${encodeURIComponent(teacherFullName)}&token=${session.id_token}`);
            const resultFb = await resFb.json();

            // 2. Recuperiamo l'orario completo del docente (azione che già usi nella SchedulePage)
            const resSched = await fetch(`${APPS_SCRIPT_URL}?action=getStudentSchedules&teacherName=${encodeURIComponent(teacherFullName)}&token=${session.id_token}`);
            const resultSched = await resSched.json();

            if (resultFb.status === "success") setFeedbackList(resultFb.data);
            if (resultSched.status === "success") setFullSchedule(resultSched.data);

        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Sostituisci la funzione renderFeedbackCard con questa versione ottimizzata
    const renderFeedbackCard = (item, idx) => {
        const occupante = getOccupantAt(item.preferenza);
        const isAssente = item.status === "Assente";

        return (
            <Card key={idx} elevation={0} sx={{
                borderRadius: 4,
                border: '1px solid',
                borderColor: isAssente ? '#ffebee' : '#f0f0f0',
                bgcolor: 'white',
                mb: 2,
                overflow: 'hidden',
                boxShadow: isAssente ? '0 4px 12px rgba(244, 67, 54, 0.05)' : 'none'
            }}>
                {/* Indicatore colorato laterale */}
                <Box sx={{ display: 'flex' }}>
                    <Box sx={{ width: 6, bgcolor: isAssente ? '#f44336' : '#4caf50' }} />

                    <Box sx={{ p: 2, flexGrow: 1 }}>
                        {/* Header Card: Orario e Stato */}
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                            <Box>
                                <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1, color: '#2c3e50' }}>
                                    {item.ora.slice(0, 2)}:{item.ora.slice(2)}
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

                        {/* Sezione Proposta Studente (Mobile Optimized) */}
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

                        {/* Note dello studente */}
                        {item.note && (
                            <Box sx={{
                                p: 1.5, bgcolor: '#f1f3f5', borderRadius: '12px 12px 12px 4px',
                                position: 'relative'
                            }}>
                                <Typography variant="body2" sx={{
                                    color: '#495057', fontSize: '0.85rem', fontStyle: 'italic',
                                    lineHeight: 1.4
                                }}>
                                    "{item.note}"
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Card>
        );
    };

    const getOccupantAt = (preferenzaString) => {
        if (!preferenzaString || !fullSchedule.length) return null;

        // 1. Pulizia della stringa (es: "Lunedì 15.30" o "Lunedì 15:30")
        // Usiamo una regex per separare il giorno dall'ora
        const match = preferenzaString.match(/^([a-zA-Zàèìòù]+)\s+(\d{2})[:.](\d{2})$/i);

        if (!match) return null;

        const giornoPref = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        const oraFormattata = `${match[2]}:${match[3]}`; // La portiamo a formato "HH:mm"

        // 2. Cerchiamo nello schedule se esiste quello slot ed è occupato
        const slotTrovato = fullSchedule.find(s =>
            s.giorno === giornoPref && s.ora === oraFormattata
        );

        // 3. Restituiamo i nomi degli studenti se presenti
        if (slotTrovato && slotTrovato.students && slotTrovato.students.length > 0) {
            return slotTrovato.students.map(st => st.nome).join(", ");
        }

        return null;
    };

    const renderContent = () => {
        if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

        let displayData = [];
        if (viewFilter === 'today' || viewFilter === 'specific') {
            const targetDay = viewFilter === 'today' ? selectedDay : selectedDay;
            displayData = feedbackList.filter(f => f.giorno === targetDay).sort((a, b) => a.ora.localeCompare(b.ora));

            return (
                <Stack spacing={1.5}>
                    {displayData.length > 0 ? (
                        displayData.map((item, idx) => renderFeedbackCard(item, idx))
                    ) : (
                        <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mt: 4 }}>
                            Nessuna risposta per {targetDay}
                        </Typography>
                    )}
                </Stack>
            );
        }

        // Vista Settimana Intera
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

            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" fontWeight="900">Risposte</Typography>
                </Stack>

                <ToggleButtonGroup
                    value={viewFilter}
                    exclusive
                    onChange={(e, val) => val && setViewFilter(val)}
                    size="small"
                    color="primary"
                    sx={{ bgcolor: 'white' }}
                >
                    <ToggleButton value="specific" sx={{ px: 2, fontWeight: 'bold' }}>Giorno</ToggleButton>
                    <ToggleButton value="all" sx={{ px: 2, fontWeight: 'bold' }}>Settimana</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {/* Selettore Giorno (mostrato solo se 'specific' o 'today') */}
            {viewFilter !== 'all' && (
                <Paper elevation={0} sx={{ mb: 3, borderRadius: 4, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
                    <Tabs
                        value={giorniSettimana.indexOf(selectedDay)}
                        onChange={(e, val) => {
                            setSelectedDay(giorniSettimana[val]);
                            if(viewFilter === 'today') setViewFilter('specific');
                        }}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{ bgcolor: 'white' }}
                    >
                        {giorniSettimana.map((g, i) => (
                            <Tab key={i} label={isMobile ? g.substring(0, 3) : g} sx={{ fontWeight: 'bold', minWidth: isMobile ? 60 : 100 }} />
                        ))}
                    </Tabs>
                </Paper>
            )}

            <Box sx={{ mt: 2 }}>
                {renderContent()}
            </Box>
        </Box>
    );
}