export const CACHE_DURATION = 1000 * 60 * 60; // 1 hour in milliseconds

export const getCachedData = (key) => {
    try {
        const cachedData = localStorage.getItem(key);
        if (cachedData) {
            const { timestamp, data } = JSON.parse(cachedData);
            if (Date.now() - timestamp <= CACHE_DURATION) {
                return data;
            }
        }
    } catch (error) {
        console.error('Error reading from cache:', error);
    }
    return null;
};

export const setCachedData = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify({
            timestamp: Date.now(),
            data
        }));
    } catch (error) {
        console.error('Error writing to cache:', error);
    }
};

export const clearCacheByPrefix = (prefix) => {
    try {
        Object.keys(localStorage)
            .filter(key => key.startsWith(prefix))
            .forEach(key => localStorage.removeItem(key));
    } catch (error) {
        console.error('Error clearing cache:', error);
    }
}; 