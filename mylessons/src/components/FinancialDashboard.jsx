import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Typography, Paper, Grid, CircularProgress, IconButton,
    Stack, useMediaQuery, useTheme, Card, CardContent, Avatar,
    Button, Tooltip
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    TrendingUp as TrendingUpIcon,
    AccountBalanceWallet as WalletIcon,
    Savings as SavingsIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Person as PersonIcon,
    InfoOutlined as InfoIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

export default function FinancialDashboard() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [loading, setLoading] = useState(true);
    const [studentsData, setStudentsData] = useState([]);
    const [showGlobalPrivacy, setShowGlobalPrivacy] = useState(false);
    const [visibleStudentEmail, setVisibleStudentEmail] = useState(null);

    const fetchData = useCallback(async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return navigate('/login');
        const session = JSON.parse(sessionStr);

        setLoading(true);
        try {
            const response = await fetch(`${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${session.sub}&token=${session.id_token}`);
            const result = await response.json();
            if (result.status === "success") setStudentsData(result.data);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, [navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Calcoli aggregati con useMemo per performance
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
        const isHidden = isGlobal ? !showGlobalPrivacy : visibleStudentEmail !== studentEmail;
        if (isHidden) return "•••€";
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
        </Box>
    );

    return (
        <Box sx={{ p: isMobile ? 2 : 4, maxWidth: 900, mx: 'auto', bgcolor: isMobile ? '#f8f9fa' : 'transparent', minHeight: '100vh', pb: 12 }}>

            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'white', boxShadow: 1, width: 35, height: 35 }}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="h6" fontWeight="900">Resoconto Finanziario</Typography>
                </Stack>
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={showGlobalPrivacy ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    onClick={() => setShowGlobalPrivacy(!showGlobalPrivacy)}
                    sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                    {isMobile ? "" : (showGlobalPrivacy ? "Nascondi totali" : "Mostra totali")}
                </Button>
            </Stack>

            {/* Riepilogo Cards */}
            <Grid container spacing={2} sx={{ mb: 5 }}>
                <Grid item xs={12} sm={4}>
                    <StatCard title="Incassato" value={stats.collected} icon={<SavingsIcon color="success" />} bgcolor="#e8f5e9" border="#c8e6c9" />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <StatCard title="Da Riscuotere" value={stats.pending} icon={<WalletIcon color="error" />} bgcolor="#ffebee" border="#ffcdd2" />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <StatCard title="Lavoro Totale" value={stats.potential} icon={<TrendingUpIcon color="primary" />} bgcolor="#e3f2fd" border="#bbdefb" />
                </Grid>
            </Grid>

            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, ml: 1 }}>
                <Typography variant="subtitle1" fontWeight="800">Dettaglio Studenti</Typography>
                <Tooltip title="Clicca su un importo per vederlo">
                    <InfoIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                </Tooltip>
            </Stack>

            {/* Lista Studenti */}
            <Stack spacing={2}>
                {studentsData.map((student, index) => {
                    const rate = Number(student.tariffa) || 0;
                    const debt = (Number(student.lezioniDaPagare) || 0) * rate;
                    const paid = (Number(student.lezioniSvolte) || 0) * rate - debt;
                    const isVisible = visibleStudentEmail === student.studentEmail;

                    return (
                        <Paper
                            key={index}
                            elevation={0}
                            onClick={() => setVisibleStudentEmail(isVisible ? null : student.studentEmail)}
                            sx={{
                                p: 2,
                                borderRadius: 4,
                                border: '1px solid #eee',
                                cursor: 'pointer',
                                transition: '0.2s',
                                '&:active': { bgcolor: '#f0f0f0', transform: 'scale(0.98)' }
                            }}
                        >
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 40, height: 40 }}>
                                    <PersonIcon />
                                </Avatar>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="subtitle2" fontWeight="800">{student.studentName}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Tariffa: <b>{rate}€</b> • Svolte: <b>{student.lezioniSvolte}</b>
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Typography variant="body2" fontWeight="800" color="success.main">
                                        {formatMoney(paid, false, student.studentEmail)}
                                    </Typography>
                                    {debt > 0 ? (
                                        <Typography variant="caption" fontWeight="bold" color="error.main">
                                            -{formatMoney(debt, false, student.studentEmail)}
                                        </Typography>
                                    ) : (
                                        <Typography variant="caption" fontWeight="bold" color="success.main">Saldato</Typography>
                                    )}
                                </Box>
                            </Stack>
                        </Paper>
                    );
                })}
            </Stack>

            {/* Footer Informativo Mobile */}
            {isMobile && (
                <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 2, borderRadius: '24px 24px 0 0', bgcolor: 'white', borderTop: '1px solid #eee' }}>
                    <Typography variant="caption" color="text.disabled" textAlign="center" display="block">
                        Tocca uno studente per svelare i suoi conti privati.
                    </Typography>
                </Paper>
            )}
        </Box>
    );

    function StatCard({ title, value, icon, bgcolor, border }) {
        return (
            <Card elevation={0} sx={{ borderRadius: 4, bgcolor, border: `1px solid ${border}`, height: '100%' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {title}
                            </Typography>
                            <Typography variant="h5" fontWeight="900">
                                {formatMoney(value, true)}
                            </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            {icon}
                        </Avatar>
                    </Stack>
                </CardContent>
            </Card>
        );
    }
}