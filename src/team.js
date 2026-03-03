const { EmbedBuilder, Collection, AttachmentBuilder } = require("discord.js");
const { getPokemonSpecies, subRequest } = require("./pokeapi-utils");
const { random } = require("./utils");
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const colors = require('../config/colors.json');

registerFont(path.join(__dirname, '../assets/fonts/pokemon-bw.otf'), { family: 'PokemonBW' });

/**
 * Generates an image from Pokemon team data
 * @param {Array} pokemons - Array of pokemon data
 * @param {Collection} pkmNames - Collection of pokemon names
 * @param {Collection} pkmTypes - Collection of pokemon types
 * @param {string} username - Username of the team owner
 * @returns {Promise<Buffer>} Image buffer
 */
async function generateTeamImage(pokemons, pkmNames, pkmTypes, username) {
    const canvasWidth = 600;
    const canvasHeight = 370;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Load background image
    try {
        const backgroundPath = path.join(__dirname, '../assets/images/team-background.png');
        const background = await loadImage(backgroundPath);
        ctx.drawImage(background, 0, 0, canvasWidth, canvasHeight);
    } catch (error) {
        console.warn('Background image not found, using solid color');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // positions
    // needs to be pixel perfect to fit the background
    const headerX = 20;
    const headerY = 7;
    const spriteColumn1 = 65;
    const spriteColumn2 = 360;
    const spriteLine1 = 105;
    const spriteLine2 = 200;
    const spriteLine3 = 295;
    const infosColumn1 = 278;
    const infosColumn2 = 573;
    const nameLine1 = 95;
    const nameLine2 = 192;
    const nameLine3 = 289;
    const typesLine1 = 119;
    const typesLine2 = 216;
    const typesLine3 = 313;
    const shinyIconColumn1 = 129;
    const shinyIconColumn2 = 423;
    const shinyIconLine1 = 121;
    const shinyIconLine2 = 218;
    const shinyIconLine3 = 315;
    const cards = [
        { spriteColumn: spriteColumn1, spriteLine: spriteLine1, infosColumn: infosColumn1, 
            nameLine: nameLine1, typesLine: typesLine1, shinyColumn: shinyIconColumn1, shinyLine: shinyIconLine1 },
        { spriteColumn: spriteColumn2, spriteLine: spriteLine1, infosColumn: infosColumn2, 
            nameLine: nameLine1, typesLine: typesLine1, shinyColumn: shinyIconColumn2, shinyLine: shinyIconLine1 },
        { spriteColumn: spriteColumn1, spriteLine: spriteLine2, infosColumn: infosColumn1, 
            nameLine: nameLine2, typesLine: typesLine2, shinyColumn: shinyIconColumn1, shinyLine: shinyIconLine2 },
        { spriteColumn: spriteColumn2, spriteLine: spriteLine2, infosColumn: infosColumn2, 
            nameLine: nameLine2, typesLine: typesLine2, shinyColumn: shinyIconColumn2, shinyLine: shinyIconLine2 },
        { spriteColumn: spriteColumn1, spriteLine: spriteLine3, infosColumn: infosColumn1, 
            nameLine: nameLine3, typesLine: typesLine3, shinyColumn: shinyIconColumn1, shinyLine: shinyIconLine3 },
        { spriteColumn: spriteColumn2, spriteLine: spriteLine3, infosColumn: infosColumn2, 
            nameLine: nameLine3, typesLine: typesLine3, shinyColumn: shinyIconColumn2, shinyLine: shinyIconLine3 }
    ];

    // Draw username
    let headerText = 'Équipe Pokémon';
    if (username) {
        headerText = `Équipe de ${username}`;
    }

    ctx.fillStyle = '#fafafaff';
    ctx.font = '32px "PokemonBW"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'black';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(headerText, headerX, headerY, 400);

    for (let i = 0; i < pokemons.length; i++) {
        const pkm = pokemons[i];
        const { spriteColumn, spriteLine, infosColumn, nameLine, typesLine, shinyColumn, shinyLine } = cards[i];

        // Draw pokemon sprite
        try {
            const image = await loadImage(pkm.sprites.front_default);
            ctx.shadowColor = 'black';
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.drawImage(image, spriteColumn - (image.width / 2), spriteLine - (image.height / 2), image.width, image.height);
        } catch (error) {
            console.error('Failed to load sprite:', error);
        }

        // Draw pokemon name
        ctx.fillStyle = '#fafafaff';
        ctx.font = '32px "PokemonBW"';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'black';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        const name = pkmNames.get(pkm.name);
        ctx.fillText(name, infosColumn, nameLine, 140);

        // Draw pokemon id
        const idString = `#${pkm.id.toString().padStart(4, '0')}`
        ctx.font = '16px "PokemonBW"';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(idString, infosColumn, typesLine - 1, 38);

        // Draw types icons
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        const types = pkmTypes.get(pkm.name).reverse();
        for (let j = 0; j < types.length; j++) {
            try {
                const typeIconPath = path.join(__dirname, `../assets/images/types_icons/fr/${types[j]}.png`);
                const typeIcon = await loadImage(typeIconPath);
                ctx.drawImage(typeIcon, infosColumn - ((j+1) * 38) - 32, typesLine, 32, 14);
            } catch (error) {
                console.error('Failed to load type icon:', error);
            }
        }

        // Draw shiny star if shiny
        if (pkm.pokebot_is_shiny) {
            try {
                const shinyIconPath = path.join(__dirname, `../assets/images/shiny_star.png`);
                const shinyIcon = await loadImage(shinyIconPath);
                ctx.drawImage(shinyIcon, shinyColumn, shinyLine, 14, 14);
            } catch (error) {
                console.error('Failed to load shiny icon:', error);
            }
        }
    }

    return canvas.toBuffer('image/png');
}

/**
 * Generates a Discord embed representing a Pokémon team
 * @param {number[]} pkIDs Array of 6 Pokémon IDs
 * @returns {Promise<EmbedBuilder | undefined>} Discord embed of the team
 */
async function team(pkIDs, username = null) {

    if (pkIDs.length != 6) return;
    
    const pokemons = [];
    for (const id of pkIDs) {
        const pkmSpecies = await getPokemonSpecies(id);
        // Get a random variety of the Pokémon species (such as different forms)
        const pkm = await subRequest(pkmSpecies.varieties[random(0, pkmSpecies.varieties.length - 1)].pokemon.url);
        pkm.id = id; // Ensure the id is the species id
        pokemons.push(pkm);
    }

    const pkmTypes = new Collection();
    for (const pkm of pokemons) {
        const types = [];
        for (const type of pkm.types) {
            if (!types.includes(type.type.name)) {
                const pkmtype = await subRequest(type.type.url)
                types.push(pkmtype.names.find(n => n.language.name === 'en').name.toLowerCase());
            }
        }
        pkmTypes.set(pkm.name, types);
    }
    
    const pkmNames = new Collection();
    for (const pkm of pokemons) {
        // Determine if the Pokémon is shiny (1 in 4096 chance)
        const is_shiny = (random(1, 4096) === 1);
        pkm.sprites.front_default = is_shiny && pkm.sprites.front_shiny ? pkm.sprites.front_shiny : pkm.sprites.front_default;
        pkm.pokebot_is_shiny = is_shiny; // Custom property to never overwrite original data if is_shiny is used

        if (pkm.is_default) {
            const species = await subRequest(pkm.species.url);
            pkmNames.set(pkm.name, species.names.find(n => n.language.name === 'fr').name);
        } else {
            // Check if forms array exists and has elements
            if (pkm.forms && pkm.forms.length > 0) {
                const form = await subRequest(pkm.forms[random(0, pkm.forms.length - 1)].url);
                pkmNames.set(pkm.name, form.names.find(n => n.language.name === 'fr').name);
            } else {
                // Fallback to species name if no forms available
                const species = await subRequest(pkm.species.url);
                pkmNames.set(pkm.name, species.names.find(n => n.language.name === 'fr').name);
            }
        }
    }

    // Generate image
    const imageBuffer = await generateTeamImage(pokemons, pkmNames, pkmTypes, username);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'team.png' });
    
    return { attachment };
}

module.exports = { team };