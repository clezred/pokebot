CREATE TABLE news_channels (
    guild_id VARCHAR(25) NOT NULL,
    channel_id VARCHAR(25) NOT NULL,
    since TIMESTAMP NOT NULL,
    PRIMARY KEY (guild_id, channel_id)
);

CREATE TABLE role_reactions (
    id SERIAL PRIMARY KEY,
    message_id TEXT NOT NULL UNIQUE,
    guild_id TEXT NOT NULL,         -- Si diffusion sur plusieurs serveurs
    channel_id TEXT NOT NULL,
    reactions_roles JSONB NOT NULL,  -- Utilisation de JSONB pour stocker des données JSON
    max_reactions INTEGER NOT NULL,  -- 1 pour unique, len(reactions) pour all, ou personnalisé
    created_at TIMESTAMP NOT NULL    -- Utilisation de TIMESTAMP pour les dates
);

CREATE TABLE given_role_reactions (
    id SERIAL PRIMARY KEY,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,     -- Si diffusion sur plusieurs serveurs
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    given_at TIMESTAMP NOT NULL
);

CREATE TABLE members_pokemons (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,         -- Si diffusion sur plusieurs serveurs
    pokemon_id INTEGER NOT NULL,
    is_shiny BOOLEAN NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE commands_status (
    command_name TEXT PRIMARY KEY,
    is_enabled BOOLEAN NOT NULL,
    reason TEXT,
    updated_at TIMESTAMP NOT NULL
);

-- Insertion des statuts de commandes par défaut (toutes activées)
INSERT INTO commands_status (command_name, is_enabled, reason, updated_at) VALUES
    ('pokequiz', TRUE, NULL, NOW()),
    ('pokeparty', TRUE, NULL, NOW()),
    ('pokeloto', TRUE, NULL, NOW()),
    ('team', TRUE, NULL, NOW()),
    ('pokedex', TRUE, NULL, NOW()),
    ('support', TRUE, NULL, NOW()),
    ('help', TRUE, NULL, NOW()),
    ('rolereact', TRUE, NULL, NOW()),
    ('me', TRUE, NULL, NOW()),
    ('publish', TRUE, NULL, NOW()),
    ('news-channel', TRUE, NULL, NOW());