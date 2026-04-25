import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Typography, Paper, Grid, CircularProgress, IconButton,
    Stack, Avatar,
    Fade
} from '@mui/material';
import {
    ArrowBackIosNew as ArrowBackIcon,
    TrendingUp as TrendingUpIcon,
    AccountBalanceWallet as WalletIcon,
    Savings as SavingsIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    InfoOutlined as InfoIcon,
    AccountBalance as BankIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

export default function FinancialDashboard() {
    const navigate = useNavigate();

    // --- LOGICA DI CACHE: Recupero immediato ---
    const [studentsData, setStudentsData] = useState(() => {
        const saved = localStorage.getItem('cache_subscribers');
        return saved ? JSON.parse(saved) : [];
    });

    // Se abbiamo dati in cache, non mostriamo lo spinner (loading = false)
    const [loading, setLoading] = useState(studentsData.length === 0);

    const [showGlobalPrivacy, setShowGlobalPrivacy] = useState(false);
    const [visibleStudentEmail, setVisibleStudentEmail] = useState(null);

    const fetchData = useCallback(async (isSilent = false) => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return navigate('/login');
        const session = JSON.parse(sessionStr);

        // Se è "silent", non attiviamo lo spinner principale
        if (!isSilent) setLoading(true);

        try {
            const response = await fetch(`${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${session.sub}&token=${session.id_token}`);
            const result = await response.json();

            if (result.status === "success") {
                setStudentsData(result.data);
                // Aggiorniamo la cache globale usata anche da Anagrafica Studenti
                localStorage.setItem('cache_subscribers', JSON.stringify(result.data));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        // Se abbiamo già dati (dalla dashboard o login), carichiamo in background
        const hasCache = studentsData && studentsData.length > 0;
        fetchData(hasCache);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchData]);

    const stats = useMemo(() => {
        return studentsData.reduce((acc, s) => {
            const rate = Number(s.tariffa) || 0;
            const svolte = Number(s.lezioniSvolte) || 0;
            const daPagare = Number(s.lezioniDaPagare) || 0;
            const earned = svolte * rate;
            const pending = daPagare * rate;
            const collected = earned - pending;

            acc.collected += collected;
            acc.pending += pending;
            acc.potential += earned;
            return acc;
        }, { collected: 0, pending: 0, potential: 0 });
    }, [studentsData]);

    const formatMoney = (amount, isGlobal = true, studentEmail = null) => {
        const isHidden = isGlobal ? !showGlobalPrivacy : (visibleStudentEmail !== studentEmail && !showGlobalPrivacy);
        if (isHidden) return "••••";
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    if (loading && studentsData.length === 0) return (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 2 }}>
            <CircularProgress size={40} thickness={4} />
            <Typography variant="caption" color="text.secondary" fontWeight="700">CALCOLO BILANCIO...</Typography>
        </Box>
    );

    return (
        <Box sx={{ p: 2, maxWidth: 500, mx: 'auto', bgcolor: '#fdfdfd', minHeight: '100vh', pb: 10 }}>

            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3, pt: 1 }}>
                <IconButton
                    onClick={() => navigate(-1)}
                    sx={{ bgcolor: 'white', border: '1px solid #eee', borderRadius: 3, p: 1 }}
                >
                    <ArrowBackIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <Typography variant="subtitle1" fontWeight="900">Incassi</Typography>
                <IconButton
                    onClick={() => setShowGlobalPrivacy(!showGlobalPrivacy)}
                    sx={{ bgcolor: showGlobalPrivacy ? 'primary.light' : 'white', border: '1px solid #eee', borderRadius: 3, color: showGlobalPrivacy ? 'primary.main' : 'text.primary' }}
                >
                    {showGlobalPrivacy ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
            </Stack>

            {/* Wallet Card */}
            <Paper
                elevation={0}
                sx={{
                    p: 3, borderRadius: 6, bgcolor: 'primary.main', color: 'white', mb: 3,
                    boxShadow: '0 10px 25px rgba(25, 118, 210, 0.25)', position: 'relative', overflow: 'hidden'
                }}
            >
                <BankIcon sx={{ position: 'absolute', right: -10, top: -10, fontSize: 120, opacity: 0.1 }} />
                <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Totale Incassato
                </Typography>
                <Typography variant="h3" fontWeight="900" sx={{ my: 1 }}>
                    {formatMoney(stats.collected, true)}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    <TrendingUpIcon sx={{ fontSize: 18 }} />
                    <Typography variant="caption" fontWeight="600">Performance aggiornata</Typography>
                </Stack>
            </Paper>

            {/* Grid Stats */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={6}>
                    <StatBox title="In Attesa" value={stats.pending} icon={<WalletIcon />} color="error" />
                </Grid>
                <Grid item xs={6}>
                    <StatBox title="Potenziale" value={stats.potential} icon={<SavingsIcon />} color="info" />
                </Grid>
            </Grid>

            {/* Sezione Studenti */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, px: 1 }}>
                <Typography variant="subtitle1" fontWeight="900">Dettaglio per Studente</Typography>
                <InfoIcon sx={{ fontSize: 18, color: '#ccc' }} />
            </Stack>

            <Stack spacing={1.5}>
                {studentsData.map((student, index) => {
                    const rate = Number(student.tariffa) || 0;
                    const debt = (Number(student.lezioniDaPagare) || 0) * rate;
                    const paid = (Number(student.lezioniSvolte) || 0) * rate - debt;
                    const isVisible = visibleStudentEmail === student.studentEmail || showGlobalPrivacy;

                    return (
                        <Fade in={true} timeout={300 + (index * 100)} key={index}>
                            <Paper
                                elevation={0}
                                onClick={() => setVisibleStudentEmail(isVisible ? null : student.studentEmail)}
                                sx={{
                                    p: 2, borderRadius: 5, border: '1px solid #f0f0f0', bgcolor: 'white',
                                    transition: 'all 0.2s ease', '&:active': { transform: 'scale(0.97)', bgcolor: '#fafafa' }
                                }}
                            >
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Avatar
                                        variant="rounded"
                                        sx={{ bgcolor: '#f5f7fa', color: 'primary.main', width: 45, height: 45, borderRadius: 3, fontWeight: 800 }}
                                    >
                                        {student.studentName?.charAt(0)}
                                    </Avatar>
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="body2" fontWeight="800" sx={{ color: '#2c3e50' }}>
                                            {student.studentName}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" fontWeight="600">
                                            {student.lezioniSvolte} lez. • {rate}€/h
                                        </Typography>
                                    </Box>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="body2" fontWeight="900" color="primary.main">
                                            {formatMoney(paid, false, student.studentEmail)}
                                        </Typography>
                                        {debt > 0 && (
                                            <Typography variant="caption" fontWeight="800" color="error.main" sx={{ display: 'block' }}>
                                                -{formatMoney(debt, false, student.studentEmail)}
                                            </Typography>
                                        )}
                                    </Box>
                                </Stack>
                            </Paper>
                        </Fade>
                    );
                })}
            </Stack>

            {/* Info Bar */}
            <Box sx={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 400 }}>
                <Paper elevation={10} sx={{ p: 1.5, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', textAlign: 'center', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <Typography variant="caption" fontWeight="700" color="text.secondary">
                        Tocca una riga per mostrare i dettagli del singolo studente
                    </Typography>
                </Paper>
            </Box>
        </Box>
    );

    function StatBox({ title, value, icon, color }) {
        return (
            <Paper elevation={0} sx={{ p: 2, borderRadius: 5, border: '1px solid #f0f0f0', bgcolor: 'white', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar variant="rounded" sx={{ bgcolor: `${color}.light`, color: `${color}.main`, width: 32, height: 32, borderRadius: 2 }}>
                        {React.cloneElement(icon, { sx: { fontSize: 18 } })}
                    </Avatar>
                    <Typography variant="caption" fontWeight="800" color="text.secondary">{title}</Typography>
                </Stack>
                <Typography variant="h6" fontWeight="900">
                    {formatMoney(value, true)}
                </Typography>
            </Paper>
        );
    }
}