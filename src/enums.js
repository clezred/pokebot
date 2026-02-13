module.exports = {
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