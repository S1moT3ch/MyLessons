import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Cookies from 'js-cookie';
import { Box } from "@mui/material";

import LoginPage from './components/LoginPage';
import DashboardInsegnante from './components/DashboardInsegnante';
import DashboardStudente from './components/DashboardStudente';
import SchedulePage from "./components/SchedulePage";
import StudentSchedulePage from "./components/StudentSchedulePage";
import StudentsManagementPage from "./components/StudentManagementPage";
import FinancialDashboard from "./components/FinancialDashboard";

// --- 1. HELPER SESSIONE ---
const getSession = () => {
    const sessionCookie = Cookies.get('user_session');
    if (!sessionCookie) return null;
    try {
        return JSON.parse(sessionCookie);
    } catch (e) {
        return null;
    }
};

// --- 2. PROTEZIONE RUOLI (Guardia di rotta) ---
const RoleBasedRoute = ({ allowedRole, children }) => {
    const session = getSession();

    // Se non c'è sessione, vai al login
    if (!session) return <Navigate to="/login" replace />;

    // Se il ruolo non è quello permesso, torna alla dashboard principale
    if (session.role !== allowedRole) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

// --- 3. LAYOUT PROTETTO ---
const DashboardLayout = () => {
    const session = getSession();

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
            <Outlet />
        </Box>
    );
};

// --- 4. COMPONENTI WRAPPER ---

// Home della Dashboard: smista tra Insegnante e Studente
const DashboardHome = () => {
    const session = getSession();
    if (!session) return <Navigate to="/login" replace />;

    return session.role === 'Insegnante'
        ? <DashboardInsegnante />
        : <DashboardStudente />;
};

// Agenda: smista tra Insegnante (Modifica) e Studente (Visualizzazione)
const SchedulePageWrapper = () => {
    const session = getSession();
    if (!session) return <Navigate to="/login" replace />;

    return session.role === 'Insegnante'
        ? <SchedulePage />
        : <StudentSchedulePage />;
};

// --- 5. COMPONENTE APP PRINCIPALE ---
function App() {
    return (
        <Router>
            <Routes>
                {/* Rotta Pubblica */}
                <Route path="/login" element={<LoginPage />} />

                {/* Rotte Protette */}
                <Route path="/dashboard" element={<DashboardLayout />}>

                    {/* Home della Dashboard (Accessibile a entrambi) */}
                    <Route index element={<DashboardHome />} />

                    {/* Gestione Agenda (Accessibile a entrambi, logica interna diversa) */}
                    <Route path="schedule" element={<SchedulePageWrapper />} />

                    {/* Gestione Studenti (SOLO INSEGNANTE) */}
                    <Route
                        path="students"
                        element={
                            <RoleBasedRoute allowedRole="Insegnante">
                                <StudentsManagementPage />
                            </RoleBasedRoute>
                        }
                    />
                    <Route
                        path="revenue"
                        element={
                            <RoleBasedRoute allowedRole="Insegnante">
                                <FinancialDashboard />
                            </RoleBasedRoute>
                        }
                    />
                </Route>

                {/* Redirect di fallback */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Router>
    );
}

export default App;