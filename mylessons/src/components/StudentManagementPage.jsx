import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Avatar, Chip,
    CircularProgress, IconButton, Stack, TextField, InputAdornment,
    useMediaQuery, useTheme, Divider, Dialog, DialogTitle,
    DialogContent, DialogActions, Button
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import PaidIcon from '@mui/icons-material/Paid';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

export default function StudentsManagementPage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [loading, setLoading] = useState(true);
    const [studentsData, setStudentsData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Stato per la gestione dell'incasso
    const [payDialog, setPayDialog] = useState({ open: false, student: null, amountPaid: 1 });
    const [isSaving, setIsSaving] = useState(false);

    const fetchData = useCallback(async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return navigate('/login');
        const session = JSON.parse(sessionStr);

        setLoading(true);
        try {
            const [resSubs, resSched] = await Promise.all([
                fetch(`${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${session.sub}&token=${session.id_token}`),
                fetch(`${APPS_SCRIPT_URL}?action=getStudentSchedules&token=${session.id_token}`)
            ]);

            const dataSubs = await resSubs.json();
            const dataSched = await resSched.json();

            if (dataSubs.status === "success" && dataSched.status === "success") {
                const consolidated = dataSubs.data.map(student => {
                    const lessonCount = dataSched.data.filter(
                        slot => slot.email.toLowerCase().trim() === student.studentEmail.toLowerCase().trim()
                    ).length;

                    return { ...student, lessonCount };
                });
                setStudentsData(consolidated);
            }
        } catch (error) {
            console.error("Errore caricamento dati:", error);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleConfirmPayment = async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr || !payDialog.student) return;
        const session = JSON.parse(sessionStr);

        // LOGICA SOTTRAZIONE: Calcoliamo il nuovo debito
        const currentDebt = payDialog.student.lezioniDaPagare;
        const newDebtValue = Math.max(0, currentDebt - payDialog.amountPaid);

        setIsSaving(true);
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({
                    action: "updatePaidLessons",
                    id_token: session.id_token,
                    teacherId: session.sub,
                    studentEmail: payDialog.student.studentEmail,
                    newPaidValue: newDebtValue
                })
            });

            const resultText = await response.text();
            if (resultText.includes("Success")) {
                setStudentsData(prev => prev.map(s =>
                    s.studentEmail === payDialog.student.studentEmail
                        ? { ...s, lezioniDaPagare: newDebtValue }
                        : s
                ));
                setPayDialog({ open: false, student: null, amountPaid: 1 });
            }
        } catch (e) {
            console.error("Errore salvataggio:", e);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredStudents = studentsData.filter(s =>
        s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- SOTTO-COMPONENTE MOBILE CARD ---
    const MobileCard = ({ student }) => (
        <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, border: '1px solid #eee', bgcolor: 'white' }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 'bold' }}>{student.studentName.charAt(0)}</Avatar>
                <Box sx={{ overflow: 'hidden' }}>
                    <Typography variant="subtitle1" fontWeight="700" noWrap>{student.studentName}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">{student.studentEmail}</Typography>
                </Box>
            </Stack>
            <Divider sx={{ mb: 2, borderStyle: 'dashed' }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                    <Typography variant="caption" color="text.disabled" display="block">AGENDA</Typography>
                    <Chip label={`${student.lessonCount} sett.`} size="small" variant="outlined" color="primary" sx={{ fontWeight: 'bold' }} />
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.disabled" display="block">SVOLTE</Typography>
                    <Typography variant="body2" fontWeight="700">{student.lezioniSvolte}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.disabled" display="block">DA PAGARE</Typography>
                    <Chip
                        icon={student.lezioniDaPagare === 0 ? <CheckCircleIcon /> : <PaidIcon />}
                        label={student.lezioniDaPagare}
                        size="small"
                        onClick={() => setPayDialog({ open: true, student, amountPaid: student.lezioniDaPagare || 1 })}
                        color={student.lezioniDaPagare > 0 ? "error" : "success"}
                        sx={{ fontWeight: '900', cursor: 'pointer' }}
                    />
                </Box>
            </Stack>
        </Paper>
    );

    return (
        <Box sx={{ p: isMobile ? 2 : 4, maxWidth: 1100, mx: 'auto', bgcolor: isMobile ? '#f8f9fa' : 'transparent', minHeight: '100vh' }}>
            {/* Header */}
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'white', boxShadow: 1 }}><ArrowBackIcon /></IconButton>
                <Typography variant={isMobile ? "h6" : "h5"} fontWeight="800">Anagrafica Studenti</Typography>
            </Stack>

            <TextField
                fullWidth
                placeholder="Cerca studente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ mb: 3, bgcolor: 'white' }}
                InputProps={{
                    startAdornment: (<InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>),
                    style: { borderRadius: 12 }
                }}
            />

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>
            ) : isMobile ? (
                <Box>{filteredStudents.map((s, i) => <MobileCard key={i} student={s} />)}</Box>
            ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 4, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>Studente</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Agenda (Sett.)</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Svolte (Tot.)</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Da Pagare</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Iscrizione</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredStudents.map((student, index) => (
                                <TableRow key={index} hover>
                                    <TableCell>
                                        <Stack direction="row" spacing={2} alignItems="center">
                                            <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 'bold', width: 40, height: 40 }}>{student.studentName.charAt(0)}</Avatar>
                                            <Box><Typography variant="body1" fontWeight="700">{student.studentName}</Typography><Typography variant="caption" color="text.secondary">{student.studentEmail}</Typography></Box>
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="center"><Chip label={student.lessonCount} size="small" color="primary" variant="outlined" sx={{ fontWeight: 'bold' }} /></TableCell>
                                    <TableCell align="center"><Stack direction="row" spacing={1} justifyContent="center" alignItems="center"><HistoryEduIcon sx={{ fontSize: 18, color: 'text.disabled' }} /><Typography variant="body1" fontWeight="600">{student.lezioniSvolte}</Typography></Stack></TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            icon={student.lezioniDaPagare === 0 ? <CheckCircleIcon /> : <PaidIcon />}
                                            label={student.lezioniDaPagare}
                                            onClick={() => setPayDialog({ open: true, student, amountPaid: student.lezioniDaPagare || 1 })}
                                            color={student.lezioniDaPagare > 0 ? "error" : "success"}
                                            sx={{ fontWeight: '800', minWidth: 70, cursor: 'pointer' }}
                                        />
                                    </TableCell>
                                    <TableCell align="right"><Typography variant="body2" color="text.secondary">{new Date(student.date).toLocaleDateString()}</Typography></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* DIALOG INCASSO SOTTRATTIVO */}
            <Dialog open={payDialog.open} onClose={() => !isSaving && setPayDialog({ ...payDialog, open: false })} fullWidth maxWidth="xs">
                <DialogTitle sx={{ fontWeight: 'bold' }}>Registra Pagamento</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>Studente: <b>{payDialog.student?.studentName}</b></Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>Debito attuale: <b>{payDialog.student?.lezioniDaPagare}</b> lezioni</Typography>
                    <TextField
                        fullWidth
                        type="number"
                        label="Lezioni pagate adesso"
                        value={payDialog.amountPaid}
                        onChange={(e) => setPayDialog({ ...payDialog, amountPaid: parseInt(e.target.value) || 0 })}
                        inputProps={{ min: 1 }}
                        autoFocus
                        error={(payDialog.student?.lezioniDaPagare - payDialog.amountPaid) < 0}
                        helperText={(payDialog.student?.lezioniDaPagare - payDialog.amountPaid) >= 0
                            ? `Residuo dopo l'incasso: ${payDialog.student.lezioniDaPagare - payDialog.amountPaid}`
                            : "Il pagamento inserito è superiore al debito!"}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setPayDialog({ ...payDialog, open: false })} disabled={isSaving}>Annulla</Button>
                    <Button
                        onClick={handleConfirmPayment}
                        variant="contained"
                        color="success"
                        disabled={isSaving || (payDialog.student?.lezioniDaPagare - payDialog.amountPaid) < 0}
                        startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <PaidIcon />}
                    >
                        Conferma Incasso
                    </Button>
                </DialogActions>
            </Dialog>

            {!loading && filteredStudents.length === 0 && (
                <Typography sx={{ textAlign: 'center', mt: 4 }} color="text.secondary">Nessun risultato trovato.</Typography>
            )}
        </Box>
    );
}