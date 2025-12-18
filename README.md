Le pull du projet recquiert l'installation des paquets suivant:
express mysql2 dotenv cors bcrypt jsonwebtoken

import React, { useState, useEffect } from 'react';
import { MapPin, Lock, LogOut, Activity, Navigation, Upload } from 'lucide-react';

const GPSTrackerApp = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ mail: '', mdp: '' });
  const [loginError, setLoginError] = useState('');
  const [gpsData, setGpsData] = useState([]);
  const [trameInput, setTrameInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Simuler une base de données en mémoire
  const [users] = useState([
    { 
      id: 1, 
      nom: 'Dupont', 
      prenom: 'Jean', 
      mail: 'jean.dupont@email.com', 
      mdp: 'password123',
      token: null,
      booladmin: 0
    },
    { 
      id: 2, 
      nom: 'Martin', 
      prenom: 'Marie', 
      mail: 'marie.martin@email.com', 
      mdp: 'secure456',
      token: null,
      booladmin: 1
    }
  ]);

  const [affichages, setAffichages] = useState([]);
  const [trames, setTrames] = useState([]);

  // Vérifier le token au chargement
  useEffect(() => {
    const storedToken = sessionStorage.getItem('userToken');
    const storedUserId = sessionStorage.getItem('userId');
    
    if (storedToken && storedUserId) {
      const user = users.find(u => u.id === parseInt(storedUserId));
      if (user && user.token === storedToken) {
        setCurrentUser(user);
        setIsAuthenticated(true);
        loadUserData(user.id);
      } else {
        logout();
      }
    }
  }, []);

  const generateToken = () => {
    return 'token_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  const login = () => {
    setLoginError('');

    const user = users.find(u => u.mail === loginForm.mail && u.mdp === loginForm.mdp);
    
    if (user) {
      const newToken = generateToken();
      user.token = newToken;
      
      sessionStorage.setItem('userToken', newToken);
      sessionStorage.setItem('userId', user.id.toString());
      
      setCurrentUser(user);
      setIsAuthenticated(true);
      loadUserData(user.id);
    } else {
      setLoginError('Email ou mot de passe incorrect');
    }
  };

  const logout = () => {
    if (currentUser) {
      currentUser.token = null;
    }
    sessionStorage.removeItem('userToken');
    sessionStorage.removeItem('userId');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setGpsData([]);
  };

  const loadUserData = (userId) => {
    const userAffichages = affichages.filter(a => a.idUser === userId);
    const userGpsData = userAffichages.map(aff => {
      const trame = trames.find(t => t.id === aff.idTrame);
      return trame;
    }).filter(Boolean);
    setGpsData(userGpsData);
  };

  const parseTrame = (trameText) => {
    // Format attendu: "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"
    // Ou format simplifié: "latitude,longitude"
    
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
    } else if (trameText.includes(',')) {
      const parts = trameText.split(',');
      if (parts.length >= 2) {
        return {
          latitude: parts[0].trim(),
          longitude: parts[1].trim()
        };
      }
    }
    
    return null;
  };

  const convertToDecimal = (coord, direction) => {
    if (!coord) return '0.000000';
    
    const degrees = parseFloat(coord.substring(0, coord.indexOf('.') - 2));
    const minutes = parseFloat(coord.substring(coord.indexOf('.') - 2));
    let decimal = degrees + (minutes / 60);
    
    if (direction === 'S' || direction === 'W') {
      decimal *= -1;
    }
    
    return decimal.toFixed(6);
  };

  const submitTrame = () => {
    setLoading(true);

    const parsed = parseTrame(trameInput);
    
    if (parsed) {
      const newTrame = {
        id: trames.length + 1,
        textebrute: trameInput,
        horaire: new Date().toISOString(),
        latitude: parsed.latitude,
        longitude: parsed.longitude
      };
      
      const newAffichage = {
        id: affichages.length + 1,
        idUser: currentUser.id,
        idTrame: newTrame.id,
        retour: `GPS: ${parsed.latitude}, ${parsed.longitude}`
      };
      
      setTrames([...trames, newTrame]);
      setAffichages([...affichages, newAffichage]);
      setGpsData([...gpsData, newTrame]);
      setTrameInput('');
      setLoginError('');
    } else {
      setLoginError('Format de trame invalide');
    }
    
    setLoading(false);
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  // Page de Login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">GPS Tracker</h1>
            <p className="text-gray-600 mt-2">Connectez-vous pour accéder au système</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={loginForm.mail}
                onChange={(e) => setLoginForm({...loginForm, mail: e.target.value})}
                onKeyPress={(e) => handleKeyPress(e, login)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                value={loginForm.mdp}
                onChange={(e) => setLoginForm({...loginForm, mdp: e.target.value})}
                onKeyPress={(e) => handleKeyPress(e, login)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <button
              onClick={login}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200 flex items-center justify-center space-x-2"
            >
              <Lock className="w-5 h-5" />
              <span>Se connecter</span>
            </button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm">
            <p className="font-semibold text-blue-800 mb-2">Comptes de test:</p>
            <p className="text-blue-700">jean.dupont@email.com / password123</p>
            <p className="text-blue-700">marie.martin@email.com / secure456</p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard principal
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">GPS Tracker</h1>
              <p className="text-sm text-gray-600">Système de géolocalisation</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">
                {currentUser.prenom} {currentUser.nom}
              </p>
              <p className="text-xs text-gray-500">{currentUser.mail}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Trames enregistrées</p>
                <p className="text-3xl font-bold text-blue-600">{gpsData.length}</p>
              </div>
              <Activity className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Token actif</p>
                <p className="text-xs font-mono text-green-600 truncate w-32">
                  {currentUser.token?.substring(0, 20)}...
                </p>
              </div>
              <Lock className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Statut</p>
                <p className="text-xl font-bold text-gray-800">
                  {currentUser.booladmin ? 'Administrateur' : 'Utilisateur'}
                </p>
              </div>
              <Navigation className="w-12 h-12 text-purple-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Envoyer une trame GPS
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trame GPS (format GPGGA ou latitude,longitude)
              </label>
              <textarea
                value={trameInput}
                onChange={(e) => setTrameInput(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                rows="3"
                placeholder="$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47&#10;ou&#10;48.1173,11.5167"
              />
            </div>
            
            <button
              onClick={submitTrame}
              disabled={loading || !trameInput}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50"
            >
              {loading ? 'Traitement...' : 'Convertir et enregistrer'}
            </button>
          </div>
        </div>

        {/* GPS Data Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">Données GPS enregistrées</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Heure</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latitude</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Longitude</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trame brute</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {gpsData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      Aucune donnée GPS enregistrée. Envoyez votre première trame!
                    </td>
                  </tr>
                ) : (
                  gpsData.map((data) => (
                    <tr key={data.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{data.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(data.horaire).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-blue-600">{data.latitude}</td>
                      <td className="px-6 py-4 text-sm font-mono text-blue-600">{data.longitude}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono truncate max-w-xs">
                        {data.textebrute}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GPSTrackerApp;