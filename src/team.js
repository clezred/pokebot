const { EmbedBuilder, Collection, AttachmentBuilder } = require("discord.js");
const { getPokemonSpecies, subRequest } = require("./pokeapi-utils");
const { random } = require("./utils");
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const colors = require('../config/colors.json');


/**
 * Generates an image from Pokemon team data
 * @param {Array} pokemons - Array of pokemon data
 * @param {Collection} pkmNames - Collection of pokemon names
 * @param {Collection} pkmTypes - Collection of pokemon types
 * @returns {Promise<Buffer>} Image buffer
 */
async function generateTeamImage(pokemons, pkmNames, pkmTypes) {
    const canvas = createCanvas(1200, 600);
    const ctx = canvas.getContext('2d');

    // Load background image
    try {
        const backgroundPath = path.join(__dirname, '../assets/png/team-background.png');
        const background = await loadImage(backgroundPath);
        ctx.drawImage(background, 0, 0, 1200, 600);
    } catch (error) {
        console.warn('Background image not found, using solid color');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1200, 600);
    }

    // Card positions (à ajuster selon votre image de fond)
    const cards = [
        { x: 30, y: 30 },
        { x: 410, y: 30 },
        { x: 790, y: 30 },
        { x: 30, y: 310 },
        { x: 410, y: 310 },
        { x: 790, y: 310 }
    ];

    const spriteSize = 140;
    const nameY = 185; // Position Y du nom (relatif à la carte)
    const typesY = 220; // Position Y des types (relatif à la carte)

    for (let i = 0; i < pokemons.length; i++) {
        const pkm = pokemons[i];
        const { x, y } = cards[i];

        // Draw pokemon sprite
        try {
            const image = await loadImage(pkm.sprites.front_default);
            ctx.drawImage(image, x + (360 - spriteSize) / 2, y + 15, spriteSize, spriteSize);
        } catch (error) {
            console.error('Failed to load sprite:', error);
        }

        // Draw pokemon name
        ctx.fillStyle = '#333';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const name = pkmNames.get(pkm.name);
        
        const nameWithoutEmoji = name.replace('✨', '');
        const hasShiny = name.includes('✨');
        
        ctx.fillText(nameWithoutEmoji, x + 180, y + nameY);
        
        // Draw star if shiny
        if (hasShiny) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '20px sans-serif';
            const textWidth = ctx.measureText(nameWithoutEmoji).width;
            ctx.fillText('★', x + 180 + textWidth / 2 + 10, y + nameY);
        }

        // Draw types
        ctx.fillStyle = '#666';
        ctx.font = '16px sans-serif';
        const types = pkmTypes.get(pkm.name);
        ctx.fillText(types, x + 180, y + typesY);
    }

    return canvas.toBuffer('image/png');
}

/**
 * Generates a Discord embed representing a Pokémon team
 * @param {number[]} pkIDs Array of 6 Pokémon IDs
 * @returns {Promise<EmbedBuilder | undefined>} Discord embed of the team
 */
async function team(pkIDs) {

    if (pkIDs.length != 6) return;
    
    const pokemons = [];
    for (const id of pkIDs) {
        const pkmSpecies = await getPokemonSpecies(id);
        // Get a random variety of the Pokémon species (such as different forms)
        const pkm = await subRequest(pkmSpecies.varieties[random(0, pkmSpecies.varieties.length - 1)].pokemon.url);
        pokemons.push(pkm);
    }

    const pkmTypes = new Collection();
    for (const pkm of pokemons) {
        const types = [];
        for (const type of pkm.types) {
            if (!types.includes(type.type.name)) {
                const pkmtype = await subRequest(type.type.url)
                types.push(pkmtype.names.find(n => n.language.name === 'fr').name);
            }
        }
        pkmTypes.set(pkm.name, types.join(' | '));
    }
    
    const pkmNames = new Collection();
    for (const pkm of pokemons) {
        // Determine if the Pokémon is shiny (1 in 4096 chance)
        const is_shiny = (random(1, 4096) === 1);

        if (pkm.is_default) {
            const species = await subRequest(pkm.species.url);
            pkmNames.set(pkm.name, species.names.find(n => n.language.name === 'fr').name + (is_shiny ? '✨' : ''));
        } else {
            // Check if forms array exists and has elements
            if (pkm.forms && pkm.forms.length > 0) {
                const form = await subRequest(pkm.forms[random(0, pkm.forms.length - 1)].url);
                pkmNames.set(pkm.name, form.names.find(n => n.language.name === 'fr').name + (is_shiny ? '✨' : ''));
            } else {
                // Fallback to species name if no forms available
                const species = await subRequest(pkm.species.url);
                pkmNames.set(pkm.name, species.names.find(n => n.language.name === 'fr').name + (is_shiny ? '✨' : ''));
            }
        }
    }

    // Generate image
    const imageBuffer = await generateTeamImage(pokemons, pkmNames, pkmTypes);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'team.png' });

    const embed = new EmbedBuilder()
        .setAuthor({ name: "Équipe de " })
        .setColor(colors.primary)
        .setImage('attachment://team.png');
    
    return { embed, attachment };
}

module.exports = { team };