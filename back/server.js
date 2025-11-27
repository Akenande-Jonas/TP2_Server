// back/server.js
// ==========================
// Chargement des dépendances
// ==========================
const path = require('path');
// Le chemin est configuré pour chercher .env dans le même dossier 'back'
require('dotenv').config({ path: __dirname + '/.env' });             
const bodyParser = require ('body-parser');
const express = require("express");      
const mysql = require("mysql2");         
const cors = require("cors");            
const bcrypt = require("bcrypt");        
const jwt = require('jsonwebtoken');

// Création de l'application Express
// C'est l'objet principal qui sert à définir les routes (app.get, app.post, etc.) et à démarrer le serveur.
const app = express();
const PORT = process.env.PORT || 2864;   
const SECRET_KEY = process.env.JWT_SECRET_KEY; // Clé secrète chargée depuis .env

// ==========================
// Middleware & Connexion BDD
// ==========================
app.use(express.json());  
app.use(cors());          

const bddConnexion = mysql.createPool({
  host: process.env.DB_HOST,       
  user: process.env.DB_USER,       
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME     
}).promise();
