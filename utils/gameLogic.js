// 
// Утилиты игровой логики
export const analyzeDice = (dice) => {
    const scoringGroups = [];
    const usedIndices = new Set();
    const counts = {}; // Store indices for each die value

    dice.forEach((d, i) => {
        if (!counts[d]) counts[d] = [];
        counts[d].push(i);
    });

    // Check for street (1-2-3-4-5)
    const isStreet = [1, 2, 3, 4, 5].every(val => counts[val] && counts[val].length > 0);
    if (isStreet && dice.length === 5) {
        return {
            scoringGroups: [{ value: dice, score: 125, indices: dice.map((_, i) => i) }]
        };
    }
    
    // Five-of-a-kind
    for (let i = 1; i <= 6; i++) {
        if (counts[i] && counts[i].length >= 5) {
            const groupIndices = counts[i].slice(0, 5);
            scoringGroups.push({
                value: Array(5).fill(i),
                score: i === 1 ? 1000 : i * 100,
                indices: groupIndices,
            });
            groupIndices.forEach(idx => usedIndices.add(idx));
        }
    }

    // Four-of-a-kind
    for (let i = 1; i <= 6; i++) {
        const availableIndices = counts[i]?.filter(idx => !usedIndices.has(idx)) || [];
        if (availableIndices.length >= 4) {
            const groupIndices = availableIndices.slice(0, 4);
            scoringGroups.push({
                value: Array(4).fill(i),
                score: i === 1 ? 200 : i * 20,
                indices: groupIndices,
            });
            groupIndices.forEach(idx => usedIndices.add(idx));
        }
    }
    
    // Three-of-a-kind
    for (let i = 1; i <= 6; i++) {
        const availableIndices = counts[i]?.filter(idx => !usedIndices.has(idx)) || [];
        if (availableIndices.length >= 3) {
            const groupIndices = availableIndices.slice(0, 3);
            scoringGroups.push({
                value: Array(3).fill(i),
                score: i === 1 ? 100 : i * 10,
                indices: groupIndices,
            });
            groupIndices.forEach(idx => usedIndices.add(idx));
        }
    }

    // Individual 1s and 5s
    if (counts[1]) {
        counts[1].forEach(idx => {
            if (!usedIndices.has(idx)) {
                scoringGroups.push({ value: [1], score: 10, indices: [idx] });
            }
        });
    }
    if (counts[5]) {
        counts[5].forEach(idx => {
            if (!usedIndices.has(idx)) {
                scoringGroups.push({ value: [5], score: 5, indices: [idx] });
            }
        });
    }

    return { scoringGroups };
}

export const validateSelection = (dice) => {
    if (dice.length === 0) {
        return { isValid: false, score: 0, values: [] };
    }

    const { scoringGroups } = analyzeDice(dice);
    const usedDiceCount = scoringGroups.reduce((count, group) => count + group.value.length, 0);

    if (usedDiceCount < dice.length) {
        return { isValid: false, score: 0, values: [] };
    }
    
    const totalScore = scoringGroups.reduce((sum, group) => sum + group.score, 0);

    return {
        isValid: true,
        score: totalScore,
        values: dice,
    };
};

export const calculateTotalScore = (player) => {
    if (!player || !player.scores) return 0;
    return player.scores
        .filter(s => typeof s === 'number')
        .reduce((sum, s) => sum + s, 0);
};

export const createInitialState = () => {
  return {
    players: Array.from({ length: 5 }, (_, i) => ({ 
        id: i, 
        name: `Игрок ${i + 1}`, 
        scores: [], 
        isClaimed: false,
        status: 'offline', // 'online', 'away', 'disconnected'
        isSpectator: false,
    })),
    spectators: [],
    leavers: {}, // Track scores of players who left
    joinRequests: [], // Track join requests for host approval
    currentPlayerIndex: 0,
    hostId: 0, // Player 0 is the initial host
    diceOnBoard: [],
    keptDiceThisTurn: [],
    diceKeptFromThisRoll: [],
    selectedDiceIndices: [],
    scoreFromPreviousRolls: 0,
    currentTurnScore: 0,
    potentialScore: 0,
    gameMessage: `Ожидание игроков...`,
    isGameOver: false,
    isGameStarted: false,
    canRoll: false,
    canBank: false,
    canKeep: false,
    turnStartTime: 0,
    version: 1,
  };
};

export const findNextHost = (players) => {
    const candidates = players.filter(p => p.isClaimed && !p.isSpectator);
    if (candidates.length === 0) return null; // No one left to be host

    // Only 'online' players can be host.
    const onlinePlayers = candidates.filter(p => p.status === 'online').sort((a, b) => a.id - b.id);
    if (onlinePlayers.length > 0) {
        return onlinePlayers[0].id;
    }
    
    // If no one is online, there is no host.
    return null;
};