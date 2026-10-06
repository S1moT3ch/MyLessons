export const CLIENT_ID = "379683469811-hs18j22vq9rnqvvl4a6kq0mvi8aenkao.apps.googleusercontent.com";
export const APPS_SCRIPT_URL = "https://mylessons-backend.vercel.app/api";

// Cache Time-To-Live impostato a 15 secondi per proteggere le quote API e garantire freschezza
export const CACHE_TTL_MS = 15 * 1000;

export const setCache = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        localStorage.setItem(`${key}_timestamp`, Date.now().toString());
    } catch (e) {
        console.warn("Errore salvataggio cache:", e);
    }
};

export const getCache = (key, defaultValue = null) => {
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

export const isCacheValid = (key, maxAge = CACHE_TTL_MS) => {
    try {
        const val = localStorage.getItem(key);
        if (!val) return false;
        const ts = localStorage.getItem(`${key}_timestamp`);
        if (!ts) return false;
        return (Date.now() - parseInt(ts, 10)) < maxAge;
    } catch (e) {
        return false;
    }
};

export const invalidateCache = (key) => {
    try {
        localStorage.removeItem(`${key}_timestamp`);
    } catch (e) { }
};

export const clearAllCache = () => {
    try {
        const keys = [
            'cache_subscribers', 'cache_feedbacks', 'cache_absences',
            'cache_schedules', 'cache_ai_suggestions'
        ];
        keys.forEach(k => {
            localStorage.removeItem(k);
            localStorage.removeItem(`${k}_timestamp`);
        });
    } catch (e) { }
};

// --- CANALE DI SINCRONIZZAZIONE ISTANTANEA TRA SCHEDE E FINESTRE (BROADCASTCHANNEL) ---
const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('mylessons_realtime_sync')
    : null;

export const broadcastSync = (type, payload = {}) => {
    if (type === 'FEEDBACK_UPDATED') {
        invalidateCache('cache_feedbacks');
        invalidateCache('cache_absences');
    } else if (type === 'SCHEDULE_UPDATED') {
        invalidateCache('cache_schedules');
    } else {
        clearAllCache();
    }

    if (syncChannel) {
        try {
            syncChannel.postMessage({ type, payload, timestamp: Date.now() });
        } catch (e) { }
    }
};

export const onSync = (callback) => {
    if (!syncChannel) return () => {};
    const handler = (event) => {
        if (event && event.data) {
            callback(event.data);
        }
    };
    syncChannel.addEventListener('message', handler);
    return () => {
        try { syncChannel.removeEventListener('message', handler); } catch (e) {}
    };
};
