/**************************************************************************
 * pokedex command
 
 This file implements the logic behind the /pokedex command.
 It sends back an discord embed describing the pokemon the user entered.

 // TODO : change command name to "pokemon" (pokedex will be used for the 
 future catching and collecting system). Improve search options and display
 lists of pokemons (by type, category...). Visual improvements
 *************************************************************************/

const { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, InteractionContextType } = require('discord.js');
const { pokedexEmbed } = require('../../pokedex-utils.js');
const gen = require('../../../config/genpkid.json');
const { sendLogMessage } = require('../../discord-utils.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pokedex')
		.setDescription('Te donne des informations sur le Pokémon de ton choix !')
        .addIntegerOption(option => 
            option.setName('id')
                .setDescription('Numéro (id) du Pokémon')
                .setRequired(false)
                .setMaxValue(gen[0][1])
                .setMinValue(gen[0][0])
        )
        .addStringOption(option => 
            option.setName('nom')
                .setDescription('Nom du Pokémon')
                .setRequired(false)
                .setMaxLength(20)
                .setMinLength(1)
        )
        .setContexts([
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel,
            InteractionContextType.BotDM
        ])
    ,

    /**
     * Defines actions to do for this interaction
     * @param {ChatInputCommandInteraction} interaction - the interaction
     */
	async execute(interaction) {
        await interaction.deferReply();

        const id = interaction.options.getInteger('id');
        const pkmName = interaction.options.getString('nom');
        
        if (!id && !pkmName) {
            return interaction.editReply({content: 'Tu dois spécifier un numéro ou un nom de Pokémon !', ephemeral: true});
        }

        const pokemonId = id ? id : pkmName;

        const embed = await pokedexEmbed(pokemonId);

        if (!embed) {
            return interaction.editReply({content: 'Ce Pokémon n\'existe pas !', ephemeral: true});
        }

        await interaction.editReply({embeds: [embed]});

        sendLogMessage(`Command : \`pokedex\` | User : \`${interaction.user.username}\` | Pokemon : \`${embed.data.author.name}\` | ChannelType : \`${Object.keys(ChannelType).find(key => ChannelType[key] === interaction.channel.type)}\``);
	}
};
