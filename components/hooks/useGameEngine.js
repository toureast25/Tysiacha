
import React from 'react';
import {
  createInitialState,
  createLocalGameState,
  analyzeDice,
  validateSelection,
  calculateTotalScore,
  getPlayerBarrelStatus,
  findNextHost,
} from '../../utils/gameLogic.js';

// --- HELPER FUNCTION ---
const findNextActivePlayer = (startIndex, players) => {
    let nextIndex = (startIndex + 1) % players.length;
    while (nextIndex !== startIndex) {
        if (players[nextIndex].isClaimed && !players[nextIndex].isSpectator && players[nextIndex].status === 'online') {
            return nextIndex;
        }
        nextIndex = (nextIndex + 1) % players.length;
    }
    return startIndex;
};

// --- REDUCER ---
function gameReducer(state, action) {
  if (action.type === 'SET_STATE') {
      if (!action.payload) return state;
      return action.payload;
  }
  
  const newState = { ...state, version: (state.version || 1) + 1 };
  
  switch (action.type) {
    case 'PLAYER_JOIN': {
        const { playerName, sessionId, asSpectator } = action.payload;
        if (newState.players.some(p => p.sessionId === sessionId) || newState.spectators.some(s => s.id === sessionId)) {
             return state;
        }
        if (asSpectator) {
            return { ...newState, spectators: [...newState.spectators, { name: playerName, id: sessionId }] };
        }

        // 1. Попытка восстановить игрока по имени (Rejoin Logic)
        const existingPlayerIndex = newState.players.findIndex(p => p.isClaimed && p.name === playerName);
        if (existingPlayerIndex !== -1) {
            // Игрок с таким именем уже есть. Перехватываем слот.
            const newPlayers = newState.players.map((p, i) => 
                i === existingPlayerIndex
                ? { ...p, sessionId: sessionId, status: 'online', lastSeen: Date.now() } // Обновляем SessionID и статус
                : p
            );
            return { ...newState, players: newPlayers, gameMessage: `${playerName} вернулся в игру.` };
        }

        // 2. Если имя новое, ищем свободный слот
        const joinIndex = newState.players.findIndex(p => !p.isClaimed);
        if (joinIndex === -1) return newState;

        const restoredScore = newState.leavers?.[playerName] || 0;
        const newLeavers = { ...newState.leavers };
        if (restoredScore > 0) delete newLeavers[playerName];

        const newPlayers = newState.players.map((p, i) => 
            i === joinIndex 
            ? { ...p, name: playerName, isClaimed: true, scores: restoredScore > 0 ? [restoredScore] : [], status: 'online', sessionId, hasEnteredGame: restoredScore > 0, lastSeen: Date.now() } 
            : p
        );
        return { ...newState, players: newPlayers, leavers: newLeavers, gameMessage: `${playerName} присоединился.` };
    }

    // Обработка автоматического отключения (Last Will)
    case 'PLAYER_DISCONNECT': {
        const { sessionId } = action.payload;
        const newPlayers = newState.players.map(p => 
            p.sessionId === sessionId 
            ? { ...p, status: 'offline' } 
            : p
        );
        return { ...newState, players: newPlayers };
    }
    
    // Обработка ручного выхода
    case 'PLAYER_LEAVE': {
      const { sessionId } = action.payload;
      
      // Если это зритель
      if (newState.spectators.some(s => s.id === sessionId)) {
           return {...newState, spectators: newState.spectators.filter(s => s.id !== sessionId)};
      }
      
      const playerIndex = newState.players.findIndex(p => p.sessionId === sessionId);
      if (playerIndex === -1) return newState;
      
      const playerToRemove = newState.players[playerIndex];
      
      // ВАЖНО: Мы больше не удаляем игрока полностью (reset), если игра уже идет.
      // Мы ставим статус 'offline', чтобы сохранить место и очки для перезахода.
      // Если игра еще не началась - можно освободить слот.
      
      const gameIsActive = newState.isGameStarted && !newState.isGameOver;
      
      let newPlayers;
      let newLeavers = { ...newState.leavers };

      if (gameIsActive) {
          // Игра идет: метим как offline
          newPlayers = newState.players.map(p => p.sessionId === sessionId ? { ...p, status: 'offline' } : p);
      } else {
          // Игра в лобби: освобождаем слот
          newPlayers = newState.players.map(p => p.sessionId === sessionId ? { ...createInitialState().players[0], id: p.id, name: `Игрок ${p.id + 1}` } : p);
      }
      
      // Логика передачи хода, если ушел текущий игрок
      let newCurrentPlayerIndex = newState.currentPlayerIndex;
      if (gameIsActive && newState.currentPlayerIndex === playerIndex) {
          newCurrentPlayerIndex = findNextActivePlayer(newState.currentPlayerIndex, newPlayers);
      }
      
      // Логика передачи Хоста
      let newHostId = newState.hostId;
      if (playerToRemove.id === newState.hostId) {
          const nextHostId = findNextHost(newPlayers);
          newHostId = nextHostId !== null ? nextHostId : 0;
      }

      let message = `${playerToRemove.name} вышел.`;
      if (newHostId !== newState.hostId) {
           const newHostName = newPlayers.find(p => p.id === newHostId)?.name || `Игрок ${newHostId + 1}`;
           message += ` Права хоста переданы ${newHostName}.`;
      }
      
      return { 
          ...newState, 
          players: newPlayers, 
          hostId: newHostId, 
          leavers: newLeavers, 
          gameMessage: message, 
          currentPlayerIndex: newCurrentPlayerIndex 
      };
    }
    
    case 'TOGGLE_DIE_SELECTION': {
        if (newState.isGameOver || newState.diceOnBoard.length === 0) return state;
        const { index } = action.payload;
        const newSelectedIndices = newState.selectedDiceIndices.includes(index)
            ? newState.selectedDiceIndices.filter(i => i !== index)
            : [...newState.selectedDiceIndices, index];

        const selectedValues = newSelectedIndices.map(i => newState.diceOnBoard[i]);
        let validation = validateSelection(selectedValues);
        if (!validation.isValid && selectedValues.length > 0) {
            const combinedValidation = validateSelection([...newState.diceKeptFromThisRoll, ...selectedValues]);
            if (combinedValidation.isValid) {
                validation = { isValid: true, score: combinedValidation.score - validateSelection(newState.diceKeptFromThisRoll).score };
            }
        }
        return {
            ...newState,
            selectedDiceIndices: newSelectedIndices,
            canKeep: validation.isValid,
            potentialScore: validation.score > 0 ? validation.score : 0,
            gameMessage: validation.isValid ? `Выбрано +${validation.score}. Можно отложить.` : `Выберите корректную комбинацию.`
        };
    }
    
    case 'KEEP_DICE': {
        const { indices } = action.payload;
        const combinedDice = [...newState.diceKeptFromThisRoll, ...indices.map(i => newState.diceOnBoard[i])];
        const validation = validateSelection(combinedDice);
        if (!validation.isValid) return newState;
        const newTurnScore = newState.scoreFromPreviousRolls + validation.score;
        const scoreAdded = newTurnScore - newState.currentTurnScore;
        const newKeptDiceThisTurn = [...newState.keptDiceThisTurn, ...indices.map(i => newState.diceOnBoard[i])];
        const newDiceOnBoard = newState.diceOnBoard.filter((_, i) => !indices.includes(i));
        const isHotDice = newDiceOnBoard.length === 0;

        return {
            ...newState,
            currentTurnScore: newTurnScore,
            keptDiceThisTurn: newKeptDiceThisTurn,
            diceKeptFromThisRoll: isHotDice ? [] : combinedDice,
            diceOnBoard: newDiceOnBoard,
            gameMessage: `+${scoreAdded}! Очки за ход: ${newTurnScore}. ${isHotDice ? 'Все кости сыграли! Горячие кости!' : 'Бросайте снова или запишите.'}`,
            canRoll: true,
            canBank: true,
            selectedDiceIndices: [],
            canKeep: false,
            potentialScore: 0
        };
    }
    
    case 'ROLL_DICE': {
        if (!newState.canRoll || newState.isGameOver || !newState.isGameStarted) return state;
        const isHotDiceRoll = newState.keptDiceThisTurn.length >= 5;
        const diceToRollCount = isHotDiceRoll ? 5 : 5 - newState.keptDiceThisTurn.length;
        const newDice = Array.from({ length: diceToRollCount }, () => Math.floor(Math.random() * 6) + 1);
        const { scoringGroups } = analyzeDice(newDice);

        if (scoringGroups.reduce((s, g) => s + g.score, 0) === 0) { // BOLT
            const currentPlayer = newState.players[newState.currentPlayerIndex];
            let updatedPlayer = { ...currentPlayer, scores: [...currentPlayer.scores, '/'] };
            const barrelStatus = getPlayerBarrelStatus(currentPlayer);
            if (barrelStatus) {
                updatedPlayer.barrelBolts = (updatedPlayer.barrelBolts || 0) + 1;
                if (updatedPlayer.barrelBolts >= 3) {
                    const totalScore = calculateTotalScore(currentPlayer);
                    updatedPlayer.scores.push((barrelStatus === '200-300' ? 150 : 650) - totalScore);
                    updatedPlayer.barrelBolts = 0;
                    updatedPlayer.justResetFromBarrel = true;
                }
            }
            const newPlayers = newState.players.map((p, i) => i === newState.currentPlayerIndex ? updatedPlayer : p);
            const nextPlayerIndex = findNextActivePlayer(newState.currentPlayerIndex, newPlayers);
            const nextPlayer = newPlayers[nextPlayerIndex];
            let gameMessage = `${currentPlayer.name} получает болт! Ход ${nextPlayer.name}.`;
            return { ...createInitialState(), players: newPlayers.map(p => ({ ...p, justResetFromBarrel: false })), spectators: newState.spectators, leavers: newState.leavers, hostId: newState.hostId, isGameStarted: true, currentPlayerIndex: nextPlayerIndex, diceOnBoard: newDice, gameMessage, turnStartTime: Date.now(), canRoll: true };
        } else {
            return {
                ...newState,
                diceOnBoard: newDice,
                keptDiceThisTurn: isHotDiceRoll ? [] : newState.keptDiceThisTurn,
                diceKeptFromThisRoll: [],
                scoreFromPreviousRolls: newState.currentTurnScore,
                gameMessage: `Ваш бросок. Выберите очковые кости.`,
                canRoll: false,
                canBank: true,
                selectedDiceIndices: [],
                canKeep: false,
                potentialScore: 0
            };
        }
    }
    
    case 'BANK_SCORE': {
        if (!newState.canBank || newState.isGameOver) return state;
        const finalTurnScore = newState.currentTurnScore + newState.potentialScore;
        const currentPlayer = newState.players[newState.currentPlayerIndex];
        
        const getBoltState = (playerForBolt, barrelStatus) => {
          let updatedPlayer = { ...playerForBolt, scores: [...playerForBolt.scores, '/'] };
          if (barrelStatus) {
            updatedPlayer.barrelBolts = (updatedPlayer.barrelBolts || 0) + 1;
            if (updatedPlayer.barrelBolts >= 3) {
              const totalScore = calculateTotalScore(playerForBolt);
              updatedPlayer.scores.push((barrelStatus === '200-300' ? 150 : 650) - totalScore);
              updatedPlayer.barrelBolts = 0;
              updatedPlayer.justResetFromBarrel = true;
            }
          }
          const newPlayers = newState.players.map((p, i) => i === newState.currentPlayerIndex ? updatedPlayer : p);
          const nextIdx = findNextActivePlayer(newState.currentPlayerIndex, newPlayers);
          const nextPlayer = newPlayers[nextIdx];
          let msg = `${playerForBolt.name} получает болт. Ход ${nextPlayer.name}.`;
          return { ...createInitialState(), players: newPlayers.map(p => ({...p, justResetFromBarrel: false})), spectators: newState.spectators, leavers: newState.leavers, hostId: newState.hostId, isGameStarted: true, canRoll: true, currentPlayerIndex: nextIdx, gameMessage: msg, turnStartTime: Date.now() };
        };

        if (finalTurnScore === 0 && newState.keptDiceThisTurn.length > 0) {
            return getBoltState(currentPlayer);
        }
        if (!currentPlayer.hasEnteredGame && finalTurnScore < 50) {
            const nextIdx = findNextActivePlayer(newState.currentPlayerIndex, newState.players);
            return { ...createInitialState(), players: newState.players, spectators: newState.spectators, leavers: newState.leavers, hostId: newState.hostId, isGameStarted: true, canRoll: true, currentPlayerIndex: nextIdx, gameMessage: `${currentPlayer.name} не набрал 50 для входа.`, turnStartTime: Date.now() };
        }
        const barrelStatus = getPlayerBarrelStatus(currentPlayer);
        const totalBefore = calculateTotalScore(currentPlayer);
        const failedBarrel = (barrelStatus === '200-300' && totalBefore + finalTurnScore < 300) || (barrelStatus === '700-800' && totalBefore + finalTurnScore < 800);
        if (failedBarrel) {
            return getBoltState(currentPlayer, barrelStatus);
        }
        
        let playersAfterTurn = newState.players.map((p, i) => i === newState.currentPlayerIndex ? { ...p, scores: [...p.scores, finalTurnScore], hasEnteredGame: true, barrelBolts: 0 } : p);
        const newTotal = calculateTotalScore(playersAfterTurn[newState.currentPlayerIndex]);
        const newBarrel = (newTotal >= 200 && newTotal < 300) ? '200-300' : (newTotal >= 700 && newTotal < 800) ? '700-800' : null;
        let penaltyMsgs = [];

        let playersWithPenalties = playersAfterTurn.map((p, i) => {
            if (i === newState.currentPlayerIndex || !p.isClaimed) return p;
            const oldTotal = calculateTotalScore(newState.players[i]);
            const otherBarrel = getPlayerBarrelStatus(newState.players[i]);
            if (newBarrel && otherBarrel === newBarrel) {
                penaltyMsgs.push(`${p.name} сбит с бочки.`);
                return { ...p, scores: [...p.scores, (newBarrel === '200-300' ? 150 : 650) - oldTotal] };
            }
            if (totalBefore < oldTotal && newTotal >= oldTotal && oldTotal >= 100) {
                const scoreAfterPenalty = oldTotal - 50;
                const wouldLandOnBarrel = (scoreAfterPenalty >= 200 && scoreAfterPenalty < 300) || (scoreAfterPenalty >= 700 && scoreAfterPenalty < 800);
                if (!wouldLandOnBarrel && !p.justResetFromBarrel) {
                    penaltyMsgs.push(`${p.name} штраф -50.`);
                    return { ...p, scores: [...p.scores, -50] };
                }
            }
            return p;
        });
        if (newTotal >= 1000) {
            return { ...createInitialState(), players: playersWithPenalties, isGameOver: true, gameMessage: `${currentPlayer.name} победил, набрав ${newTotal}!` };
        }
        const nextIdx = findNextActivePlayer(newState.currentPlayerIndex, playersWithPenalties);
        let msg = `${currentPlayer.name} записал ${finalTurnScore}. ${penaltyMsgs.join(' ')} Ход ${playersWithPenalties[nextIdx].name}.`;
        return { ...createInitialState(), players: playersWithPenalties.map(p => ({...p, justResetFromBarrel: false})), spectators: newState.spectators, leavers: newState.leavers, hostId: newState.hostId, isGameStarted: true, canRoll: true, currentPlayerIndex: nextIdx, gameMessage: msg, turnStartTime: Date.now() };
    }
    
    case 'START_OFFICIAL_GAME': {
        const firstPlayer = newState.players[newState.currentPlayerIndex];
        return { ...newState, isGameStarted: true, canRoll: true, gameMessage: `Игра началась! Ход ${firstPlayer.name}.`, turnStartTime: Date.now() };
    }
    
    case 'NEW_GAME': {
      const newPlayers = Array.from({ length: 5 }, (_, index) => {
        const oldPlayer = newState.players[index];
        if (oldPlayer && oldPlayer.isClaimed) {
          return { ...oldPlayer, scores: [], hasEnteredGame: false, barrelBolts: 0, justResetFromBarrel: false };
        }
        return { ...createInitialState().players[0], id: index, name: `Игрок ${index + 1}` };
      });
      return { ...createInitialState(), players: newPlayers, spectators: newState.spectators, hostId: newState.hostId, currentPlayerIndex: newState.hostId, gameMessage: 'Новая игра. Ожидание старта.' };
    }

    case 'SKIP_TURN': {
      const currentPlayer = newState.players[newState.currentPlayerIndex];
      const newPlayers = newState.players.map((p, i) => i === newState.currentPlayerIndex ? { ...p, scores: [...p.scores, '/'] } : p);
      const nextIdx = findNextActivePlayer(newState.currentPlayerIndex, newPlayers);
      const msg = `${currentPlayer.name} пропустил ход. Ход ${newPlayers[nextIdx].name}.`;
      return { ...createInitialState(), players: newPlayers.map(p => ({...p, justResetFromBarrel: false})), spectators: newState.spectators, leavers: newState.leavers, hostId: newState.hostId, isGameStarted: true, canRoll: true, currentPlayerIndex: nextIdx, gameMessage: msg, turnStartTime: Date.now() };
    }

    case 'KICK_PLAYER': {
        const { playerId } = action.payload;
        const playerToKick = newState.players.find(p => p.id === playerId);
        if (!playerToKick) return state;
        // Принудительное удаление (сброс слота)
        let newPlayers = newState.players.map(p => p.id === playerId ? { ...createInitialState().players[0], id: p.id, name: `Игрок ${p.id + 1}` } : p);
        let newCurrentPlayerIndex = newState.currentPlayerIndex;
        if(newState.currentPlayerIndex === playerId) {
             newCurrentPlayerIndex = findNextActivePlayer(newState.currentPlayerIndex, newPlayers);
        }
        return { ...newState, players: newPlayers, currentPlayerIndex: newCurrentPlayerIndex, gameMessage: `${playerToKick.name} был исключен.` };
    }

    default:
      return state;
  }
}

// --- HOOK ---
export const useGameEngine = (initialLocalState, isLocalMode, localConfig) => {
    const initialState = React.useMemo(() => {
        if (isLocalMode && initialLocalState) {
            return initialLocalState;
        }
        return null;
    }, [isLocalMode, initialLocalState]);

    const [gameState, dispatch] = React.useReducer(gameReducer, initialState);
    
    // Ref to hold current state for closures (critical for MQTT callbacks)
    const gameStateRef = React.useRef(gameState);

    // Sync Ref with State
    React.useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    return { gameState, dispatch, gameStateRef };
};
