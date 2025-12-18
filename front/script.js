// Configuration de l'API
const API_URL = 'http://localhost:2864/api';

// État global de l'application
let currentUser = null;
let gpsData = [];

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
    
    // Gestion de la touche Entrée sur les champs de login
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
    
    document.getElementById('loginEmail').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
});

// Vérifier si l'utilisateur est déjà connecté
async function checkAuthentication() {
    const token = sessionStorage.getItem('userToken');
    const userId = sessionStorage.getItem('userId');
    
    if (token && userId) {
        try {
            const response = await fetch(`${API_URL}/verify-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId: parseInt(userId) })
            });
            
            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                showDashboard();
                loadUserData();
            } else {
                logout();
            }
        } catch (error) {
            console.error('Erreur de vérification du token:', error);
            logout();
        }
    }
}

// Connexion
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    errorDiv.style.display = 'none';
    
    if (!email || !password) {
        showError(errorDiv, 'Veuillez remplir tous les champs');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mail: email, mdp: password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            sessionStorage.setItem('userToken', data.token);
            sessionStorage.setItem('userId', data.user.id);
            
            showDashboard();
            loadUserData();
        } else {
            showError(errorDiv, data.message || 'Email ou mot de passe incorrect');
        }
    } catch (error) {
        console.error('Erreur de connexion:', error);
        showError(errorDiv, 'Erreur de connexion au serveur');
    }
}

// Déconnexion
async function logout() {
    const token = sessionStorage.getItem('userToken');
    
    if (token) {
        try {
            await fetch(`${API_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
        }
    }
    
    sessionStorage.removeItem('userToken');
    sessionStorage.removeItem('userId');
    currentUser = null;
    gpsData = [];
    
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    
    // Réinitialiser le formulaire
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').style.display = 'none';
}

// Afficher le dashboard
function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    
    // Mettre à jour les informations utilisateur
    document.getElementById('userName').textContent = `${currentUser.prenom} ${currentUser.nom}`;
    document.getElementById('userEmail').textContent = currentUser.mail;
    document.getElementById('userStatus').textContent = currentUser.booladmin ? 'Administrateur' : 'Utilisateur';
    document.getElementById('userToken').textContent = sessionStorage.getItem('userToken').substring(0, 20) + '...';
}

// Charger les données de l'utilisateur
async function loadUserData() {
    const token = sessionStorage.getItem('userToken');
    
    try {
        const response = await fetch(`${API_URL}/trames`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            gpsData = data.trames;
            updateTable();
            updateStats();
        }
    } catch (error) {
        console.error('Erreur de chargement des données:', error);
    }
}

// Soumettre une nouvelle trame
async function submitTrame() {
    const trameInput = document.getElementById('trameInput').value.trim();
    const errorDiv = document.getElementById('trameError');
    const submitBtn = document.getElementById('submitBtn');
    
    errorDiv.style.display = 'none';
    
    if (!trameInput) {
        showError(errorDiv, 'Veuillez entrer une trame GPS');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Traitement...';
    
    try {
        const token = sessionStorage.getItem('userToken');
        const response = await fetch(`${API_URL}/trames`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ trame: trameInput })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            gpsData.push(data.trame);
            document.getElementById('trameInput').value = '';
            updateTable();
            updateStats();
        } else {
            showError(errorDiv, data.message || 'Format de trame invalide');
        }
    } catch (error) {
        console.error('Erreur d\'envoi de la trame:', error);
        showError(errorDiv, 'Erreur de connexion au serveur');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Convertir et enregistrer';
    }
}

// Mettre à jour le tableau
function updateTable() {
    const tbody = document.getElementById('gpsDataTable');
    
    if (gpsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    Aucune donnée GPS enregistrée. Envoyez votre première trame!
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = gpsData.map(data => `
        <tr>
            <td>${data.id}</td>
            <td>${formatDate(data.horaire)}</td>
            <td class="coord-text">${data.latitude}</td>
            <td class="coord-text">${data.longitude}</td>
            <td class="trame-text" title="${data.textebrute}">${data.textebrute}</td>
        </tr>
    `).join('');
}

// Mettre à jour les statistiques
function updateStats() {
    document.getElementById('trameCount').textContent = gpsData.length;
}

// Formater la date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Afficher un message d'erreur
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}