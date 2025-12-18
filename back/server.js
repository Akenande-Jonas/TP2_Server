// back/server.js
// ==========================
// Chargement des dépendances
// ==========================
const path = require('path');
require('dotenv').config({ path: __dirname + '/.env' });             
const bodyParser = require('body-parser');
const express = require("express");      
const mysql = require("mysql2");         
const cors = require("cors");            
const bcrypt = require("bcrypt");        
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Création de l'application Express
const app = express();
const PORT = process.env.PORT || 2864;   
const SECRET_KEY = process.env.JWT_SECRET_KEY;

// ==========================
// Middleware & Connexion BDD
// ==========================
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '../front')));

const bddConnexion = mysql.createPool({
  host: process.env.DB_HOST,       
  user: process.env.DB_USER,       
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME     
}).promise();

// Vérifier la connexion à la base de données
bddConnexion.getConnection()
  .then(() => console.log('✅ Connexion à la base de données réussie'))
  .catch(err => console.error('❌ Erreur de connexion à la BDD:', err));

// Générateur de token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Middleware de vérification du token
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Token manquant' });
    }
    
    const user = database.users.find(u => u.token === token);
    
    if (!user) {
        return res.status(403).json({ message: 'Token invalide' });
    }
    
    req.user = user;
    next();
}

// Parser de trame GPS
function parseTrame(trameText) {
    // Format GPGGA: $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47
    if (trameText.includes('$GPGGA')) {
        const parts = trameText.split(',');
        if (parts.length >= 6) {
            const latRaw = parts[2];
            const latDir = parts[3];
            const lonRaw = parts[4];
            const lonDir = parts[5];
            
            // Convertir DDMM.MMMM en DD.DDDDDD
            const lat = convertToDecimal(latRaw, latDir);
            const lon = convertToDecimal(lonRaw, lonDir);
            
            return { latitude: lat, longitude: lon };
        }
    } 
    // Format simple: latitude,longitude
    else if (trameText.includes(',')) {
        const parts = trameText.split(',');
        if (parts.length >= 2) {
            return {
                latitude: parts[0].trim(),
                longitude: parts[1].trim()
            };
        }
    }
    
    return null;
}

// Convertir les coordonnées NMEA en décimal
function convertToDecimal(coord, direction) {
    if (!coord) return '0.000000';
    
    const dotIndex = coord.indexOf('.');
    if (dotIndex === -1) return '0.000000';
    
    const degrees = parseFloat(coord.substring(0, dotIndex - 2));
    const minutes = parseFloat(coord.substring(dotIndex - 2));
    let decimal = degrees + (minutes / 60);
    
    if (direction === 'S' || direction === 'W') {
        decimal *= -1;
    }
    
    return decimal.toFixed(6);
}

// Routes API

// Login
app.post('/api/login', (req, res) => {
    const { mail, mdp } = req.body;
    
    const user = database.users.find(u => u.mail === mail && u.mdp === mdp);
    
    if (!user) {
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Générer un nouveau token
    const token = generateToken();
    user.token = token;
    
    // Ne pas renvoyer le mot de passe
    const { mdp: _, ...userWithoutPassword } = user;
    
    res.json({ 
        message: 'Connexion réussie',
        token,
        user: userWithoutPassword
    });
});

// Vérification du token
app.post('/api/verify-token', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const { userId } = req.body;
    
    if (!token) {
        return res.status(401).json({ message: 'Token manquant' });
    }
    
    const user = database.users.find(u => u.id === userId && u.token === token);
    
    if (!user) {
        return res.status(403).json({ message: 'Token invalide' });
    }
    
    const { mdp: _, ...userWithoutPassword } = user;
    
    res.json({ 
        message: 'Token valide',
        user: userWithoutPassword
    });
});

// Logout
app.post('/api/logout', verifyToken, (req, res) => {
    req.user.token = null;
    res.json({ message: 'Déconnexion réussie' });
});

// Récupérer les trames de l'utilisateur
app.get('/api/trames', verifyToken, (req, res) => {
    const userAffichages = database.affichages.filter(a => a.idUser === req.user.id);
    const userTrames = userAffichages
        .map(aff => database.trames.find(t => t.id === aff.idTrame))
        .filter(Boolean);
    
    res.json({ trames: userTrames });
});

// Ajouter une nouvelle trame
app.post('/api/trames', verifyToken, (req, res) => {
    const { trame } = req.body;
    
    if (!trame) {
        return res.status(400).json({ message: 'Trame manquante' });
    }
    
    // Parser la trame
    const parsed = parseTrame(trame);
    
    if (!parsed) {
        return res.status(400).json({ message: 'Format de trame invalide' });
    }
    
    // Créer une nouvelle trame
    const newTrame = {
        id: database.trames.length + 1,
        textebrute: trame,
        horaire: new Date().toISOString(),
        latitude: parsed.latitude,
        longitude: parsed.longitude
    };
    
    database.trames.push(newTrame);
    
    // Créer un affichage pour l'utilisateur
    const newAffichage = {
        id: database.affichages.length + 1,
        idUser: req.user.id,
        idTrame: newTrame.id,
        retour: `GPS: ${parsed.latitude}, ${parsed.longitude}`
    };
    
    database.affichages.push(newAffichage);
    
    res.status(201).json({ 
        message: 'Trame ajoutée avec succès',
        trame: newTrame
    });
});

// Route de test
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        message: 'Serveur GPS Tracker opérationnel',
        timestamp: new Date().toISOString()
    });
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur GPS Tracker démarré sur http://localhost:${PORT}`);
    console.log(`📡 API disponible sur http://localhost:${PORT}/LowranceHAM/front/  `);
});