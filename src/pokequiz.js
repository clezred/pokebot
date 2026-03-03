/**************************************************************************
 * PokeQuiz (formerly known as PokeParty)
 
 This file implements game and lobby logic for PokeQuiz 
 
 Notice:
 Watch out for user actions processing in parallel. If bugs occur in strange
 situations, consider implementing a queue.

 // TODO : logs, JSDOC, test, gather constants
 // consider gathering answers with a Context Menu instead of a MessageCollector to avoid flood and allow more natural answers
 *************************************************************************/


const { Collection, User, MessageCollector, Message, TextBasedChannel, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType, MessageFlags, InteractionCollector, ButtonInteraction } = require("discord.js");
const { random, logWarn } = require('./utils.js');
const config = require('./config.js');
const { ids, gen } = config;
const difficulties = config.gameDifficulty;
const { latinize } = require('./latinize.js');
const { pokedexEmbed } = require('./pokedex-utils.js');
const { sendLogMessage } = require("./discord-utils.js");
const { getPokemonSpecies, subRequest } = require("./pokeapi-utils.js");
const { LobbyStatus, GameAccessibility, LobbyResponseCodes, JoinRequestStatus, GameStatus } = require("./enums.js");
const { getChannel } = require("./discord-client.js");

const LobbyResponses = {
    "-1": "Une erreur inattendue s'est produite, merci de réessayer.",
    "0": "Vous avez rejoint la partie.",
    "1": "Votre demande à bien été envoyée à l'hôte.",
    "2": "Vous êtes déjà dans la partie.",
    "3": "Vous êtes déjà dans une partie en cours sur le même salon.",
    "4": "Vous avez déjà demandé à rejoindre la partie. Merci de patienter.",
    "5": "Impossible de contacter l'hôte de la partie pour demander à rejoindre, ses DMs sont désactivés.",
    "6": "Action impossible, vous n'êtes pas un joueur de cette partie.",
    "7": "Pour une raison inconnue, nous n'avons pas pu vous faire quitter la partie. Merci de réessayer.",
    "8": "Pour une raison inconnue, nous n'avons pas pu vous faire rejoindre la partie. Merci de réessayer.",
    "9": "Votre requête a été acceptée par l'hôte, vous avez rejoint la partie !",
    "10": "Votre requête a été refusée par l'hôte.",
}

/**
 * Class representing the lobby for a PokeQuiz
 */
class Lobby {

    /**
     * Constructor for a PokeQuiz lobby
     * @param {User} host The user hosting the game
     * @param {Message} message The message where to start the lobby
     * @param {boolean} isPrivate Accessibility of the game
     * @param {string} difficulty Difficulty of the game
     */
    constructor(host, message, isPrivate, difficulty) {
        this.hostId = host.id;
        this.message = message;
        this.isPrivate = isPrivate;
        this.difficulty = difficulty;
        this.embed = new EmbedBuilder();
        this.buttons = new ActionRowBuilder();
        this.joinRequests = new Collection();
        this.players = new Collection();

        this.players.set(host.id, host);
        this.status = LobbyStatus.WAITING;
        this.init();
    }

    /**
     * Check if a player is in the lobby
     * @param {string} playerId The id of the player
     * @returns {boolean} True if player exists, false otherwise
     */
    hasPlayer(playerId) { return this.players.has(playerId) }

    /**
     * Get the player count
     * @returns {number} Player count
     */
    getPlayerCount() { return this.players.size }

    /**
     * Adds a player to the lobby
     * @param {User} player The player to add
     * @returns {boolean} True if the player is added, false otherwise
     */
    addPlayer(player) {
        // Check if game has started or is aborted
        if (this.status !== LobbyStatus.WAITING) return false;
        // Check if user is already a player
        if (this.hasPlayer(player.id)) return false;
        // Add player
        this.players.set(player.id, player);
        // refresh
        this.refreshLobbyMessage();
        return true;
    }

    /**
     * Removes a player from the lobby
     * @param {string} playerId 
     * @returns {boolean} True if successfully removed, false otherwise
     */
    removePlayer(playerId) {
        // Check if game has started or aborted
        if (this.status !== LobbyStatus.WAITING) return false;
        // Check if user is a player
        if (!this.hasPlayer(playerId)) return false;
        // Check if user is host
        this.players.delete(playerId);
        if (playerId === this.hostId) {
            // Check player count
            if (this.getPlayerCount() === 0) {
                // no more players
                this.status = LobbyStatus.ABORTED;
            } else {
                // randomly pass the ownership
                this.hostId = this.players.randomKey();
            }
        }
        // refresh
        this.refreshLobbyMessage();
        return true;
    }

    /**
     * Refreshes the Lobby message with fresh data
     */
    refreshLobbyMessage() {
        // Check if the message is set
        if (!this.message) return;
        // check if aborted
        if (this.status === LobbyStatus.ABORTED) {
            const abortEmbed = new EmbedBuilder()
                .setTitle("Partie abandonnée...")
                .setDescription("Ce message s'autodétruira dans 5 secondes.")
                .setColor(0xFF0000)
                .setTimestamp();
            
            this.message.edit({
                content: "",
                embeds: [abortEmbed],
                components: []
            });

            setTimeout(() => this.message.delete().catch((e) => console.log(e)), 5000); // 5 seconds
            return;
        }
        // Players
        this.embed.setFields([{
            name: "Liste des joueurs",
            value: this.players.map((player, id) => `<@${id}>`).join(' | ')
        }]);
        // Host
        this.embed.setFooter({
            text: `Hôte de la partie : ${this.players.get(this.hostId).username} | Accessibilité : ${this.isPrivate ? 'Privée' : 'Publique'}`
        });
        // Refresh
        this.message.edit({
            content: "", // empty content
            embeds: [this.embed],
            components: [this.buttons]
        });
    }

    /**
     * Removes a join request from the collection
     * Used when the request has ended or had a response
     * @param {string} userId The user's discord id
     */
    removeJoinRequest(userId) {
        if (this.joinRequests.has(userId))
            this.joinRequests.delete(userId);
    }

    /**
     * Initializes the class attributes
     */
    init() {
        // Setup embed
        this.embed
            .setTitle(`PokéQuiz du ${difficulties[this.difficulty].name}`)
            .setDescription(`Vous avez 5 minutes pour trouver le Pokémon correspondant à la description donnée. Que le meilleur gagne !\n_La partie commence <t:${Math.floor(Date.now() / 1000) + 300}:R>_`)
            .setColor(0x00FFFF) // yellow
        
        // Create buttons
        const joinButton = new ButtonBuilder()
            .setCustomId('join')
            .setLabel('Rejoindre la partie')
            .setStyle(ButtonStyle.Success);

        const leaveButton = new ButtonBuilder()
            .setCustomId('leave')
            .setLabel('Quitter la partie')
            .setStyle(ButtonStyle.Danger);
        
        const startButton = new ButtonBuilder()
            .setCustomId('start')
            .setLabel('Commencer')
            .setStyle(ButtonStyle.Primary);
        
        // adapt if lobby is private
        if (this.isPrivate) joinButton.setLabel('Demander à rejoindre');
        // add the buttons
        this.buttons.addComponents(joinButton, leaveButton, startButton);
        // refresh
        this.refreshLobbyMessage();
    }

    /**
     * Makes a user wants to join a lobby
     * @param {User} user The user who wants to join
     * @param {function} followUpCallback Sends response to user
     */
    join(user, followUpCallback) {
        // Already joined
        if (this.hasPlayer(user.id)) 
            return followUpCallback(LobbyResponseCodes.AlreadyJoined);
        // Already Playing in the same channel
        if (isPlaying(user.id, this.message.channel.id)) 
            return followUpCallback(LobbyResponseCodes.AlreadyPlaying);

        // Public access
        if (!this.isPrivate) { 
            // Add to the players in the lobby
            const success = this.addPlayer(user);
            // Double verification
            if (!success) return followUpCallback(LobbyResponseCodes.UnexpectedBehaviour);
            // Add to the players of this channel
            addPlayer(user.id, this.message.channel.id);
            // feedback to user
            return followUpCallback(LobbyResponseCodes.SuccessfulyJoined);
        }

        // Private access
        // Already asked to join
        if (this.joinRequests.has(user.id))
            return followUpCallback(LobbyResponseCodes.AlreadyAskedToJoin);
        // New joinRequest
        this.joinRequests.set(user.id, new JoinRequest(this, user, followUpCallback));
    }

    /**
     * Makes a player leave the lobby
     * @param {string} playerId The user that is leaving
     * @returns {boolean} True if player was removed, false otherwise
     */
    leave(playerId, followUpCallback) {
        // Not a player
        if (!this.hasPlayer(playerId)) 
            return followUpCallback(LobbyResponseCodes.NotAPlayer);
        // Remove player from lobby
        const removed = this.removePlayer(playerId);
        // Remove player from this channel's list
        if (removed)
            removePlayer(playerId, this.message.channel.id);
        else 
            return followUpCallback(LobbyResponseCodes.UnableToLeave);
    }

    /**
     * Starts the lobby
     * Called by the PokeQuiz class
     * @param {function} startGame The passed function to start game when ready
     */
    async start(startGameCallback) {
        if (!this.message) return;
        // Ensures no call to the method once game started
        if(this.status === LobbyStatus.STARTED) return;
        
        // Filter
        const lobbyMessageFilter = async button => {
            await button.deferUpdate(); // prevent button timeout
            return button.message.id === this.message.id;
        }

        // Create the button interaction collector
        const collector = this.message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: lobbyMessageFilter,
            time: 300_000 // 5min
        });

        // Button pressed
        collector.on('collect', async button => {
            // function used as callback to send feedback to user
            const followUp = (code) => button.followUp({
                content: LobbyResponses[code],
                flags: MessageFlags.Ephemeral
            })
            // differentiate buttons
            switch (button.customId) {
                case 'join':
                    this.join(button.user, followUp);
                    break;
                case 'leave':
                    this.leave(button.user.id, followUp);
                    break;
                case 'start':
                    if (button.user.id === this.hostId) collector.stop();
                    break;
                default:
                    followUp(LobbyResponseCodes.UnexpectedBehaviour);
            }
        });

        // Time ended / Start button pressed by host
        // Executed once
        collector.on('end', () => {
            // check if aborted
            if (this.status === LobbyStatus.ABORTED) return;
            // update status
            this.status = LobbyStatus.STARTED;
            // start game
            startGameCallback();
            // starting game message
            this.message.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Démarrage de la partie...")
                        .setColor(0x00FF00) // green
                ],
                components: []
            });
            // delete lobby message after 5 seconds
            setTimeout(() => this.message.delete(), 5_000) // 5 seconds
        });
    }
}

/**
 * Represents a join request
 */
class JoinRequest { // TODO: improve style (thumbnail?)

    /**
     * Constructor
     * @param {Lobby} lobby The associated lobby
     * @param {User} user  The user who wants to join
     * @param {function} callback The callback function
     */
    constructor(lobby, user, followUpCallback) {
        this.lobby = lobby;
        this.user = user;
        // -> lobby button collector -> button.followUp() ephemeral
        this.callback = followUpCallback; 
        this.status = JoinRequestStatus.WAITING;
        this.send();
    }

    /**
     * Gets the host from the lobby
     * @returns {User} The lobby's host
     */
    getHost() { return this.lobby.players.get(this.lobby.hostId) }

    /**
     * Gets the buttons for a join request message
     * @returns {ButtonBuilder[]} The buttons row
     */
    getButtons() {
        return new ActionRowBuilder()
            .addComponents([
            new ButtonBuilder()
                .setCustomId('yes')
                .setLabel('Accepter')
                .setStyle(ButtonStyle.Success)
            ,
            new ButtonBuilder()
                .setCustomId('no')
                .setLabel('Refuser')
                .setStyle(ButtonStyle.Danger)
        ]);
    }

    accept() {
        // update joinRequest status
        this.status = JoinRequestStatus.ACCEPTED;
        // joined another party
        if (isPlaying(this.user.id, this.lobby.message.channel.id)) {
            // edit request message
            this.requestMessage.edit({
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`**${this.user.username}** a rejoint une autre partie entre temps.`)
                        .setColor(0xFF00FF)
                ],
                components: []
            });
            // remove joinRequest
            this.lobby.removeJoinRequest(this.user.id);
            return; // nothing more to do here
        }
        // make the user join the game
        const success = this.lobby.addPlayer(this.user);
        // feedback to the player who asked
        if (success) this.callback(LobbyResponseCodes.RequestAccepted);
        else this.callback(LobbyResponseCodes.UnableToJoin)
        // add the player to the global list of players
        addPlayer(this.user.id, this.lobby.message.channel.id);
        // display confirmation
        this.requestMessage.edit({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`Vous avez accepté la demande de **${this.user.username}**.`)
                    .setColor(0x00FF00) // green
            ],
            components: []
        });
        // remove joinRequest
        this.lobby.removeJoinRequest(this.user.id);
    }

    refuse() {
        // update joinRequest status
        this.status = JoinRequestStatus.REFUSED;
        // feedback to user who asked
        this.callback(LobbyResponseCodes.RequestRefused);
        // feedback to host
        this.requestMessage.edit({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`Vous avez refusé la demande de **${this.user.username}**.`)
                    .setColor(0xFF0000) // red
            ],
            components: []
        });
        // remove joinRequest
        this.lobby.removeJoinRequest(this.user.id);
    }

    /**
     * Sends the joinRequest to the host and handles response
     */
    async send() {
        // prevent code execution in wrong situation
        if (this.status != JoinRequestStatus.WAITING) return;
        // get the host
        const host = this.getHost();
        // DM may throw an error
        try {
        // Create DM channel between bot and host
        await host.createDM(true);
        // Create buttons
        const buttons = this.getButtons();
        // Create message request
        this.requestMessage = await host.dmChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`**${this.user.username}** souhaite rejoindre votre partie !`)
                    .setColor(0xFF00FF) // violet
            ],
            components: [buttons]
        });
        // Confirm request was sent to user (button.followUp())
        await this.callback(LobbyResponseCodes.SuccessfulyAskedToJoin);
        // Collector filter
        const requestMessageCollectorFilter = async i => {
            await i.deferUpdate(); // prevent button timeout
            return i.user.id === host.id;
        };

        const requestMessageCollector = this.requestMessage.createMessageComponentCollector({
            filter: requestMessageCollectorFilter,
            componentType: ComponentType.Button,
            time: 30_000, // 30 seconds
            max: 1        // collects 1 button at most
        })

        requestMessageCollector.on('collect', async button => {
            switch (button.component.customId) {
            case ('yes'):
                this.accept();
                break;
            case ('no'):
                this.refuse();
                break;
            default:// impossible behaviour
                // update joinRequest status
                this.status = JoinRequestStatus.ERROR;
                // feedback to user
                this.requestMessage.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`**Erreur inattendue, réponse à la demande invalide.**`)
                            .setColor(0x000000) // black
                    ],
                    components: []
                });
            } // end switch
        })

        // When manually stopped or time expires
        requestMessageCollector.on('end', async () => {
            // check status
            if (this.status !== JoinRequestStatus.WAITING) return;
            // Edit request message
            requestMessage.edit({
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`La demande a expiré.`)
                        .setColor(0x000000) // black
                ],
                components: []
            })
            // Remove joinRequest from collection
            this.lobby.removeJoinRequest(this.user.id);
        });
        
        } catch (e) {
            this.status = JoinRequestStatus.ERROR;
            this.lobby.removeJoinRequest(this.user.id);
            this.callback(LobbyResponseCodes.UnableToAsk);
        }
    }
}



/**
 * Class representing a game of PokeQuiz
 */
class Game {
    /**
     * Constructor
     * @param {TextBasedChannel} channel The channel where to play the game
     * @param {Collection<string, string>} players The players
     * @param {Pokemon} pokemon The pokemon to guess
     * @param {string} difficulty The difficulty of the game
     * @param {string} hostId The host's user id
     * @param {function} restart The callback function to restart a game
     */
    constructor(channel, players, pokemon, difficulty, hostId, restart) {
        // passed arguments
        this.channel = channel;
        this.players = players;
        this.pokemon = pokemon;
        this.difficulty = difficulty;
        this.hostId = hostId;
        this.restart = restart;
        // other
        this.status = GameStatus.INIT;
        // init tries counter to 0 for all players
        this.tries = new Collection();
        this.players.forEach((username, id) => {
            this.tries.set(id, 0);
        });
        
        // Hints
        this.availableHintsCount = 0;
        this.unlockedHintsCount = 0;

        // create message components
        this.createButtons();
        this.createEmbedFields();
        this.createEmbed();

        // start
        this.start();
    }

    /**
     * Creates the message buttons
     */
    createButtons() {
        // ensure it isn't triggered during game
        if (this.status !== GameStatus.INIT) return;
        // Action Row
        this.buttons = new ActionRowBuilder();

        // Hint buttons
        let hintButtons = [
            new ButtonBuilder()
            .setCustomId('type')
            .setLabel("Type(s)")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
            
            new ButtonBuilder()
            .setCustomId('category')
            .setLabel("Catégorie")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
            
            new ButtonBuilder()
            .setCustomId('initial')
            .setLabel("Initiale")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
            
            new ButtonBuilder()
            .setCustomId('artwork')
            .setLabel("Artwork")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        ];

        // add hints corresponding to the difficulty
        if (difficulties[this.difficulty].hints > 0) {
            for (let i = 0; i < difficulties[this.difficulty].hints; i++) {
                this.buttons.addComponents(hintButtons[i]);
            }
        }

        // add the surrender button
        this.buttons.addComponents(
            new ButtonBuilder()
            .setCustomId('surrender')
            .setLabel('Abandonner')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(false)
        );
    }

    /**
     * Creates the base message embed fields
     * It has a specific method 
     */
    createEmbedFields() {
        // ensure it isn't triggered during game
        if (this.status !== GameStatus.INIT) return;
        this.embedFields = [
            {
                name: "Liste des joueurs",
                value: this.players.map((username, id) => `<@${id}>`).join(' | '),
                inline: false
            },
            {
                name: "Description du Pokédex",
                value: this.pokemon.cryptedDescription,
                inline: false
            }
        ];
    }

    /**
     * Creates the message embed
     */
    createEmbed() {
        // ensure it isn't triggered during game
        if (this.status !== GameStatus.INIT) return;
        this.embed = new EmbedBuilder()
            .setTitle(`PokéParty du ${difficulties[this.difficulty].name}`)
            .setColor(0xFFFF00)
            .setDescription("*Retrouvez le nom du Pokémon correspondant à la description ci-dessous et utilisez les boutons pour obtenir plus d'indices !\nQue le meilleur gagne !*")
            .addFields(this.embedFields)
            .setFooter({
                text: "Hôte de la partie : " + this.players.get(this.hostId)
            })
            .setTimestamp();
        
    }

    /**
     * Calculates the total of tries
     * @returns The sum of all the tries of the players
     */
    getTotalTries() {
        return this.tries.reduce(
            (previous, current) => previous + current, 0
        );
    }

    /**
     * Triggered when a player tries to guess the pokemon
     * @param {string} playerId The player's user id 
     * @param {string} answer The answer provided by the player
     * @returns {boolean} True if the answer is right, false otherwise
     */
    takeGuess(playerId, answer) {
        // increment player tries
        const playerTries = this.tries.get(playerId)
        this.tries.set(playerId, playerTries + 1);
        // normalize answer
        const normAnswer = latinize(answer.toLowerCase());
        // verify answer
        const found = (normAnswer == this.pokemon.normName);
        // update status & end game
        if (found) {
            this.status = GameStatus.FOUND;
            this.victory(playerId);
        }
        return found;
    }

    async start() {
        // send message
        this.message = await this.channel.send({
            embeds: [this.embed],
            components: [this.buttons]
        });
        // capture start time & update game status
        this.startTime = new Date();
        this.status = GameStatus.GUESSING;

        // answers filter (checks message is from a player)
        const answersFilter = answer => this.players.has(answer.author.id);

        // setup answers collector
        const answersCollector = new MessageCollector(this.channel, {
            filter: answersFilter,
            time: difficulties[this.difficulty].time
        });

        // check if limited tries
        if (difficulties[this.difficulty].tries > 0) {
            // set maximum of total answers
            // (tries per player) x (number of players)
            answersCollector.options.max = difficulties[this.difficulty] * this.players.size;
        }

        // buttons filter (checks if button pressed by a player)
        const buttonsFilter = async button => {
            await button.deferUpdate(); // prevents interaction timeout
            return this.players.has(button.user.id);
        }

        // setup buttons collector
        const buttonsCollector = this.message.createMessageComponentCollector({
            filter: buttonsFilter,
            componentType: ComponentType.Button,
            time: difficulties[this.difficulty].time
        });

        this.processAnswers(answersCollector, () => {
            if (!buttonsCollector.ended) buttonsCollector.stop();
        });
        this.processButtons(buttonsCollector, () => {
            if (!answersCollector.ended) answersCollector.stop();
        });
    }

    /**
     * 
     * @param {InteractionCollector<ButtonInteraction>>} buttonsCollector
     * @param {function} stopMessageCollector 
     */
    processButtons(buttonsCollector, stopAnswersCollector) {
        // ensure it isn't triggered before initialization finished
        if (this.status !== GameStatus.GUESSING) return;

        // unlock new hint every minute
        const unlockHintsInterval = setInterval(() => {
            if (this.availableHintsCount < difficulties[this.difficulty].hints) {
                const unlocking = this.buttons.components.at(this.unlockedHintsCount)
                unlocking.setDisabled(false);
                unlocking.setStyle(ButtonStyle.Success);
                this.message.edit({ components: [this.buttons] });
                this.unlockedHintsCount++;
            } else {
                clearInterval(unlockHintsInterval);
            }
        }, 60000);

        // start button collector
        buttonsCollector.on('collect', async button => {
            // surrender button
            if (button.customId === 'surrender' && button.user.id === this.hostId) {
                // stop game
                stopAnswersCollector();
                buttonsCollector.stop();
                return;
            }

            // get the pressed button
            const pressedButton = this.buttons.components.find(
                btn => btn.data.custom_id === button.customId
            );

            // disable the button
            if (pressedButton) {
                pressedButton.setDisabled(true);
                pressedButton.setStyle(ButtonStyle.Primary);
            }

            // increment hints
            this.availableHintsCount++;
            // take action depending on the hint button pressed
            switch (button.customId) {
            case ('type'):
                this.embedFields.push({
                    name: "Type" + (this.pokemon.types.size > 1 ? "s" : ""),
                    value: this.pokemon.types.reduce(
                        (first, second) => first + " | " + second
                    ),
                    inline: true
                });
                break;
            case ('category'):
                this.embedFields.push({
                    name: 'Catégorie',
                    value: this.pokemon.category,
                    inline: true
                });
                break;
            case ('initial'):
                this.embedFields.push({
                    name: 'Initiale',
                    value: this.pokemon.name.substring(0, 1),
                    inline: true
                });
                break;
            case ('artwork'):
                this.embed.setThumbnail(this.pokemon.artworkUrl);
                break;
            default:
                await button.followUp({
                    content: "Une erreur inattendue s'est produite. Identifiant de bouton invalide.",
                    flags: MessageFlags.Ephemeral
                });
                break;
            }

            // update message
            this.embed.setFields(this.embedFields);
            this.message.edit({
                embeds: [this.embed],
                components: [this.buttons]
            });

            // stop collector early if no more hint are possible
            if (this.availableHintsCount >= difficulties[this.difficulty].hints/* * this.players.size + 1 */) { // ???
                buttonsCollector.stop();
            }
        });

        // button collector ends
        buttonsCollector.on('end', () => {
            clearInterval(unlockHintsInterval);
        });
    }

    /**
     * 
     * @param {MessageCollector} answersCollector 
     * @param {function} stopButtonsCollector 
     */
    processAnswers(answersCollector, stopButtonsCollector) {
        answersCollector.on('collect', async answer => {
        
            if (difficulties[this.difficulty].tries > 0) {
                if (this.tries.get(m.author.id) >= difficulties[this.difficulty].tries) {
                    await answer.react('🚫').catch();
                }
            } else if (this.takeGuess(answer.author.id, answer.content)) {
                await answer.react('✅').catch();
                stopButtonsCollector();
                answersCollector.stop();
            } else {
                await answer.react('❌').catch();
            }
    
            if ((difficulties[this.difficulty].tries > 0) && (this.getTotalTries() >= difficulties[this.difficulty].tries * this.players.size)) {
                answersCollector.stop();
            }
            
            // delete answers to avoid flood
            setTimeout(() => {
                if (answer.deletable) answer.delete().catch();
            }, 5000); // 5 seconds
        })

        answersCollector.on('end', async () => {
            if (this.status === GameStatus.FOUND) return;
            this.status = GameStatus.NOTFOUND;
            this.defeat();
        })
    }

    victory(winnerId) {
        if (this.status !== GameStatus.FOUND) return;
        const chrono = new Date() - this.startTime;
        const victoryEmbed = new EmbedBuilder()
            .setTitle("Victoire !")
            .setDescription(`Bravo ${this.players.get(winnerId)} !\nVous avez trouvé **${this.pokemon.name}** en ${chrono / 1000}s !`)
            .setColor(0x00FF00)
            .setFooter({
                text: `Difficulté ${difficulties[this.difficulty].name} | ${this.tries.get(winnerId)} essais | ${this.availableHintsCount} indices`
            });
        this.endGame(victoryEmbed);
    }

    defeat() {
        if (this.status !== GameStatus.NOTFOUND) return;
        const defeatEmbed = new EmbedBuilder()
            .setTitle("Défaite...")
            .setDescription(`Personne n'a trouvé **${this.pokemon.name}** ...`)
            .setColor(0xFF0000)
            .setFooter({
                text: `Difficulté ${difficulties[this.difficulty].name} | ${this.getTotalTries()} essais | ${this.availableHintsCount} indices`
            });
        this.endGame(defeatEmbed);
    }

    /**
     * 
     * @param {EmbedBuilder} embed
     */
    endGame(finalEmbed) {
        if (this.status === GameStatus.GUESSING || this.status === GameStatus.INIT) return;

        // finalize embed
        finalEmbed
            .setTimestamp()
            .setThumbnail(this.pokemon.artworkUrl);
        
        // postgame buttons
        const postgameButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('replay')
                    .setLabel('Relancer une partie')
                    .setStyle(ButtonStyle.Success)
                ,
                new ButtonBuilder()
                    .setCustomId('pokedex')
                    .setLabel('Voir le Pokémon')
                    .setStyle(ButtonStyle.Primary)
            );
        
        // edit game message
        this.message.edit({
            embeds: [finalEmbed],
            components: [postgameButtons]
        })

        // release players
        this.players.forEach((username, id) => {
            removePlayer(id, this.channel.id);
        });

        const postGameFilter = async button => {
            await button.deferUpdate();
            return true;
        }

        const postgameCollector = this.message.createMessageComponentCollector({
            dispose: true,
            filter: postGameFilter,
            componentType: ComponentType.Button,
            time: 60_000 // 1 min
        });

        postgameCollector.on('collect', async button => {
            switch (button.customId) {
            case ('pokedex'):
                const pkmEmbed = await pokedexEmbed(this.pokemon.id);
                await button.followUp({
                    embeds: [pkmEmbed], 
                    flags: MessageFlags.Ephemeral
                });
                break;
            case ('replay'):
                if (this.hostId === button.user.id) {
                    this.restart();
                    postgameCollector.stop();
                }
            }
        });
        
        postgameCollector.on('end', () => {
            this.message.edit({
                embeds: [finalEmbed], 
                components: []
            });
        });
    }
}

/**
 * Represents a pokemon to guess
 */
class Pokemon {

    /**
     * Constructor
     * @param {string} id 
     */
    constructor(id) {
        this.id = id;
    }

    async fetch() {
        await this.fromPokemonSpecies();
    }

    async fromPokemonSpecies() {
        const pokemonSpecies = await getPokemonSpecies(this.id);

        // Get the french name
        this.name = pokemonSpecies.names.find(
            name => name.language.name === 'fr'
        ).name;
        // Get the normalized french name
        this.normName = latinize(this.name.toLowerCase());

        // Get french descriptions
        this.description = ""; // init to empty string
        let descriptions = pokemonSpecies.flavor_text_entries.filter(
            flavor => flavor.language.name === 'fr'
        )
        // if no french description available take an english one
        if (descriptions.length === 0) {
            descriptions = pokemonSpecies.flavor_text_entries.filter(
                flavor => flavor.language.name === 'en'
            )
            // déso pas déso
            this.description = "\n_(Description indisponible en français)_";
        }
        this.description = descriptions[random(0, descriptions.length - 1)]
            .flavor_text.replace(/\n/g, ' ') + this.description;
        // Make crytped description
        this.cryptedDescription = this.description.replace(this.name, "???");

        // Get the french genera (category)
        this.category = pokemonSpecies.genera.find(
            genera => genera.language.name === 'fr'
        ).genus;

        // Get data from default variety of this species
        await this.fromPokemonDefaultVariety(
            pokemonSpecies.varieties.find(variety => variety.is_default).pokemon.url
        )
    }

    async fromPokemonDefaultVariety(url) {
        const pokemonDefault = await subRequest(url);

        // Get french types
        this.types = new Collection();
        for (let i = 0; i < pokemonDefault.types.length; i++) {
            let type = await subRequest(pokemonDefault.types[i].type.url);
            this.types.set(i, type.names.find(
                name => name.language.name === 'fr'
            ).name);
        }

        // Get artwork url
        this.artworkUrl = pokemonDefault.sprites.other['official-artwork'].front_default;
    }
}

// LOGIC : reply interaction with loading message and fetch it, pass it as parameter of PokeQuiz constructor so its editable
// 

class PokeQuiz {
    
    /**
     * 
     * @param {Message} message 
     * @param {User} host 
     * @param {number} generation 
     * @param {boolean} isPrivate 
     * @param {string} difficulty 
     */
    constructor(message, host, generation, isPrivate, difficulty) {
        this.message = message;
        this.channel = message.channel;
        this.generation = generation;
        this.difficulty = difficulty;
        this.lobby = new Lobby(host, message, isPrivate, difficulty);
        this.init();
    }

    init() {
        this.lobby.start(() => this.start());
    }

    async start() {
        // Make sure the lobby has ended
        if (this.lobby.status != LobbyStatus.STARTED) return;
        // get the random Pokemon
        const pokemon = await this.getRandomPokemon();
        // format the players
        const players = new Collection();
        this.lobby.players.forEach((user, id) => {
            if (!isPlaying(id, this.channel.id))
                players.set(id, user.username)
        });

        if (players.size === 0 || isPlaying(this.lobby.hostId, this.channel.id)) return;
        // re-fetch the channel
        this.channel = await getChannel(this.channel.id);
        // start the game
        this.party = new Game(this.channel, players, pokemon, this.difficulty, this.lobby.hostId, () => this.start());
    }

    async getRandomPokemon() {
        const minId = gen[this.generation][0];
        const maxId = gen[this.generation][1];
        const pokemonId = random(minId, maxId);
        const pokemon = new Pokemon(pokemonId);
        await pokemon.fetch();
        return pokemon;
    }
}

/**
 * Players in game
 */
const playersInGame = new Collection();

/**
 * Check if a player is already playing in a channel
 * @param {string} userId The user's discord id
 * @param {string} channelId The channel where he plays
 * @returns {boolean} True if the user is currently playing in the channel, false otherwise
 */
function isPlaying(userId, channelId) {
    if (playersInGame.has(userId)) {
        return playersInGame.get(userId).includes(channelId);
    }
    return false;    
}

/**
 * Add a player to the game
 * @param {string} userId The user's discord id 
 * @param {string} channelId The channel where he started playing
 */
function addPlayer(userId, channelId) {
    if (!playersInGame.has(userId)) {
        playersInGame.set(userId, [channelId]);
    } else {
        playersInGame.get(userId).push(channelId);
    }
}

/**
 * Remove a player from the game
 * @param {string} userId The user's discord id
 * @param {string} channelId The channel where he stopped playing
 */
function removePlayer(userId, channelId) {
    if (playersInGame.has(userId)) {
        const index = playersInGame.get(userId).indexOf(channelId);
        if (index > -1) {
            playersInGame.get(userId).splice(index, 1);
        }
        if (playersInGame.get(userId).length === 0) {
            playersInGame.delete(userId);
        }
    }
}

async function createPokeQuiz(message, host, generation, isPrivate, difficulty) {
    // Check if host is already playing
    if (isPlaying(host.id, message.channel.id)) {
        await message.edit({
            content: 'Vous êtes déjà dans une partie en cours sur ce salon !'
        });
        return;
    }
    // if not, add it the the global players
    addPlayer(message.author.id, message.channel.id);
    // create lobby message
    const lobbyMessage = await message.channel.send({
        embed: [
            new EmbedBuilder()
                .setTitle("Démarrage du lobby...")
                .setColor(0x00FFFF) // yellow
        ]
    });
    // start the PokeQuiz
    return new PokeQuiz(lobbyMessage, host, generation, isPrivate, difficulty);
}

module.exports = {
    createPokeQuiz
}