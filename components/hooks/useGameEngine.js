// hooks/useGameEngine.js
import React from 'react';
import {
  createInitialState,
  analyzeDice,
  validateSelection,
  calculateTotalScore,
  getPlayerBarrelStatus,
  findNextHost,
} from '../../utils/gameLogic.js';

// ====================================================================================
// РЕДЬЮСЕР, ИСПОЛНЯЕМЫЙ НА ВСЕХ КЛИЕНТАХ
// ====================================================================================
const gameReducer = (state, action) => {
    if (!state || !action || !action.type) return state;
    const { type, payload } = action;

    const updateState = (newState) => ({ ...newState, actionSequence: action.sequence ?? newState.actionSequence });

    switch (type) {
        case 'SET_FULL_STATE':
            return { ...payload, actionSequence: payload.actionSequence };

        case 'PLAYER_JOINED': {
            const { joinIndex, player, newHostId, message } = payload;
            const newPlayers = state.players.map((p, i) => i === joinIndex ? player : p);
            return updateState({ ...state, players: newPlayers, hostId: newHostId, gameMessage: message });
        }
        
        case 'JOIN_REQUEST_HANDLED': {
             return updateState({ ...state, joinRequests: state.joinRequests.filter(r => r.sessionId !== payload.sessionId) });
        }

        case 'PLAYER_LEFT': {
            const { playerIndex, newPlayersList, newHostId, finalStateChanges, message } = payload;
            return updateState({ ...state, ...finalStateChanges, players: newPlayersList, hostId: newHostId, gameMessage: message });
        }
        case 'SPECTATOR_JOINED': {
            const { spectator, message } = payload;
            return updateState({ ...state, spectators: [...state.spectators, spectator], gameMessage: message });
        }
        case 'SPECTATOR_LEFT': {
            return updateState({ ...state, spectators: state.spectators.filter(s => s.id !== payload.sessionId) });
        }
        case 'GAME_STARTED': {
            return updateState({ ...state, isGameStarted: true, canRoll: true, gameMessage: payload.message, turnStartTime: Date.now() });
        }
        case 'NEW_GAME_CREATED': {
            return updateState({ ...createInitialState(), ...payload });
        }
        case 'DICE_ROLLED': {
            const { newDice, isHotDiceRoll } = payload;
            return updateState({ ...state, diceOnBoard: newDice, keptDiceThisTurn: isHotDiceRoll ? [] : state.keptDiceThisTurn, diceKeptFromThisRoll: [], scoreFromPreviousRolls: state.currentTurnScore, gameMessage: `${state.players[state.currentPlayerIndex].name} бросает...`, canRoll: false, canBank: true, selectedDiceIndices: [], canKeep: false, potentialScore: 0 });
        }
        case 'DICE_KEPT': {
            const { newTurnScore, scoreAdded, newKeptDiceThisTurn, newDiceOnBoard, isHotDice, combinedDiceAfterKeep } = payload;
            return updateState({
                ...state,
                currentTurnScore: newTurnScore,
                keptDiceThisTurn: newKeptDiceThisTurn,
                diceKeptFromThisRoll: isHotDice ? [] : combinedDiceAfterKeep,
                diceOnBoard: newDiceOnBoard,
                gameMessage: `+${scoreAdded}! Очки за ход: ${newTurnScore}. ${isHotDice ? 'Все кости сыграли!' : 'Бросайте снова или запишите.'}`,
                canRoll: true,
                canBank: true,
                selectedDiceIndices: [],
                canKeep: false,
                potentialScore: 0
            });
        }
        case 'TURN_CHANGED': {
            const { nextPlayerIndex, newPlayers, message } = payload;
            const newState = { ...createInitialState(), players: newPlayers, spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameStarted: true, currentPlayerIndex: nextPlayerIndex, diceOnBoard: payload.diceForBolt || [], gameMessage: message, turnStartTime: Date.now(), canRoll: true, joinRequests: state.joinRequests };
            return { ...newState, actionSequence: payload.actionSequence };
        }
        case 'GAME_OVER': {
             const newState = { ...createInitialState(), players: payload.players, spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameOver: true, gameMessage: payload.message, joinRequests: state.joinRequests };
             return { ...newState, actionSequence: payload.actionSequence };
        }
        case 'UPDATE_PLAYER_STATUS': {
            const { updatedPlayers, newHostId } = payload;
            return { ...state, players: updatedPlayers, hostId: newHostId ?? state.hostId };
        }
        case 'TOGGLE_DIE_SELECTION_LOCAL': {
            if (state.isGameOver || state.diceOnBoard.length === 0) return state;
            const { index } = payload;
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
            return {
                ...state,
                selectedDiceIndices: newSelectedIndices,
                canKeep: validation.isValid,
                potentialScore: validation.score > 0 ? validation.score : 0,
                gameMessage: validation.isValid ? `Выбрано +${validation.score}.` : `Выберите корректную комбинацию.`
            };
        }
        default:
            return state;
    }
};


// ====================================================================================
// ЛОГИКА, ИСПОЛНЯЕМАЯ ТОЛЬКО НА ХОСТЕ
// ====================================================================================
const hostActionHandler = (state, action) => {
    if (!state || !action || !action.type) return [];
    const { type, payload, senderId } = action;
    const player = state.players.find(p => p.sessionId === senderId);
    const playerIndex = player ? player.id : -1;
    
    const isCurrentPlayerAction = ['rollDice', 'keepDice', 'bankScore'].includes(type);
    if (isCurrentPlayerAction && playerIndex !== state.currentPlayerIndex) {
        return [];
    }
    
    const findNextActivePlayer = (startIndex, players) => {
        let nextIndex = (startIndex + 1) % players.length;
        while (nextIndex !== startIndex) {
            if (players[nextIndex].isClaimed && !players[nextIndex].isSpectator) return nextIndex;
            nextIndex = (nextIndex + 1) % players.length;
        }
        const firstActive = players.findIndex(p => p.isClaimed && !p.isSpectator);
        return firstActive !== -1 ? firstActive : startIndex;
    };
    
    let orders = [];

    switch (type) {
        case 'joinGame': {
            const { name, sessionId } = payload;
            if (state.players.some(p => p.sessionId === sessionId) || state.spectators.some(s => s.id === sessionId)) return [];

            if (state.isGameStarted) {
                // Если игра идет, добавляем в запросы на подтверждение
                const newJoinRequests = [...(state.joinRequests || []), { name, sessionId }];
                // Это локальное изменение для хоста, отправляем только обновление state
                 return [{ type: 'LOCAL_STATE_UPDATE', payload: { joinRequests: newJoinRequests } }];
            }

            const joinIndex = state.players.findIndex(p => !p.isClaimed);
            if (joinIndex === -1) {
                orders.push({ type: 'SPECTATOR_JOINED', payload: { spectator: { name, id: sessionId }, message: `${name} присоединился как зритель.` } });
                break;
            }
            
            const newPlayer = { ...state.players[joinIndex], name, isClaimed: true, status: 'online', sessionId, scores: [], hasEnteredGame: false, barrelBolts: 0, lastSeen: Date.now() };
            const newPlayersList = state.players.map((p, i) => i === joinIndex ? newPlayer : p);
            const newHostId = state.hostId === null ? findNextHost(newPlayersList) : state.hostId;
            
            orders.push({ type: 'PLAYER_JOINED', payload: { joinIndex, player: newPlayer, newHostId, message: `${name} присоединился.` } });
            break;
        }
        
         case 'handleJoinRequest': {
            if (senderId !== state.players[state.hostId]?.sessionId) return [];
            const { sessionId, approved } = payload;
            const request = state.joinRequests.find(r => r.sessionId === sessionId);
            if (!request) return [];

            orders.push({ type: 'JOIN_REQUEST_HANDLED', payload: { sessionId } });

            if (approved) {
                const joinIndex = state.players.findIndex(p => !p.isClaimed);
                if (joinIndex !== -1) {
                    const newPlayer = { ...state.players[joinIndex], name: request.name, isClaimed: true, status: 'online', sessionId, scores: [], hasEnteredGame: false, barrelBolts: 0, lastSeen: Date.now() };
                    orders.push({ type: 'PLAYER_JOINED', payload: { joinIndex, player: newPlayer, newHostId: state.hostId, message: `${request.name} присоединился.` } });
                } else {
                    orders.push({ type: 'SPECTATOR_JOINED', payload: { spectator: { name: request.name, id: sessionId }, message: `${request.name} присоединился как зритель.` } });
                }
            }
            break;
        }

        case 'leaveGame': {
            const { sessionId } = payload;
            if (state.spectators.some(s => s.id === sessionId)) {
                orders.push({ type: 'SPECTATOR_LEFT', payload: { sessionId } });
                break;
            }

            const pIndex = state.players.findIndex(p => p.sessionId === sessionId);
            if (pIndex === -1 || !state.players[pIndex].isClaimed) return [];
            
            const playerToRemove = state.players[pIndex];
            let newPlayersList = state.players.map(p => p.id === pIndex ? { ...createInitialState().players[0], id: p.id, name: `Игрок ${p.id + 1}` } : p);
            const newHostId = findNextHost(newPlayersList);
            let finalStateChanges = {};
            let message = `${playerToRemove.name} вышел.`;
            
            const remainingPlayersCount = newPlayersList.filter(p => p.isClaimed && !p.isSpectator).length;
            if (state.isGameStarted && !state.isGameOver && remainingPlayersCount < 2) {
                finalStateChanges = { isGameOver: true };
                message = "Недостаточно игроков, игра окончена.";
                orders.push({ type: 'PLAYER_LEFT', payload: { playerIndex: pIndex, newPlayersList, newHostId, finalStateChanges, message } });
            } else if (state.currentPlayerIndex === pIndex) {
                const nextPlayerIndex = findNextActivePlayer(state.currentPlayerIndex - 1, newPlayersList);
                const turnChangePayload = { nextPlayerIndex, newPlayers: newPlayersList, message: `${playerToRemove.name} вышел. Ход ${newPlayersList[nextPlayerIndex].name}.`, actionSequence: state.actionSequence + 1 };
                orders.push({ type: 'TURN_CHANGED', payload: turnChangePayload });
            } else {
                 orders.push({ type: 'PLAYER_LEFT', payload: { playerIndex: pIndex, newPlayersList, newHostId, finalStateChanges, message } });
            }
            break;
        }
        
        case 'startOfficialGame': {
            if (senderId !== state.players[state.hostId]?.sessionId) return [];
            orders.push({ type: 'GAME_STARTED', payload: { message: `Игра началась! Ход ${state.players[state.currentPlayerIndex].name}.` } });
            break;
        }

        case 'rollDice': {
            if (!state.canRoll || state.isGameOver || !state.isGameStarted) return [];
            
            const isHotDiceRoll = state.keptDiceThisTurn.length >= 5;
            const diceToRollCount = isHotDiceRoll ? 5 : 5 - state.keptDiceThisTurn.length;
            const newDice = Array.from({ length: diceToRollCount }, () => Math.floor(Math.random() * 6) + 1);

            const { scoringGroups } = analyzeDice(newDice);
            if (scoringGroups.length === 0) { // BOLT
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
                
                const payload = { nextPlayerIndex, newPlayers: newPlayers.map(p => ({ ...p, justResetFromBarrel: false })), message: gameMessage, diceForBolt: newDice, actionSequence: state.actionSequence + 1 };
                orders.push({ type: 'TURN_CHANGED', payload });

            } else {
                orders.push({ type: 'DICE_ROLLED', payload: { newDice, isHotDiceRoll } });
            }
            break;
        }
        
        case 'keepDice': {
            const { indices } = payload;
            if (!indices) return [];
            const selectedDice = indices.map(i => state.diceOnBoard[i]);
            
            const selectionValidation = validateSelection(selectedDice);
            const combinedDice = [...state.diceKeptFromThisRoll, ...selectedDice];
            const combinedValidation = validateSelection(combinedDice);

            if (!selectionValidation.isValid && !combinedValidation.isValid) return [];
            
            const scoreForThisKeep = combinedValidation.isValid ? combinedValidation.score - validateSelection(state.diceKeptFromThisRoll).score : selectionValidation.score;

            const newTurnScore = state.currentTurnScore + scoreForThisKeep;
            const newKeptDiceThisTurn = [...state.keptDiceThisTurn, ...selectedDice];
            const newDiceOnBoard = state.diceOnBoard.filter((_, i) => !indices.includes(i));
            const isHotDice = newDiceOnBoard.length === 0;

            orders.push({ type: 'DICE_KEPT', payload: { newTurnScore, scoreAdded: scoreForThisKeep, newKeptDiceThisTurn, newDiceOnBoard, isHotDice, combinedDiceAfterKeep: combinedDice } });
            break;
        }
        
        case 'bankScore': {
            if (!state.canBank || state.isGameOver) return [];
            
            const finalTurnScore = state.currentTurnScore + state.potentialScore;
            const currentPlayer = state.players[state.currentPlayerIndex];
            
            const createBoltTurn = (playerForBolt, barrelStatus, customMsg) => {
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
                let msg = customMsg || `${playerForBolt.name} получает болт. Ход ${nextPlayer.name}.`;
                if (!nextPlayer.hasEnteredGame) msg += ` Ему нужно 50+ для входа.`;
                return [{ type: 'TURN_CHANGED', payload: { nextPlayerIndex: nextIdx, newPlayers: newPlayers.map(p => ({...p, justResetFromBarrel: false})), message: msg, actionSequence: state.actionSequence + 1 } }];
            };

            if (finalTurnScore === 0) { orders = createBoltTurn(currentPlayer); break; }
            if (!currentPlayer.hasEnteredGame && finalTurnScore < 50) {
                const msg = `${currentPlayer.name} не набрал 50 для входа. Болт!`;
                orders = createBoltTurn(currentPlayer, null, msg);
                break;
            }

            const barrelStatus = getPlayerBarrelStatus(currentPlayer);
            const totalBefore = calculateTotalScore(currentPlayer);
            const failedBarrel = (barrelStatus === '200-300' && totalBefore + finalTurnScore < 300) || (barrelStatus === '700-800' && totalBefore + finalTurnScore < 800);
            if (failedBarrel) { orders = createBoltTurn(currentPlayer, barrelStatus); break; }
            
            let playersAfterTurn = state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, scores: [...p.scores, finalTurnScore], hasEnteredGame: true, barrelBolts: 0 } : p);
            const newTotal = calculateTotalScore(playersAfterTurn[state.currentPlayerIndex]);
            const newBarrel = (newTotal >= 200 && newTotal < 300) ? '200-300' : (newTotal >= 700 && newTotal < 800) ? '700-800' : null;
            let penaltyMsgs = [];

            let playersWithPenalties = playersAfterTurn.map((p, i) => {
                if (i === state.currentPlayerIndex || !p.isClaimed || p.justResetFromBarrel) return p;
                const oldTotal = calculateTotalScore(state.players[i]);
                const otherBarrel = getPlayerBarrelStatus(state.players[i]);
                if (newBarrel && otherBarrel === newBarrel) {
                    penaltyMsgs.push(`${p.name} сбит с бочки.`);
                    return { ...p, scores: [...p.scores, (newBarrel === '200-300' ? 150 : 650) - oldTotal] };
                }
                if (totalBefore < oldTotal && newTotal >= oldTotal && oldTotal >= 100) {
                    const scoreAfterPenalty = oldTotal - 50;
                    const wouldLandOnBarrel = (scoreAfterPenalty >= 200 && scoreAfterPenalty < 300) || (scoreAfterPenalty >= 700 && scoreAfterPenalty < 800);
                    if (!wouldLandOnBarrel) {
                        penaltyMsgs.push(`${p.name} получает штраф -50.`);
                        return { ...p, scores: [...p.scores, -50] };
                    }
                }
                return p;
            });
            
            if (newTotal >= 1000) {
                const payload = { players: playersWithPenalties.map(p => ({...p, justResetFromBarrel: false})), message: `${currentPlayer.name} победил, набрав ${newTotal}!`, actionSequence: state.actionSequence + 1 };
                orders.push({ type: 'GAME_OVER', payload });
                break;
            }

            const nextIdx = findNextActivePlayer(state.currentPlayerIndex, playersWithPenalties);
            const nextPlayer = playersWithPenalties[nextIdx];
            let msg = `${currentPlayer.name} записал ${finalTurnScore}. ${penaltyMsgs.join(' ')} Ход ${nextPlayer.name}.`;
            if (!nextPlayer.hasEnteredGame) msg += ` Ему нужно 50+ для входа.`;
            else if (getPlayerBarrelStatus(nextPlayer)) msg += ` Он(а) на бочке.`;
            
            const payload = { nextPlayerIndex: nextIdx, newPlayers: playersWithPenalties.map(p => ({...p, justResetFromBarrel: false})), message: msg, actionSequence: state.actionSequence + 1 };
            orders.push({ type: 'TURN_CHANGED', payload });
            break;
        }

        default:
            return [];
    }
    return orders;
};


const useGameEngine = (lastReceivedState, lastReceivedAction, lastReceivedSyncRequest, publishState, publishAction, requestStateSync, playerName, mySessionId) => {
  const [gameState, setGameState] = React.useState(null);
  const [actionBuffer, setActionBuffer] = React.useState({});
  const [isLocked, setIsLocked] = React.useState(false); // Состояние блокировки UI
  
  const gameStateRef = React.useRef(gameState);
  const syncRequestTimerRef = React.useRef(null);
  
  React.useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const myPlayerId = React.useMemo(() => {
    return gameState?.players.find(p => p.sessionId === mySessionId)?.id ?? null;
  }, [gameState, mySessionId]);

  const isSpectator = React.useMemo(() => {
    return gameState?.spectators.some(s => s.id === mySessionId) ?? false;
  }, [gameState, mySessionId]);

  const isHost = gameState && myPlayerId !== null && myPlayerId === gameState.hostId;

  const processActionQueue = React.useCallback((state) => {
    let currentState = state;
    let nextSequence = (currentState?.actionSequence || 0) + 1;
    let processed = false;
    
    const bufferCopy = {...actionBuffer};

    while (bufferCopy[nextSequence]) {
        const actionToApply = bufferCopy[nextSequence];
        currentState = gameReducer(currentState, actionToApply);
        delete bufferCopy[nextSequence];
        nextSequence++;
        processed = true;
    }
    
    if (processed) {
        setGameState(currentState);
        setActionBuffer(bufferCopy);
        setIsLocked(false); // Снимаем блокировку после применения действия
    }

    if (Object.keys(bufferCopy).length > 0) {
        resetSyncTimer();
    } else {
        clearTimeout(syncRequestTimerRef.current);
    }
  }, [actionBuffer, setActionBuffer, setIsLocked, resetSyncTimer]);

  const resetSyncTimer = React.useCallback(() => {
      clearTimeout(syncRequestTimerRef.current);
      syncRequestTimerRef.current = setTimeout(() => {
          console.warn(`[Sync] Waited too long for sequence #${(gameStateRef.current?.actionSequence || 0) + 1}. Requesting full sync.`);
          requestStateSync();
          setIsLocked(true); // Блокируем UI пока ждем синхронизацию
      }, 5000);
  }, [requestStateSync]);

  React.useEffect(() => {
    if (!lastReceivedAction) return;

    if (lastReceivedAction.type === 'presenceUpdate') {
      const playerIdx = gameStateRef.current?.players.findIndex(p => p.sessionId === lastReceivedAction.payload.sessionId);
      if (playerIdx !== -1 && gameStateRef.current.players[playerIdx].isClaimed) {
          setGameState(prevState => {
              if(!prevState) return null;
              const updatedPlayers = [...prevState.players];
              updatedPlayers[playerIdx] = { ...updatedPlayers[playerIdx], lastSeen: Date.now(), status: 'online' };
              const newHostId = findNextHost(updatedPlayers);
              return { ...prevState, players: updatedPlayers, hostId: newHostId };
          });
      }
      return;
    }

    if (!gameStateRef.current || !('sequence' in lastReceivedAction)) return;
    
    const currentSequence = gameStateRef.current.actionSequence || 0;
    const receivedSequence = lastReceivedAction.sequence;

    if (receivedSequence <= currentSequence) return;

    const newBuffer = { ...actionBuffer, [receivedSequence]: lastReceivedAction };
    setActionBuffer(newBuffer);

    if (receivedSequence === currentSequence + 1) {
        clearTimeout(syncRequestTimerRef.current);
        processActionQueue(gameStateRef.current);
    } else {
        resetSyncTimer();
    }

  }, [lastReceivedAction, processActionQueue, actionBuffer, resetSyncTimer]);

  React.useEffect(() => {
      if (lastReceivedAction && isHost) {
          let orders = hostActionHandler(gameStateRef.current, lastReceivedAction);
          if (orders.length > 0) {
              if(orders[0].type === 'LOCAL_STATE_UPDATE') {
                  setGameState(prevState => ({...prevState, ...orders[0].payload}));
              } else {
                  orders.forEach((order, index) => {
                      const sequence = (gameStateRef.current.actionSequence || 0) + 1 + index;
                      publishAction(order.type, order.payload, sequence);
                  });
              }
          }
      }
  }, [lastReceivedAction, isHost, publishAction]);

  React.useEffect(() => {
    if (!lastReceivedState) return;
    
    if (lastReceivedState.isInitial) {
      const initialState = createInitialState();
      initialState.actionSequence = 0;
      initialState.players[0] = { ...initialState.players[0], name: playerName, isClaimed: true, status: 'online', sessionId: mySessionId, lastSeen: Date.now() };
      initialState.hostId = 0;
      initialState.gameMessage = `${playerName} создал(а) игру. Ожидание...`;
      const stateToPublish = { ...initialState, version: 1 };
      setGameState(stateToPublish);
      publishState(stateToPublish);
      return;
    }
    
    setGameState(lastReceivedState);
    setIsLocked(false); // Снимаем блокировку после полной синхронизации
    clearTimeout(syncRequestTimerRef.current);

    const newBuffer = {};
    for (const seq in actionBuffer) {
        if (parseInt(seq) > lastReceivedState.actionSequence) {
            newBuffer[seq] = actionBuffer[seq];
        }
    }
    setActionBuffer(newBuffer);
    if(Object.keys(newBuffer).length > 0) {
        processActionQueue(lastReceivedState);
    }

  }, [lastReceivedState, playerName, mySessionId, publishState, processActionQueue, actionBuffer]);

  React.useEffect(() => {
      if (lastReceivedSyncRequest && isHost && gameStateRef.current) {
          publishState({ ...gameStateRef.current, isFullSync: true });
      }
  }, [lastReceivedSyncRequest, isHost, publishState]);

  const requestGameAction = (type, payload = {}) => {
      if (type === 'toggleDieSelection') {
          if (isLocked) return; // Не позволяем выбирать кости, пока UI заблокирован
          setGameState(currentState => gameReducer(currentState, {type: 'TOGGLE_DIE_SELECTION_LOCAL', payload}));
          return;
      }
      
      setIsLocked(true); // Блокируем UI для любого действия, требующего ответа хоста
      publishAction(type, payload);
  };
  
  const handleJoinGame = () => {
    requestGameAction('joinGame', { name: playerName, sessionId: mySessionId });
  };

  const handleLeaveGame = () => {
    requestGameAction('leaveGame', { sessionId: mySessionId });
  };
  
  return { gameState, myPlayerId, isSpectator, isLocked, requestGameAction, handleJoinGame, handleLeaveGame };
};

export default useGameEngine;