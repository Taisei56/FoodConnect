// Authentication utilities
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.profile = JSON.parse(localStorage.getItem('profile') || 'null');
        this.initializeAuth();
    }

    initializeAuth() {
        if (this.token && this.user) {
            this.updateUI();
            this.validateToken();
        }
    }

    async validateToken() {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                this.logout();
                return false;
            }

            const data = await response.json();
            this.user = data.user;
            this.profile = data.profile;
            localStorage.setItem('user', JSON.stringify(this.user));
            localStorage.setItem('profile', JSON.stringify(this.profile));
            this.updateUI();
            return true;
        } catch (error) {
            console.error('Token validation failed:', error);
            this.logout();
            return false;
        }
    }

    updateUI() {
        const userMenu = document.getElementById('user-menu');
        const authLinks = document.getElementById('auth-links');
        const registerLink = document.getElementById('register-link');
        const userName = document.getElementById('user-name');

        if (this.token && this.user) {
            if (userMenu) userMenu.style.display = 'block';
            if (authLinks) authLinks.style.display = 'none';
            if (registerLink) registerLink.style.display = 'none';
            if (userName) userName.textContent = this.user.email.split('@')[0];
        } else {
            if (userMenu) userMenu.style.display = 'none';
            if (authLinks) authLinks.style.display = 'block';
            if (registerLink) registerLink.style.display = 'block';
        }
    }

    login(token, user, profile = null) {
        this.token = token;
        this.user = user;
        this.profile = profile;
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        if (profile) {
            localStorage.setItem('profile', JSON.stringify(profile));
        }
        
        this.updateUI();
    }

    logout() {
        this.token = null;
        this.user = null;
        this.profile = null;
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('profile');
        
        this.updateUI();
        
        // Redirect to home page
        if (window.location.pathname !== '/') {
            window.location.href = '/';
        }
    }

    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    isRestaurant() {
        return this.user && this.user.user_type === 'restaurant';
    }

    isInfluencer() {
        return this.user && this.user.user_type === 'influencer';
    }

    getAuthHeaders() {
        return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
    }

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login';
            return false;
        }
        return true;
    }

    requireRole(role) {
        if (!this.requireAuth()) return false;
        
        if (this.user.user_type !== role) {
            this.showAlert('Access denied. You do not have permission to access this page.', 'danger');
            return false;
        }
        return true;
    }

    showAlert(message, type = 'info', duration = 5000) {
        const alertContainer = document.getElementById('alert-container') || this.createAlertContainer();
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        alertContainer.appendChild(alertDiv);
        
        // Auto-dismiss after duration
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, duration);
    }

    createAlertContainer() {
        const container = document.createElement('div');
        container.id = 'alert-container';
        container.className = 'position-fixed top-0 end-0 p-3';
        container.style.zIndex = '1050';
        document.body.appendChild(container);
        return container;
    }
}

// Global auth manager instance
const authManager = new AuthManager();

// Global logout function
function logout() {
    authManager.logout();
}

// Utility functions for making authenticated requests
async function apiRequest(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...authManager.getAuthHeaders(),
            ...options.headers
        }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (response.status === 401) {
        authManager.logout();
        throw new Error('Authentication required');
    }

    return response;
}

async function apiGet(url) {
    return await apiRequest(url);
}

async function apiPost(url, data) {
    return await apiRequest(url, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function apiPut(url, data) {
    return await apiRequest(url, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function apiDelete(url) {
    return await apiRequest(url, {
        method: 'DELETE'
    });
}

// Form data helper for file uploads
async function apiPostFormData(url, formData) {
    const headers = authManager.getAuthHeaders();
    // Don't set Content-Type for FormData, let browser set it with boundary
    
    return await fetch(url, {
        method: 'POST',
        headers,
        body: formData
    });
}

async function apiPutFormData(url, formData) {
    const headers = authManager.getAuthHeaders();
    
    return await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
    });
}

// Export for use in other scripts
window.authManager = authManager;
window.apiRequest = apiRequest;
window.apiGet = apiGet;
window.apiPost = apiPost;
window.apiPut = apiPut;
window.apiDelete = apiDelete;
window.apiPostFormData = apiPostFormData;
window.apiPutFormData = apiPutFormData;