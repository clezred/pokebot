/**************************************************************************
 * Newly added enums file to ensure integrity when taking decisions or defining
 * precise types
 *************************************************************************/

module.exports = {
    /***********************************
                   GLOBAL
     ***********************************/    
    Language: {
        fr: 'fr',
        en: 'en'
    },

    Debug: {
        off: 0,
        on:  1
    },
    
    /***********************************
                  POKEQUIZ
     ***********************************/
    LobbyStatus: {
        WAITING: 0,
        STARTED: 1,
        ABORTED: 2
    },

    LobbyResponseCodes: {
        UnexpectedBehaviour:   -1,
        SuccessfulyJoined:      0,
        SuccessfulyAskedToJoin: 1,
        AlreadyJoined:          2,
        AlreadyPlaying:         3,
        AlreadyAskedToJoin:     4,
        UnableToAsk:            5,
        NotAPlayer:             6,
        UnableToLeave:          7,
        UnableToJoin:           8,
        RequestAccepted:        9,
        RequestRefused:         10,
    },

    JoinRequestStatus: {
        ERROR:   -1,
        WAITING:  0,
        ACCEPTED: 1,
        REFUSED:  2,
        EXPIRED:  3
    },

    GameAccessibility: {
        PUBLIC:  'public',
        PRIVATE: 'private'
    },

    GameStatus: {
        INIT:     0,
        GUESSING: 1,
        FOUND:    2,
        NOTFOUND: 3
    }
}