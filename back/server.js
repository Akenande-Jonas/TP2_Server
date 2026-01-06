const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 2864;
const SECRET_KEY = 'votre_cle_secrete_super_secure';

// --- CONNEXION MYSQL ---
const bddConnexion = mysql.createPool({
    host: '172.29.17.171', // L'adresse de ton serveur MySQL
    user: 'lowrance', // Ton utilisateur
    password: 'test.html', // Ton mot de passe (souvent vide sur XAMPP)
    database: 'LOWRANCE' // Le nom de ta base
});

// --- MIDDLEWARE DE VÉRIFICATION ---
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Accès refusé' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Session expirée' });
        req.user = decoded;
        next();
    });
}

// --- FONCTION PARSEUR NMEA ---
function parseTrame(trame) {
    if (trame.includes('$GPGGA')) {
        const parts = trame.split(',');
        if (parts.length < 6) return null;
        
        let lat = parseFloat(parts[2]) / 100;
        let lon = parseFloat(parts[4]) / 100;
        if (parts[3] === 'S') lat = -lat;
        if (parts[5] === 'W') lon = -lon;
        
        return { latitude: lat.toFixed(6), longitude: lon.toFixed(6) };
    }
    // Si format simple "lat,lon"
    const simple = trame.split(',');
    if (simple.length === 2) {
        return { latitude: simple[0].trim(), longitude: simple[1].trim() };
    }
    return null;
}

// --- ROUTES ---

// 1. LOGIN
app.post('/api/login', async (req, res) => {
    const { mail, mdp } = req.body;
    try {
        const [rows] = await bddConnexion.execute('SELECT * FROM User WHERE mail = ?', [mail]);
        if (rows.length === 0) return res.status(401).json({ message: 'Utilisateur non trouvé' });

        const user = rows[0];
        const mdpValide = await bcrypt.compare(mdp, user.mdp);
        
        if (!mdpValide) return res.status(401).json({ message: 'Mot de passe incorrect' });

        const token = jwt.sign({ id: user.id, mail: user.mail }, SECRET_KEY, { expiresIn: '2h' });
        
        res.json({
            token,
            user: { id: user.id, nom: user.nom, prenom: user.prenom, mail: user.mail, booladmin: user.booladmin }
        });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// 2. RECUPERER LES TRAMES (Correction Erreur 500 GET)
app.get('/api/trames', verifyToken, async (req, res) => {
    try {
        // On récupère TOUTES les trames liées à l'utilisateur
        const [rows] = await bddConnexion.execute(
            `SELECT t.* FROM Trame t 
             JOIN Affichage a ON t.id = a.idTrame 
             WHERE a.idUser = ? 
             ORDER BY t.horaire ASC`, // ASC pour avoir l'ordre du trajet
            [req.user.id]
        );
        res.json({ trames: rows });
    } catch (err) {
        res.status(500).json({ message: "Erreur SQL" });
    }
});

// 3. ENVOYER UNE TRAME (Correction Erreur 500 POST)
app.post('/api/trames', verifyToken, async (req, res) => {
    const { trame } = req.body;
    const parsed = parseTrame(trame);

    if (!parsed) return res.status(400).json({ message: 'Trame invalide' });

    try {
        // Insertion dans Trame
        const [resTrame] = await bddConnexion.execute(
            'INSERT INTO Trame (textebrute, horaire, latitude, longitude) VALUES (?, NOW(), ?, ?)',
            [trame, parsed.latitude, parsed.longitude]
        );
        
        // Liaison dans Affichage
        await bddConnexion.execute(
            'INSERT INTO Affichage (idUser, idTrame, retour) VALUES (?, ?, ?)',
            [req.user.id, resTrame.insertId, `GPS: ${parsed.latitude},${parsed.longitude}`]
        );

        res.status(201).json({ message: 'Trame enregistrée', trame: { ...parsed, id: resTrame.insertId } });
    } catch (err) {
        res.status(500).json({ message: 'Erreur lors de l\'enregistrement' });
    }
});

app.listen(PORT, () => console.log(`Serveur prêt sur http://localhost:${PORT}`));