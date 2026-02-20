/**************************************************************************
 * pokequiz command
 
 This file implements the /pokequiz command.
 It starts a game of pokequiz, logic is defined in the dedicated file 
 (src/pokequiz.js).

 // TODO : Make better hints ?
 *************************************************************************/

const { SlashCommandBuilder, ChatInputCommandInteraction, InteractionContextType, MessageFlags } = require('discord.js');
const difficulties = require('../../../config/gamedifficulty.json');
const { createPokeQuiz } = require('../../pokequiz.js');
const { GameAccessibility } = require('../../enums.js');

/*
* NEEDED BOT PERMISSIONS
* pokeparty : [SendMessages, SendMessagesInThreads, ManageMessages, EmbedLinks, ViewChannel, AddReactions]
*/

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pokequiz')
        .setDescription('Jouer au PokéQuiz !')
        .addStringOption(option =>
            option.setName('access')
                .setDescription('Définir l\'accessibilité aux autres joueurs (publique par défaut)')
                .addChoices(
                    {name: 'Privée', value: GameAccessibility.PRIVATE},
                    {name: 'Publique', value: GameAccessibility.PUBLIC}
                )
                .setRequired(false)
        )
        .addIntegerOption(option =>
			option.setName('generation')
				.setDescription('Limiter l\'aléatoire à une génération en particulier')
				.setMaxValue(9)
				.setMinValue(1)
		)
        .addStringOption(option =>
            option.setName('difficulty')
                .setDescription('Niveau de difficulté')
                .addChoices(
                    {name: difficulties.easy.name, value: 'easy'},
                    {name: difficulties.medium.name, value: 'medium'},
                    {name: difficulties.hard.name, value: 'hard'},
                    {name: difficulties.extreme.name, value: 'extreme'},
                    {name: difficulties.impossible.name, value: 'impossible'}
                )
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('joueur2')
                .setDescription('Mentionne le joueur que tu veux ajouter')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('joueur3')
                .setDescription('Mentionne le joueur que tu veux ajouter')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('joueur4')
                .setDescription('Mentionne le joueur que tu veux ajouter')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('joueur5')
                .setDescription('Mentionne le joueur que tu veux ajouter')
                .setRequired(false)
        )
        .setContexts([
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel,
            InteractionContextType.BotDM
        ])
    ,

    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(interaction) {

        const interactionReply = await interaction.reply({
            content: "Création du lobby en cours...",
            flags: MessageFlags.Ephemeral,
            withResponse: true
        });

        const access = interaction.options.getString('access') ?? GameAccessibility.PUBLIC;
        const generation = interaction.options.getInteger('generation') ?? 0;
        const difficulty = interaction.options.getString('difficulty') ?? 'easy';
        
        const host = interaction.user;

        const isPrivate = (access === GameAccessibility.PRIVATE);

        const message = interactionReply.resource?.message;

        createPokeQuiz(message, host, generation, isPrivate, difficulty);
    }
}

