const API_URL = 'http://localhost:2864/api';

// État global de l'application
let currentUser = null;
let gpsData = [];
let map;
let markerLayer; // Pour grouper les marqueurs et les effacer facilement
let routePath; // Pour stocker la ligne qui relie les points

// On vérifie immédiatement si une session existe dans le navigateur
const savedUser = sessionStorage.getItem('currentUser');
const savedToken = sessionStorage.getItem('userToken');

if (savedUser && savedToken) {
    currentUser = JSON.parse(savedUser);
    // On attend que la page soit prête pour afficher le dashboard
    window.addEventListener('DOMContentLoaded', () => {
        showDashboard();
        loadUserData();
    });
}

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
        
        
        if (response.ok) {
            const data = await response.json();
            console.log("Données reçues du serveur :", data);

            if (data.user && data.token) {
                currentUser = data.user;
                sessionStorage.setItem('userToken', data.token);
                sessionStorage.setItem('userId', data.user.id);
                sessionStorage.setItem('currentUser', JSON.stringify(data.user));
                console.log("SessionStorage mis à jour !");
                showDashboard();
                loadUserData();
            } else {
                console.error("ERREUR : data.user est vide ! Vérifie ton server.js");
            }
        } else {
            showError(errorDiv, data.message || 'Email ou mot de passe incorrect');
        }
    } catch (error) {
        console.error('Erreur de connexion:', error);
        showError(errorDiv, 'Erreur de connexion au serveur');
    }
}


// Basculer entre Login et Register
function toggleAuth(isRegister) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const errorDiv = document.getElementById('loginError');
    const testInfo = document.getElementById('testAccountsInfo');

    errorDiv.style.display = 'none';
    
    if (isRegister) {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        testInfo.style.display = 'none';
        authTitle.textContent = "Inscription";
        authSubtitle.textContent = "Créez votre compte GPS Tracker";
    } else {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        testInfo.style.display = 'block';
        authTitle.textContent = "GPS Tracker";
        authSubtitle.textContent = "Connectez-vous pour accéder au système";
    }
}

// Fonction d'inscription
async function register() {
    const prenom = document.getElementById('regPrenom').value;
    const nom = document.getElementById('regNom').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const errorDiv = document.getElementById('loginError');

    errorDiv.style.display = 'none';

    if (!prenom || !nom || !email || !password) {
        showError(errorDiv, 'Veuillez remplir tous les champs');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prenom, nom, mail: email, mdp: password })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Compte créé avec succès ! Connectez-vous.');
            toggleAuth(false); // Retour au login
        } else {
            showError(errorDiv, data.message || "Erreur lors de l'inscription");
        }
    } catch (error) {
        console.error("Erreur d'inscription:", error);
        showError(errorDiv, 'Erreur de connexion au serveur');
    }
}

// Déconnexion
async function logout() {
    if (window.refreshInterval) clearInterval(window.refreshInterval);
    const token = sessionStorage.getItem('userToken');
    
    // 1. Prévenir le serveur (optionnel avec JWT mais plus propre)
    if (token) {
        try {
            await fetch(`${API_URL}/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Erreur déconnexion serveur:', error);
        }
    }
    
    // 2. Nettoyer TOUT le stockage local
    sessionStorage.clear(); 
    
    // 3. Réinitialiser les variables
    currentUser = null;
    gpsData = [];
    
    // 4. Rediriger proprement en rechargeant la page
    // Cela remet tout à zéro (Map, variables, formulaires)
    window.location.reload(); 
}

function startAutoRefresh() {
    // On vérifie s'il n'y a pas déjà un intervalle pour éviter les doublons
    if (window.refreshInterval) clearInterval(window.refreshInterval);

    window.refreshInterval = setInterval(() => {
        console.log("Actualisation des données...");
        loadUserData(); // Cette fonction appelle le serveur et updateMap()
    }, 5000); 
}

// Afficher le dashboard
function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    
    // Initialiser la carte si elle ne l'est pas déjà
    if (!map) {
        initMap();
        startAutoRefresh();
    }

    document.getElementById('userName').textContent = `${currentUser.prenom} ${currentUser.nom}`;
    document.getElementById('userEmail').textContent = currentUser.mail;
    document.getElementById('userStatus').textContent = currentUser.booladmin ? 'Administrateur' : 'Utilisateur';
    document.getElementById('userToken').textContent = sessionStorage.getItem('userToken').substring(0, 20) + '...';
    // Actualiser les données toutes les 5 secondes
    setInterval(() => {
        if (sessionStorage.getItem('userToken')) {
            loadUserData(); 
        }
    }, 5000);
}

//Initialiser la carte

function initMap() {
    // On centre par défaut sur la France
    map = L.map('map').setView([46.603354, 1.888334], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);
}

// updateMarkers sur la carte

function updateMap() {
    if (!markerLayer) return;

    markerLayer.clearLayers();
    if (routePath) map.removeLayer(routePath); // On enlève l'ancienne ligne

    if (gpsData.length === 0) return;

    // 1. Extraire les coordonnées dans l'ordre CHRONOLOGIQUE
    // Note: on fait un .reverse() car gpsData arrive souvent du plus récent au plus ancien
    const coords = [...gpsData]
        .reverse() 
        .map(data => [parseFloat(data.latitude), parseFloat(data.longitude)])
        .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

    // 2. Créer les marqueurs pour chaque point
    coords.forEach((coord, index) => {
        const isLast = index === coords.length - 1;
        const marker = L.circleMarker(coord, {
            radius: isLast ? 8 : 4, // Le dernier point est plus gros
            color: isLast ? 'red' : '#3388ff',
            fillOpacity: 0.8
        }).addTo(markerLayer);
    });

    // 3. Tracer la ligne (La Route)
    if (coords.length > 1) {
        routePath = L.polyline(coords, {
            color: 'blue',
            weight: 3,
            opacity: 0.6,
            dashArray: '5, 10' // Optionnel: ligne en pointillés pour un look "tracker"
        }).addTo(map);
    }

    // 4. Centrer la carte sur le dernier point reçu
    if (coords.length > 0) {
        map.panTo(coords[coords.length - 1]);
    }
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
            <td class="trame-text" title="${data.texteBrute}">${data.texteBrute}</td>
        </tr>
    `).join('');
    updateMap();
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

// Vérification automatique au chargement de la page
window.onload = () => {
    const savedToken = sessionStorage.getItem('userToken');
    const savedUser = sessionStorage.getItem('currentUser');

    if (savedToken && savedUser) {
        // On restaure les données globales
        currentUser = JSON.parse(savedUser);
        
        // On affiche le dashboard directement
        showDashboard();
        
        // On recharge les données depuis la BDD LOWRANCE
        loadUserData();
    }
};