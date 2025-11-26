require('dotenv').config();

const env = process.env.NODE_ENV || 'production';
const isTest = env === 'test';

/**
 * Load the appropriate ids.json based on environment
 */
function loadIds() {
    const idsPath = isTest 
        ? '../config/ids.test.json' 
        : '../config/ids.json';
    
    try {
        return require(idsPath);
    } catch (error) {
        console.warn(`Could not load ${idsPath}, using default ids.json`);
        return require('../config/ids.json');
    }
}

const config = {
    // Environment
    env,
    isTest,
    isProduction: env === 'production',
    isDevelopment: env === 'development',

    // Discord
    token: process.env.TOKEN,
    
    // Database
    db: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        name: process.env.DB_NAME,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
    },

    // IDs (Discord channels, roles, etc.)
    ids: loadIds(),

    // Other configs
    gen: require('../config/genpkid.json'),
    types: require('../config/types.json'),
    gameDifficulty: require('../config/gamedifficulty.json'),
    pkmGames: require('../config/pkmgames.json'),
    pkmNamesLocales: require('../config/pkmnameslocales.json'),
};

module.exports = config;
