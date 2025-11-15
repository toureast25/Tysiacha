import React from 'react';
import {
  createInitialState,
  analyzeDice,
  validateSelection,
  calculateTotalScore,
  getPlayerBarrelStatus,
  findNextHost,
} from '../../utils/gameLogic.js';

const useGameEngine = (lastReceivedState, publishState, playerName, mySessionId) => {
  const [gameState, setGameState] = React.useState(null);
  const [myPlayerId, setMyPlayerId] = React.useState(null);
  const [isSpectator, setIsSpectator] = React.useState(false);
  const gameStateRef = React.useRef(gameState);

  React.useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const findNextActivePlayer = React.useCallback((startIndex, players) => {
    let nextIndex = (startIndex + 1) % players.length;
    while (nextIndex !== startIndex) {
        if (players[nextIndex].isClaimed && !players[nextIndex].isSpectator) {
            return nextIndex;
        }
        nextIndex = (nextIndex + 1) % players.length;
    }
    const firstActive = players.findIndex(p => p.isClaimed && !p.isSpectator);
    return firstActive !== -1 ? firstActive : startIndex;
  }, []);

  const updateAllPlayerStatuses = React.useCallback((currentPlayers) => {
    const now = Date.now();
    let needsUpdate = false;
    const updatedPlayers = currentPlayers.map(p => {
        const playerCopy = {...p};
        if (!playerCopy.isClaimed || playerCopy.isSpectator) return playerCopy;

        const lastSeen = playerCopy.lastSeen || 0;
        let newStatus = playerCopy.status;
        
        if (lastSeen > 0) {
            if (now - lastSeen > 90000) newStatus = 'disconnected';
            else if (now - lastSeen > 20000) newStatus = 'away';
            else newStatus = 'online';
        } else if (playerCopy.status !== 'offline') {
            newStatus = 'offline';
        }

        if (newStatus !== playerCopy.status) {
            needsUpdate = true;
        }
        playerCopy.status = newStatus;
        return playerCopy;
    });
    return { updatedPlayers, needsUpdate };
  }, []);
  
  React.useEffect(() => {
      const statusCheckInterval = setInterval(() => {
          const state = gameStateRef.current;
          if (!state || isSpectator || myPlayerId === null) return;
          
          const { updatedPlayers, needsUpdate } = updateAllPlayerStatuses(state.players);
          if (needsUpdate) {
              let newState = { ...state, players: updatedPlayers };
              const currentHost = state.hostId !== null ? updatedPlayers.find(p => p.id === state.hostId) : null;
              const isHostInvalid = !currentHost || !currentHost.isClaimed || currentHost.isSpectator || (currentHost.status !== 'online' && currentHost.status !== 'away');

              if (isHostInvalid) {
                  newState.hostId = findNextHost(updatedPlayers);
              }
              // Отправляем полное состояние, так как статус влияет на логику хоста
              publishState(newState);
          }
      }, 5000);
      
      return () => clearInterval(statusCheckInterval);
  }, [isSpectator, myPlayerId, publishState, updateAllPlayerStatuses]);


  React.useEffect(() => {
    if (!lastReceivedState) return;

    if (lastReceivedState.isInitial) {
      const initialState = createInitialState();
      initialState.players[0] = {
          ...initialState.players[0],
          name: playerName,
          isClaimed: true,
          status: 'online',
          sessionId: mySessionId,
          lastSeen: Date.now(),
      };
      setMyPlayerId(0);
      initialState.gameMessage = `${playerName} создал(а) игру. Ожидание других игроков...`;
      const stateWithVersion = { ...initialState, version: 1, turnStartTime: Date.now() };
      publishState(stateWithVersion); // Publish the very first state (full)
      return;
    }

    const currentState = gameStateRef.current;
    if (currentState && lastReceivedState.version <= currentState.version && lastReceivedState.version !== undefined) {
      return;
    }

    const myNewData = lastReceivedState.players.find(p => p.sessionId === mySessionId);
    const iAmNowASpectator = lastReceivedState.spectators.some(s => s.id === mySessionId);

    if (myNewData) {
      setMyPlayerId(myNewData.id);
      setIsSpectator(false);
    } else if (iAmNowASpectator) {
      setMyPlayerId(null);
      setIsSpectator(true);
    }

    setGameState(lastReceivedState);

  }, [lastReceivedState, playerName, mySessionId, publishState]);

  const performGameAction = (action) => {
    const currentState = gameStateRef.current;
    if (!currentState) return;
    
    const { updatedPlayers } = updateAllPlayerStatuses(currentState.players);
    const updatedState = { ...currentState, players: updatedPlayers };
    
    action(updatedState);
  };
  
  const gameActions = {
    startOfficialGame: (state) => {
        if (myPlayerId !== state.hostId || state.isGameStarted) return;
        const claimedPlayerCount = state.players.filter(p => p.isClaimed && !p.isSpectator).length;
        if (claimedPlayerCount < 2) {
            publishState({ gameMessage: "Нужно как минимум 2 игрока, чтобы начать." }, true);
            return;
        }
        const firstPlayer = state.players[state.currentPlayerIndex];
        let gameMessage = `Игра началась! Ход ${firstPlayer.name}.`;
        if (!firstPlayer.hasEnteredGame) gameMessage += ` Ему нужно 50+ для входа.`;
        publishState({ ...state, isGameStarted: true, canRoll: true, gameMessage, turnStartTime: Date.now() });
    },
    newGame: (state) => {
        if (myPlayerId !== state.hostId) return;
        const newPlayers = Array.from({ length: 5 }, (_, index) => {
            const oldPlayer = state.players.find(p => p && p.id === index);
            if (oldPlayer && oldPlayer.isClaimed && !oldPlayer.isSpectator) {
                return {
                    ...oldPlayer, 
                    scores: [],
                    hasEnteredGame: false,
                    barrelBolts: 0,
                    justResetFromBarrel: false,
                };
            }
            return { ...createInitialState().players[0], id: index, name: `Игрок ${index + 1}` };
        });
        const hostPlayer = newPlayers.find(p => p.id === state.hostId);
        const gameMessage = newPlayers.filter(p => p.isClaimed && !p.isSpectator).length < 2
            ? `${hostPlayer.name} создал(а) новую игру. Ожидание...`
            : `Новая игра! Ожидание начала от хоста.`;
        publishState({ ...createInitialState(), players: newPlayers, spectators: state.spectators, hostId: state.hostId, currentPlayerIndex: state.hostId, gameMessage, turnStartTime: Date.now() });
    },
    rollDice: (state) => {
        if (!state.canRoll || state.isGameOver || !state.isGameStarted) return;
        const isHotDiceRoll = state.keptDiceThisTurn.length >= 5;
        const diceToRollCount = isHotDiceRoll ? 5 : 5 - state.keptDiceThisTurn.length;
        const newDice = Array.from({ length: diceToRollCount }, () => Math.floor(Math.random() * 6) + 1);
        const { scoringGroups } = analyzeDice(newDice);
        if (scoringGroups.reduce((s, g) => s + g.score, 0) === 0) { // BOLT
            const currentPlayer = state.players[state.currentPlayerIndex];
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
            const newPlayers = state.players.map((p, i) => i === state.currentPlayerIndex ? updatedPlayer : p);
            const nextPlayerIndex = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
            const nextPlayer = newPlayers[nextPlayerIndex];
            let gameMessage = `${currentPlayer.name} получает болт! Ход ${nextPlayer.name}.`;
            if (!nextPlayer.hasEnteredGame) gameMessage += ` Ему нужно 50+ для входа.`;
            publishState({ ...createInitialState(), players: newPlayers.map(p => ({ ...p, justResetFromBarrel: false })), spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameStarted: true, currentPlayerIndex: nextPlayerIndex, diceOnBoard: newDice, gameMessage, turnStartTime: Date.now(), canRoll: true });
        } else {
            publishState({ ...state, diceOnBoard: newDice, keptDiceThisTurn: isHotDiceRoll ? [] : state.keptDiceThisTurn, diceKeptFromThisRoll: [], scoreFromPreviousRolls: state.currentTurnScore, gameMessage: `Ваш бросок. Выберите очковые кости.`, canRoll: false, canBank: true, selectedDiceIndices: [], canKeep: false, potentialScore: 0 });
        }
    },
    toggleDieSelection: (state, { index }) => {
        if (state.isGameOver || state.diceOnBoard.length === 0) return;
        const newSelectedIndices = state.selectedDiceIndices.includes(index)
            ? state.selectedDiceIndices.filter(i => i !== index)
            : [...state.selectedDiceIndices, index];
        const selectedValues = newSelectedIndices.map(i => state.diceOnBoard[i]);
        let validation = validateSelection(selectedValues);
        if (!validation.isValid && selectedValues.length > 0) {
            const combinedValidation = validateSelection([...state.diceKeptFromThisRoll, ...selectedValues]);
            if (combinedValidation.isValid) {
                validation = { isValid: true, score: combinedValidation.score - validateSelection(state.diceKeptFromThisRoll).score };
            }
        }
        
        const delta = {
            selectedDiceIndices: newSelectedIndices,
            canKeep: validation.isValid,
            potentialScore: validation.score > 0 ? validation.score : 0,
            gameMessage: validation.isValid ? `Выбрано +${validation.score}.` : `Выберите корректную комбинацию.`
        };
        publishState(delta, true); // Отправляем только дельту
    },
    keepDice: (state, { indices }) => {
        const combinedDice = [...state.diceKeptFromThisRoll, ...indices.map(i => state.diceOnBoard[i])];
        const validation = validateSelection(combinedDice);
        if (!validation.isValid) {
            publishState({ gameMessage: "Неверный выбор." }, true);
            return;
        }
        const newTurnScore = state.scoreFromPreviousRolls + validation.score;
        const scoreAdded = newTurnScore - state.currentTurnScore;
        const newKeptDiceThisTurn = [...state.keptDiceThisTurn, ...indices.map(i => state.diceOnBoard[i])];
        const newDiceOnBoard = state.diceOnBoard.filter((_, i) => !indices.includes(i));
        const isHotDice = newDiceOnBoard.length === 0;

        const delta = {
            currentTurnScore: newTurnScore,
            keptDiceThisTurn: newKeptDiceThisTurn,
            diceKeptFromThisRoll: isHotDice ? [] : combinedDice,
            diceOnBoard: newDiceOnBoard,
            gameMessage: `+${scoreAdded}! Очки за ход: ${newTurnScore}. ${isHotDice ? 'Все кости сыграли!' : 'Бросайте снова или запишите.'}`,
            canRoll: true,
            canBank: true,
            selectedDiceIndices: [],
            canKeep: false,
            potentialScore: 0
        };
        publishState(delta, true); // Отправляем дельту
    },
    bankScore: (state) => {
        if (!state.canBank || state.isGameOver) return;
        const selectedValues = state.selectedDiceIndices.map(i => state.diceOnBoard[i]);
        const validation = validateSelection([...state.diceKeptFromThisRoll, ...selectedValues]);
        const finalTurnScore = (state.selectedDiceIndices.length > 0 && validation.isValid) 
            ? state.scoreFromPreviousRolls + validation.score 
            : state.currentTurnScore + state.potentialScore;

        const currentPlayer = state.players[state.currentPlayerIndex];
        
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
          const newPlayers = state.players.map((p, i) => i === state.currentPlayerIndex ? updatedPlayer : p);
          const nextIdx = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
          const nextPlayer = newPlayers[nextIdx];
          let msg = `${playerForBolt.name} получает болт. Ход ${nextPlayer.name}.`;
          if (!nextPlayer.hasEnteredGame) msg += ` Ему нужно 50+ для входа.`;
          return { ...createInitialState(), players: newPlayers.map(p => ({...p, justResetFromBarrel: false})), spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameStarted: true, canRoll: true, currentPlayerIndex: nextIdx, gameMessage: msg, turnStartTime: Date.now() };
        };

        if (finalTurnScore === 0) {
            publishState(getBoltState(currentPlayer));
            return;
        }

        if (!currentPlayer.hasEnteredGame && finalTurnScore < 50) {
            const nextIdx = findNextActivePlayer(state.currentPlayerIndex, state.players);
            const nextPlayer = state.players[nextIdx];
            let msg = `${currentPlayer.name} не набрал 50 для входа. Ход ${nextPlayer.name}.`;
            if (!nextPlayer.hasEnteredGame) msg += ` Ему нужно 50+ для входа.`;
            publishState({ ...createInitialState(), players: state.players, spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameStarted: true, canRoll: true, currentPlayerIndex: nextIdx, gameMessage: msg, turnStartTime: Date.now() });
            return;
        }

        const barrelStatus = getPlayerBarrelStatus(currentPlayer);
        const totalBefore = calculateTotalScore(currentPlayer);
        const failedBarrel = (barrelStatus === '200-300' && totalBefore + finalTurnScore < 300) || (barrelStatus === '700-800' && totalBefore + finalTurnScore < 800);

        if (failedBarrel) {
            publishState(getBoltState(currentPlayer, barrelStatus));
            return;
        }
        
        let playersAfterTurn = state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, scores: [...p.scores, finalTurnScore], hasEnteredGame: true, barrelBolts: 0 } : p);
        const newTotal = calculateTotalScore(playersAfterTurn[state.currentPlayerIndex]);
        const newBarrel = (newTotal >= 200 && newTotal < 300) ? '200-300' : (newTotal >= 700 && newTotal < 800) ? '700-800' : null;
        let penaltyMsgs = [];

        let playersWithPenalties = playersAfterTurn.map((p, i) => {
            if (i === state.currentPlayerIndex || !p.isClaimed) return p;
            const oldTotal = calculateTotalScore(state.players[i]);
            const otherBarrel = getPlayerBarrelStatus(state.players[i]);
            if (newBarrel && otherBarrel === newBarrel) {
                penaltyMsgs.push(`${p.name} сбит с бочки.`);
                return { ...p, scores: [...p.scores, (newBarrel === '200-300' ? 150 : 650) - oldTotal] };
            }
            if (totalBefore < oldTotal && newTotal >= oldTotal && oldTotal >= 100) {
                const scoreAfterPenalty = oldTotal - 50;
                const wouldLandOnBarrel = (scoreAfterPenalty >= 200 && scoreAfterPenalty < 300) || (scoreAfterPenalty >= 700 && scoreAfterPenalty < 800);
                if (!wouldLandOnBarrel && !p.justResetFromBarrel) {
                    penaltyMsgs.push(`${p.name} получает штраф -50.`);
                    return { ...p, scores: [...p.scores, -50] };
                }
            }
            return p;
        });
        
        if (newTotal >= 1000) {
            publishState({ ...createInitialState(), players: playersWithPenalties.map(p => ({...p, justResetFromBarrel: false})), spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameOver: true, gameMessage: `${currentPlayer.name} победил, набрав ${newTotal}!` });
            return;
        }

        const nextIdx = findNextActivePlayer(state.currentPlayerIndex, playersWithPenalties);
        const nextPlayer = playersWithPenalties[nextIdx];
        let msg = `${currentPlayer.name} записал ${finalTurnScore}. ${penaltyMsgs.join(' ')} Ход ${nextPlayer.name}.`;
        const nextBarrel = getPlayerBarrelStatus(nextPlayer);
        if (!nextPlayer.hasEnteredGame) msg += ` Ему нужно 50+ для входа.`;
        else if (nextBarrel) msg += ` Он(а) на бочке.`;
        publishState({ ...createInitialState(), players: playersWithPenalties.map(p => ({...p, justResetFromBarrel: false})), spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameStarted: true, canRoll: true, currentPlayerIndex: nextIdx, gameMessage: msg, turnStartTime: Date.now() });
    },
    skipTurn: (state) => {
        if(state.isGameOver || myPlayerId === state.currentPlayerIndex) return;
        const currentPlayer = state.players[state.currentPlayerIndex];
        if(currentPlayer.status === 'online') return;
        const newPlayers = state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, scores: [...p.scores, '/'] } : p);
        const nextIdx = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
        const msg = `${currentPlayer.name} пропустил ход. Ход ${newPlayers[nextIdx].name}.`;
        publishState({ ...createInitialState(), players: newPlayers.map(p => ({...p, justResetFromBarrel: false})), spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameStarted: true, canRoll: true, currentPlayerIndex: nextIdx, gameMessage: msg, turnStartTime: Date.now() });
    },
    kickPlayer: (state, { playerId }) => {
        if (myPlayerId !== state.hostId) return;
        handlePlayerRemoval(playerId, true);
    }
  };

  const handleGameAction = (actionName, payload) => {
    performGameAction(state => gameActions[actionName](state, payload));
  };
  
  const handlePlayerRemoval = (playerIdToRemove, wasKicked = false) => {
    performGameAction((state) => {
      const playerToRemove = state.players.find(p => p.id === playerIdToRemove);
      if (!playerToRemove || !playerToRemove.isClaimed) return;

      const totalScore = calculateTotalScore(playerToRemove);
      const newLeavers = !wasKicked && totalScore > 0 ? { ...state.leavers, [playerToRemove.name]: totalScore } : state.leavers;
      
      let newPlayers = state.players.filter(p => p.isClaimed && p.id !== playerIdToRemove).map((p, index) => ({ ...p, id: index }));
      while (newPlayers.length < 5) {
          newPlayers.push({ ...createInitialState().players[0], id: newPlayers.length, name: `Игрок ${newPlayers.length + 1}` });
      }

      const newHostId = findNextHost(newPlayers);
      const gameWasInProgress = !state.isGameOver && state.isGameStarted;
      let newCurrentPlayerIndex = newHostId !== null ? newHostId : 0;
      if (gameWasInProgress) {
          const oldCurrentPlayer = state.players[state.currentPlayerIndex];
          if (oldCurrentPlayer.id === playerIdToRemove) {
              newCurrentPlayerIndex = findNextActivePlayer(-1, newPlayers); 
          } else {
              const currentPlayerInNewList = newPlayers.find(p => p.sessionId === oldCurrentPlayer.sessionId);
              newCurrentPlayerIndex = currentPlayerInNewList ? currentPlayerInNewList.id : findNextActivePlayer(-1, newPlayers);
          }
      }

      const remainingPlayers = newPlayers.filter(p => p.isClaimed && !p.isSpectator);
      if (gameWasInProgress && remainingPlayers.length < 2 && state.players.filter(p => p.isClaimed && !p.isSpectator).length >= 2) {
          publishState({ ...state, players: newPlayers, hostId: newHostId, leavers: newLeavers, isGameOver: true, gameMessage: remainingPlayers.length === 1 ? `${remainingPlayers[0].name} победил, все вышли!` : 'Все вышли.' });
      } else {
          let message = `${playerToRemove.name} ${wasKicked ? 'был исключен' : 'вышел'}.`;
          if (gameWasInProgress && state.players[state.currentPlayerIndex].id === playerIdToRemove) {
              message += ` Ход ${newPlayers[newCurrentPlayerIndex].name}.`;
          }
          let finalState = { ...state, players: newPlayers, hostId: newHostId, leavers: newLeavers, currentPlayerIndex: newCurrentPlayerIndex, gameMessage: message };
          if (state.players[state.currentPlayerIndex].id === playerIdToRemove && gameWasInProgress) {
              finalState = { ...finalState, ...createInitialState(), players: newPlayers, hostId: newHostId, leavers: newLeavers, currentPlayerIndex: newCurrentPlayerIndex, gameMessage: message, isGameStarted: true, canRoll: true, turnStartTime: Date.now() };
          }
          publishState(finalState);
      }
    });
  };

  const handleLeaveGame = () => {
    if (isSpectator) {
      const state = gameStateRef.current;
      if(state) publishState({spectators: state.spectators.filter(s => s.id !== mySessionId)}, true);
      return;
    }
    if (myPlayerId !== null) {
      handlePlayerRemoval(myPlayerId, false);
    }
  };

  const handleJoinGame = () => {
    performGameAction(state => {
      if (myPlayerId !== null || isSpectator) return;
      if (state.joinRequests.some(r => r.sessionId === mySessionId)) return;
      
      const availableSlots = state.players.filter(p => !p.isClaimed).length;
      if (availableSlots === 0) {
        if (window.confirm("Нет мест. Присоединиться зрителем?")) {
          const newSpectator = { name: playerName, id: mySessionId };
          publishState({ spectators: [...state.spectators, newSpectator] }, true);
          setIsSpectator(true);
        }
        return;
      }

      if (state.isGameStarted && !state.isGameOver) {
        const newRequest = { name: playerName, sessionId: mySessionId, timestamp: Date.now() };
        publishState({ joinRequests: [...(state.joinRequests || []), newRequest], gameMessage: `${playerName} хочет присоединиться.` }, true);
      } else {
        const joinIndex = state.players.findIndex(p => !p.isClaimed);
        const restoredScore = state.leavers?.[playerName] || 0;
        const newLeavers = { ...state.leavers };
        if (restoredScore > 0) delete newLeavers[playerName];
        const newPlayers = state.players.map((p, i) => i === joinIndex ? { ...p, name: playerName, isClaimed: true, scores: restoredScore > 0 ? [restoredScore] : [], status: 'online', sessionId: mySessionId, hasEnteredGame: restoredScore > 0, lastSeen: Date.now() } : p);
        let newHostId = state.hostId === null ? findNextHost(newPlayers) ?? joinIndex : state.hostId;
        publishState({ ...state, players: newPlayers, leavers: newLeavers, hostId: newHostId, gameMessage: `${playerName} присоединился.` });
      }
    });
  };
  
  const handleJoinRequest = (requestSessionId, accepted) => {
    performGameAction(state => {
      if (myPlayerId !== state.hostId) return;
      const request = (state.joinRequests || []).find(r => r.sessionId === requestSessionId);
      if (!request) return;
      
      const remainingRequests = (state.joinRequests || []).filter(r => r.sessionId !== requestSessionId);
      let newState = { ...state, joinRequests: remainingRequests };

      if (accepted) {
          const joinIndex = newState.players.findIndex(p => !p.isClaimed);
          if (joinIndex !== -1) {
              const newPlayers = newState.players.map((p, i) => i === joinIndex ? { ...p, name: request.name, isClaimed: true, status: 'online', sessionId: request.sessionId, lastSeen: Date.now() } : p);
              newState = { ...newState, players: newPlayers, gameMessage: `${request.name} присоединился.` };
          } else {
              newState = { ...newState, spectators: [...newState.spectators, { name: request.name, id: request.sessionId }], gameMessage: `Для ${request.name} не нашлось места.` };
          }
      } else {
          newState = { ...newState, spectators: [...(newState.spectators || []), { name: request.name, id: request.sessionId }], gameMessage: `Хост отклонил запрос ${request.name}.` };
      }
      publishState(newState);
    });
  };

  return { gameState, myPlayerId, isSpectator, handleGameAction, handleJoinGame, handleLeaveGame, handleJoinRequest };
};

export default useGameEngine;