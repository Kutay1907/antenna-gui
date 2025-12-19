/**
 * Repository for LocalStorage access.
 */
export class StorageRepository {
    constructor(prefix = 'ag_bp_') {
        this.prefix = prefix;
    }

    save(key, data) {
        try {
            const json = JSON.stringify(data);
            localStorage.setItem(this.prefix + key, json);
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    }

    load(key) {
        try {
            const json = localStorage.getItem(this.prefix + key);
            return json ? JSON.parse(json) : null;
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            return null;
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(this.prefix + key);
        } catch (e) {
            console.error('Failed to remove from localStorage:', e);
        }
    }

    clearAll() {
        try {
            // Only clear items with our prefix
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.error('Failed to clear localStorage:', e);
        }
    }
}
