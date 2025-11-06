// 
import React from 'react';
import { MQTT_BROKER_URL, MQTT_TOPIC_PREFIX } from '../constants.js';
import { analyzeDice, validateSelection, calculateTotalScore, createInitialState, findNextHost, getPlayerBarrelStatus } from '../utils/gameLogic.js';
import RulesModal from './RulesModal.js';
import SpectatorsModal from './SpectatorsModal.js';
import { DiceIcon, SmallDiceIcon } from './Dice.js';

const Game = ({ roomCode, playerName, onExit }) => {
  const [gameState, setGameState] = React.useState(null);
  const [myPlayerId, setMyPlayerId] = React.useState(null);
  const [isSpectator, setIsSpectator] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState('connecting');
  const [isScoreboardExpanded, setIsScoreboardExpanded] = React.useState(false);
  const [isSpectatorsModalOpen, setIsSpectatorsModalOpen] = React.useState(false);
  const [showRules, setShowRules] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  
  const mqttClientRef = React.useRef(null);
  const isStateReceivedRef = React.useRef(false);
  const lastSeenTimestampsRef = React.useRef({});
  const gameStateRef = React.useRef(); // Ref to hold the latest game state for intervals/callbacks
  const mySessionIdRef = React.useRef(sessionStorage.getItem('tysiacha-sessionId') || `sid_${Math.random().toString(36).substr(2, 9)}`);

  React.useEffect(() => {
    // Ensure sessionId is saved for the session
    if (!sessionStorage.getItem('tysiacha-sessionId')) {
      sessionStorage.setItem('tysiacha-sessionId', mySessionIdRef.current);
    }
  }, []);

  // Keep the ref updated with the latest state
  React.useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  React.useEffect(() => {
    if (playerName) {
      document.title = `Тысяча (${playerName}) - онлайн игра в кости`;
    }
    return () => {
      document.title = 'Тысяча - Онлайн Игра в Кости';
    };
  }, [playerName]);

  const topic = `${MQTT_TOPIC_PREFIX}/${roomCode}`;
  const presenceTopic = `${topic}/presence`;
  
  // This effect ensures the session is saved when a player ID is assigned
  React.useEffect(() => {
    if (myPlayerId !== null) {
        const sessionData = { roomCode, playerName, myPlayerId };
        localStorage.setItem('tysiacha-session', JSON.stringify(sessionData));
        // Save the last room the user actively played in
        if (!isSpectator) {
          localStorage.setItem('tysiacha-lastRoom', roomCode);
        }
    }
  }, [myPlayerId, roomCode, playerName, isSpectator]);

  const publishState = React.useCallback((newState, isOptimisticUpdate = false) => {
    if (mqttClientRef.current && mqttClientRef.current.connected) {
      const currentVersion = gameStateRef.current?.version || 0;
      // Ensure we don't pass the senderId from a received state back into a new state
      const { senderId, ...stateWithoutSender } = newState; 
      
      const finalState = {
        ...stateWithoutSender,
        version: currentVersion + 1,
        senderId: mySessionIdRef.current, // Use sessionId as senderId for better tracking
      };

      if (isOptimisticUpdate && myPlayerId !== null) {
        setGameState(finalState);
      }
      
      mqttClientRef.current.publish(topic, JSON.stringify(finalState), { retain: true });
    }
  }, [topic, myPlayerId]);

  const findNextActivePlayer = React.useCallback((startIndex, players) => {
      let nextIndex = (startIndex + 1) % players.length;
      while (nextIndex !== startIndex) {
          if (players[nextIndex].isClaimed && !players[nextIndex].isSpectator) {
              return nextIndex;
          }
          nextIndex = (nextIndex + 1) % players.length;
      }
      // If loop completes, it means either 0 or 1 player is left.
      // Find the first available player, or return the original index if none.
      const firstActive = players.findIndex(p => p.isClaimed && !p.isSpectator);
      return firstActive !== -1 ? firstActive : startIndex;
  }, []);


  React.useEffect(() => {
    const client = mqtt.connect(MQTT_BROKER_URL);
    mqttClientRef.current = client;
    isStateReceivedRef.current = false;

    client.on('connect', () => {
      setConnectionStatus('connected');
      client.subscribe(topic);
      client.subscribe(presenceTopic);

      setTimeout(() => {
        if (!isStateReceivedRef.current) {
            const initialState = createInitialState();
            initialState.players[0] = {
                ...initialState.players[0],
                name: playerName,
                isClaimed: true,
                status: 'online',
                sessionId: mySessionIdRef.current,
            };
            setMyPlayerId(0);
            initialState.gameMessage = `${playerName} создал(а) игру. Ожидание других игроков...`;
            const stateWithVersion = { ...initialState, version: 1, turnStartTime: Date.now() };
            setGameState(stateWithVersion);
            client.publish(topic, JSON.stringify(stateWithVersion), { retain: true });
        }
      }, 1500);
    });
    
    client.on('message', (receivedTopic, message) => {
        if (receivedTopic === topic) {
            isStateReceivedRef.current = true;
            try {
                const receivedState = JSON.parse(message.toString());
                
                setGameState(currentState => {
                    if (currentState && receivedState.version <= currentState.version) {
                        return currentState; // Old or same version, ignore.
                    }

                    // --- Self-identification ---
                    const myNewData = receivedState.players.find(p => p.sessionId === mySessionIdRef.current);
                    const iAmNowASpectator = receivedState.spectators.some(s => s.id === mySessionIdRef.current);
                    
                    if(isSpectator && !iAmNowASpectator) {
                        // If I thought I was a spectator, but the new state doesn't have me, it means I was rejected.
                        // But if I AM in the player list now, it means I was accepted.
                        if(!myNewData) {
                            // A special case message if the host rejects the request.
                            const myRequest = currentState?.joinRequests?.find(r => r.sessionId === mySessionIdRef.current);
                            if(myRequest) {
                                alert('Хост отклонил ваш запрос или время ожидания истекло. Вы переведены в зрители.');
                            }
                        }
                    }


                    if (myNewData) {
                        setMyPlayerId(myNewData.id);
                        setIsSpectator(false); // If I'm a player, I'm not a spectator
                    } else if (iAmNowASpectator) {
                        setMyPlayerId(null);
                        setIsSpectator(true);
                    } else {
                        const iWasInTheGameBefore = currentState ? (
                            currentState.players.some(p => p.sessionId === mySessionIdRef.current) ||
                            currentState.spectators.some(s => s.id === mySessionIdRef.current) ||
                            currentState.joinRequests?.some(r => r.sessionId === mySessionIdRef.current)
                        ) : (myPlayerId !== null || isSpectator);

                        if (iWasInTheGameBefore) {
                           // If I was in the game but am no longer, I was kicked or left. Exit to lobby.
                           // Unless I am just waiting for approval.
                           const isStillWaiting = receivedState.joinRequests?.some(r => r.sessionId === mySessionIdRef.current);
                           if (!isStillWaiting) {
                               onExit();
                           }
                        }
                    }
                    return receivedState;
                });
            } catch (e) { console.error('Error parsing game state:', e); }
        }
        if (receivedTopic === presenceTopic) {
             try {
                const { playerId } = JSON.parse(message.toString());
                lastSeenTimestampsRef.current[playerId] = Date.now();
            } catch (e) { /* ignore parse error */ }
        }
    });

    // Heartbeat interval
    const heartbeatInterval = setInterval(() => {
        if (client.connected && myPlayerId !== null && !isSpectator) {
            client.publish(presenceTopic, JSON.stringify({ playerId: myPlayerId }));
        }
    }, 5000);

    // Status checking interval: Each client checks everyone to prevent stale host issues.
    const statusCheckInterval = setInterval(() => {
        const localGameState = gameStateRef.current;
        if (!localGameState || isSpectator || myPlayerId === null) {
            return;
        }

        const now = Date.now();
        let needsUpdate = false;
        const activePlayersCountBeforeUpdate = localGameState.players.filter(p => p.isClaimed && !p.isSpectator).length;

        const newPlayers = localGameState.players.map(p => {
            const playerCopy = {...p};
            if (!playerCopy.isClaimed || playerCopy.isSpectator) {
                return playerCopy;
            }
            
            const lastSeen = lastSeenTimestampsRef.current[playerCopy.id] || 0;
            
            // Timeout check (10 minutes)
            if (now - lastSeen > 600000 && playerCopy.isClaimed) {
                // If player is still marked as claimed, mark them as having left.
                needsUpdate = true;
                return { ...playerCopy, isClaimed: false, status: 'offline' };
            }

            // Status update check
            let newStatus = playerCopy.status;

            if (lastSeen === 0 && (playerCopy.status === 'online' || playerCopy.status === 'away')) {
                // Ничего не делаем, ждем первый heartbeat.
            } else if (now - lastSeen > 60000) {
                newStatus = 'disconnected';
            } else if (now - lastSeen > 10000) {
                newStatus = 'away';
            } else if (lastSeen > 0) {
                newStatus = 'online';
            }

            if (newStatus !== playerCopy.status) {
                needsUpdate = true;
                playerCopy.status = newStatus;
            }
            return playerCopy;
        });

        if (needsUpdate) {
            let newState = { ...localGameState, players: newPlayers };
            
            let newHostId = localGameState.hostId;
            const currentHost = localGameState.hostId !== null ? newPlayers.find(p => p.id === localGameState.hostId) : null;
    
            // Re-evaluate host if: there is no host, the current host is gone, or the current host is not 'online'.
            if (localGameState.hostId === null || !currentHost || !currentHost.isClaimed || currentHost.isSpectator || currentHost.status !== 'online') {
                newHostId = findNextHost(newPlayers);
            }
            newState.hostId = newHostId;
            
            const remainingPlayersAfterUpdate = newPlayers.filter(p => p.isClaimed && !p.isSpectator);
            
            if (remainingPlayersAfterUpdate.length === 1 && activePlayersCountBeforeUpdate > 1 && !localGameState.isGameOver) {
                 publishState({
                    ...newState,
                    isGameOver: true,
                    gameMessage: `${remainingPlayersAfterUpdate[0].name} победил, так как все остальные игроки вышли!`,
                });
                return;
            }
            
            publishState(newState);
        }
    }, 5000);

    client.on('error', () => setConnectionStatus('error'));
    client.on('offline', () => setConnectionStatus('reconnecting'));
    client.on('reconnect', () => setConnectionStatus('reconnecting'));

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(statusCheckInterval);
      if (client) client.end();
    };
  }, [roomCode, playerName, onExit]);


  // --- Game Logic Actions ---
  const handleStartOfficialGame = () => {
    const state = gameState;
    if (myPlayerId !== state.hostId || state.isGameStarted) return;

    const claimedPlayerCount = state.players.filter(p => p.isClaimed && !p.isSpectator).length;
    if (claimedPlayerCount < 2) {
        publishState({ ...state, gameMessage: "Нужно как минимум 2 игрока, чтобы начать." });
        return;
    }
    
    const firstPlayer = state.players[state.currentPlayerIndex];
    let gameMessage = `Игра началась! Ход ${firstPlayer.name}.`;
    if (!firstPlayer.hasEnteredGame) {
        gameMessage += ` Ему нужно 50+ для входа.`;
    }

    publishState({
        ...state,
        isGameStarted: true,
        canRoll: true,
        gameMessage: gameMessage,
        turnStartTime: Date.now(),
    });
  };

  const handleRollDice = () => {
    const state = gameState;
    if (!state.canRoll || state.isGameOver || !state.isGameStarted) return;

    const isHotDiceRoll = state.keptDiceThisTurn.length >= 5;
    const diceToRollCount = isHotDiceRoll ? 5 : 5 - state.keptDiceThisTurn.length;
    const newDice = Array.from({ length: diceToRollCount }, () => Math.floor(Math.random() * 6) + 1);
    const { scoringGroups } = analyzeDice(newDice);
    const rollScore = scoringGroups.reduce((sum, group) => sum + group.score, 0);

    if (rollScore === 0) { // BOLT!
      const currentPlayerForBolt = state.players[state.currentPlayerIndex];
      let updatedPlayer = {
        ...currentPlayerForBolt,
        scores: [...currentPlayerForBolt.scores, '/'],
      };

      const barrelStatus = getPlayerBarrelStatus(currentPlayerForBolt);
      if (barrelStatus) {
        const newBarrelBolts = (updatedPlayer.barrelBolts || 0) + 1;
        updatedPlayer.barrelBolts = newBarrelBolts;

        if (newBarrelBolts >= 3) {
          const totalScore = calculateTotalScore(currentPlayerForBolt);
          let penalty = 0;
          if (barrelStatus === '200-300') {
            penalty = 150 - totalScore;
          } else if (barrelStatus === '700-800') {
            penalty = 650 - totalScore;
          }
          updatedPlayer.scores.push(penalty);
          updatedPlayer.barrelBolts = 0; // Reset after penalty
        }
      }
      
      const newPlayers = state.players.map((player, index) =>
        index === state.currentPlayerIndex ? updatedPlayer : player
      );
      const nextPlayerIndex = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
      const nextPlayer = newPlayers[nextPlayerIndex];

      let gameMessage = `${state.players[state.currentPlayerIndex].name} получает болт! Ход ${nextPlayer.name}.`;
      if (!nextPlayer.hasEnteredGame) {
        gameMessage += ` Ему нужно 50+ для входа.`;
      }

      const boltState = {
        ...createInitialState(),
        players: newPlayers,
        spectators: state.spectators,
        leavers: state.leavers,
        hostId: state.hostId,
        isGameStarted: true, // Keep game started
        currentPlayerIndex: nextPlayerIndex,
        diceOnBoard: newDice,
        gameMessage: gameMessage,
        turnStartTime: Date.now(),
        canRoll: true,
      };
      publishState(boltState, true);
      return;
    }
    
    const newState = {
      ...state,
      diceOnBoard: newDice,
      keptDiceThisTurn: isHotDiceRoll ? [] : state.keptDiceThisTurn,
      diceKeptFromThisRoll: [],
      scoreFromPreviousRolls: state.currentTurnScore,
      gameMessage: `Ваш бросок. Выберите и перетащите очковые кости.`,
      canRoll: false,
      canBank: true,
      selectedDiceIndices: [],
      canKeep: false,
      potentialScore: 0,
    };
    publishState(newState, true);
  };
  
  const handleToggleDieSelection = (index) => {
    if (gameState.isGameOver || gameState.diceOnBoard.length === 0) return;
    
    const newSelectedIndices = [...gameState.selectedDiceIndices];
    const existingIndex = newSelectedIndices.indexOf(index);
    if (existingIndex > -1) {
        newSelectedIndices.splice(existingIndex, 1);
    } else {
        newSelectedIndices.push(index);
    }
    
    const selectedValues = newSelectedIndices.map(i => gameState.diceOnBoard[i]);
    
    let validation = validateSelection(selectedValues);
    if (!validation.isValid && selectedValues.length > 0) {
        const combinedValidation = validateSelection([...gameState.diceKeptFromThisRoll, ...selectedValues]);
        if (combinedValidation.isValid) {
            const currentRollScore = validateSelection(gameState.diceKeptFromThisRoll).score;
            validation = { isValid: true, score: combinedValidation.score - currentRollScore, values: selectedValues };
        }
    }

    const newState = {
        ...gameState,
        selectedDiceIndices: newSelectedIndices,
        canKeep: validation.isValid,
        potentialScore: validation.score > 0 ? validation.score : 0,
        gameMessage: validation.isValid 
            ? `Выбрано +${validation.score}. Перетащите или дважды кликните, чтобы отложить.`
            : `Выберите корректную комбинацию.`,
    };
    publishState(newState, true);
  };

  const handleKeepDice = (indices) => {
    const state = gameState;
    if (state.isGameOver) return;

    const newlySelectedValues = indices.map(i => state.diceOnBoard[i]);
    const combinedDiceForValidation = [...state.diceKeptFromThisRoll, ...newlySelectedValues];
    const validation = validateSelection(combinedDiceForValidation);

    if (!validation.isValid) {
        const newState = { ...state, gameMessage: "Неверный выбор. Эта кость не образует очковую комбинацию." };
        publishState(newState, true);
        return;
    }

    const scoreOfThisRoll = validation.score;
    const newTurnScore = state.scoreFromPreviousRolls + scoreOfThisRoll;
    const scoreAdded = newTurnScore - state.currentTurnScore;
    const newKeptDiceThisTurn = [...state.keptDiceThisTurn, ...newlySelectedValues];
    const newDiceOnBoard = state.diceOnBoard.filter((_, i) => !indices.includes(i));

    let newState;
    if (newDiceOnBoard.length === 0) { // Hot Dice
       newState = {
        ...state,
        currentTurnScore: newTurnScore,
        keptDiceThisTurn: newKeptDiceThisTurn,
        diceKeptFromThisRoll: [],
        diceOnBoard: [],
        gameMessage: `+${scoreAdded}! Очки за ход: ${newTurnScore}. Все кости сыграли! Бросайте снова.`,
        canRoll: true,
        canBank: true,
        selectedDiceIndices: [],
        canKeep: false,
        potentialScore: 0,
       };
    } else {
        newState = {
            ...state,
            currentTurnScore: newTurnScore,
            keptDiceThisTurn: newKeptDiceThisTurn,
            diceKeptFromThisRoll: combinedDiceForValidation,
            diceOnBoard: newDiceOnBoard,
            gameMessage: `+${scoreAdded}! Очки за ход: ${newTurnScore}. Бросайте снова или запишите.`,
            canRoll: true,
            canBank: true,
            selectedDiceIndices: [],
            canKeep: false,
            potentialScore: 0,
        };
    }
    publishState(newState, true);
  };
  
  const handleBankScore = () => {
    const state = gameState;
    if (!state.canBank || state.isGameOver) return;
    
    let finalTurnScore = state.currentTurnScore + state.potentialScore;
    const selectedValues = state.selectedDiceIndices.map(i => state.diceOnBoard[i]);
    const validation = validateSelection([...state.diceKeptFromThisRoll, ...selectedValues]);
    if(state.selectedDiceIndices.length > 0 && validation.isValid){
        finalTurnScore = state.scoreFromPreviousRolls + validation.score;
    }
    
    const currentPlayer = state.players[state.currentPlayerIndex];
    
    if (finalTurnScore === 0) {
      const currentPlayerForBolt = { ...currentPlayer };
      let updatedPlayer = {
        ...currentPlayerForBolt,
        scores: [...currentPlayerForBolt.scores, '/'],
      };

      const barrelStatus = getPlayerBarrelStatus(currentPlayerForBolt);
      if (barrelStatus) {
        const newBarrelBolts = (updatedPlayer.barrelBolts || 0) + 1;
        updatedPlayer.barrelBolts = newBarrelBolts;
        if (newBarrelBolts >= 3) {
          const totalScore = calculateTotalScore(currentPlayerForBolt);
          let penalty = 0;
          if (barrelStatus === '200-300') {
            penalty = 150 - totalScore;
          } else if (barrelStatus === '700-800') {
            penalty = 650 - totalScore;
          }
          updatedPlayer.scores.push(penalty);
          updatedPlayer.barrelBolts = 0; // Reset
        }
      }
      const newPlayersWithBolt = state.players.map((p, i) => i === state.currentPlayerIndex ? updatedPlayer : p);
      const nextIdx = findNextActivePlayer(state.currentPlayerIndex, newPlayersWithBolt);
      const nextPlayer = newPlayersWithBolt[nextIdx];
      let msg = `${currentPlayer.name} получает болт. Ход ${nextPlayer.name}.`;
      if (!nextPlayer.hasEnteredGame) msg += ` Ему нужно 50+ для входа.`;
      const boltState = { ...createInitialState(), players: newPlayersWithBolt, spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameStarted: true, canRoll: true, currentPlayerIndex: nextIdx, gameMessage: msg, turnStartTime: Date.now() };
      publishState(boltState, true);
      return;
    }

    // "Старт" - проверка входа в игру
    if (!currentPlayer.hasEnteredGame && finalTurnScore < 50) {
        const nextPlayerIndex = findNextActivePlayer(state.currentPlayerIndex, state.players);
        const nextPlayer = state.players[nextPlayerIndex];
        let msg = `${currentPlayer.name} не набрал(а) 50 очков для входа. Ход ${nextPlayer.name}.`;
        if (!nextPlayer.hasEnteredGame) msg += ` Ему нужно 50+ для входа.`;

        const failEntryState = { 
            ...createInitialState(), 
            players: state.players, 
            spectators: state.spectators, 
            leavers: state.leavers, 
            hostId: state.hostId, 
            isGameStarted: true, 
            canRoll: true, 
            currentPlayerIndex: nextPlayerIndex, 
            gameMessage: msg, 
            turnStartTime: Date.now() 
        };
        publishState(failEntryState, true);
        return;
    }
    
    // "Бочки" - Barrel logic
    const totalScoreBeforeTurn = calculateTotalScore(currentPlayer);
    const barrelStatus = getPlayerBarrelStatus(currentPlayer);
    let turnFailedBarrel = false;

    if (barrelStatus === '200-300' && (totalScoreBeforeTurn + finalTurnScore < 300)) {
        turnFailedBarrel = true;
    } else if (barrelStatus === '700-800' && (totalScoreBeforeTurn + finalTurnScore < 800)) {
        turnFailedBarrel = true;
    }

    if (turnFailedBarrel) {
        const currentPlayerForBarrelBolt = { ...currentPlayer };
        let updatedPlayer = {
          ...currentPlayerForBarrelBolt,
          scores: [...currentPlayerForBarrelBolt.scores, '/'],
        };
        
        const newBarrelBolts = (updatedPlayer.barrelBolts || 0) + 1;
        updatedPlayer.barrelBolts = newBarrelBolts;
        if (newBarrelBolts >= 3) {
            const totalScore = calculateTotalScore(currentPlayerForBarrelBolt);
            let penalty = 0;
            if (barrelStatus === '200-300') {
                penalty = 150 - totalScore;
            } else if (barrelStatus === '700-800') {
                penalty = 650 - totalScore;
            }
            updatedPlayer.scores.push(penalty);
            updatedPlayer.barrelBolts = 0; // Reset
        }

        const newPlayersWithBarrelBolt = state.players.map((p, i) => i === state.currentPlayerIndex ? updatedPlayer : p);

        const nextPlayerIndex = findNextActivePlayer(state.currentPlayerIndex, newPlayersWithBarrelBolt);
        const nextPlayer = newPlayersWithBarrelBolt[nextPlayerIndex];
        let msg = `${currentPlayer.name} не смог(ла) сойти с бочки. Очки сгорели. Ход ${nextPlayer.name}.`;
        
        const nextPlayerStatus = getPlayerBarrelStatus(nextPlayer);
        if (!nextPlayer.hasEnteredGame) {
            msg += ` Ему нужно 50+ для входа.`;
        } else if (nextPlayerStatus) {
            msg += ` Он(а) на бочке ${nextPlayerStatus}.`;
        }

        const failBarrelState = { 
            ...createInitialState(), 
            players: newPlayersWithBarrelBolt, 
            spectators: state.spectators, 
            leavers: state.leavers, 
            hostId: state.hostId, 
            isGameStarted: true, 
            canRoll: true, 
            currentPlayerIndex: nextPlayerIndex, 
            gameMessage: msg, 
            turnStartTime: Date.now() 
        };
        publishState(failBarrelState, true);
        return;
    }

    // --- Основная логика записи очков и штрафов ---
    
    // 1. Обновляем очки текущего игрока и сбрасываем счетчик болтов на бочке
    let playersAfterTurn = state.players.map((p, i) => {
        if (i === state.currentPlayerIndex) {
            return { ...p, scores: [...p.scores, finalTurnScore], hasEnteredGame: true, barrelBolts: 0 };
        }
        return p;
    });

    const currentPlayerNewTotal = calculateTotalScore(playersAfterTurn[state.currentPlayerIndex]);
    let penaltyMessages = [];

    // 2. Рассчитываем и применяем все штрафы
    const newBarrelStatus = 
        (currentPlayerNewTotal >= 200 && currentPlayerNewTotal < 300) ? '200-300' :
        (currentPlayerNewTotal >= 700 && currentPlayerNewTotal < 800) ? '700-800' : null;

    let playersWithPenalties = playersAfterTurn.map((p, i) => {
        if (i === state.currentPlayerIndex || !p.isClaimed) {
            return p;
        }

        const originalPlayerState = state.players[i];
        const otherPlayerOldTotal = calculateTotalScore(originalPlayerState);
        const penaltiesToAdd = [];

        // Штраф за столкновение на бочке
        if (newBarrelStatus) {
            const otherPlayerBarrelStatus = getPlayerBarrelStatus(originalPlayerState);
            if (otherPlayerBarrelStatus === newBarrelStatus) {
                penaltyMessages.push(`${p.name} сбит с бочки.`);
                let penaltyAmount = 0;
                if (newBarrelStatus === '200-300') {
                    penaltyAmount = 150 - otherPlayerOldTotal;
                } else { // 700-800
                    penaltyAmount = 650 - otherPlayerOldTotal;
                }
                penaltiesToAdd.push(penaltyAmount);
            }
        }
        
        // Штраф за обгон
        if (currentPlayerNewTotal >= otherPlayerOldTotal && otherPlayerOldTotal >= 100) {
            penaltyMessages.push(`${p.name} получает штраф -50.`);
            penaltiesToAdd.push(-50);
        }
        
        if (penaltiesToAdd.length > 0) {
            // Убедимся, что штрафы не дублируются, если игрок уже был оштрафован на бочке
            const uniquePenalties = [...new Set(penaltiesToAdd)];
            return { ...p, scores: [...p.scores, ...uniquePenalties] };
        }
        
        return p;
    });

    // 3. Проверяем на победу с учетом всех изменений
    const finalWinnerScore = calculateTotalScore(playersWithPenalties[state.currentPlayerIndex]);
    if (finalWinnerScore >= 1000) {
      let winMessage = `${currentPlayer.name} победил, набрав ${finalWinnerScore} очков!`;
      if (penaltyMessages.length > 0) {
        winMessage += " " + penaltyMessages.join(" ");
      }
      const winState = { ...createInitialState(), players: playersWithPenalties, spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameOver: true, gameMessage: winMessage };
      publishState(winState, true);
      return;
    }

    // 4. Готовим следующий ход
    const nextPlayerIndex = findNextActivePlayer(state.currentPlayerIndex, playersWithPenalties);
    const nextPlayer = playersWithPenalties[nextPlayerIndex];

    let bankMessage = !currentPlayer.hasEnteredGame
        ? `${currentPlayer.name} вошёл в игру, записав ${finalTurnScore}! Ход ${nextPlayer.name}.`
        : `${currentPlayer.name} записал ${finalTurnScore} очков. Ход ${nextPlayer.name}.`;
    
    if (penaltyMessages.length > 0) {
        bankMessage += " " + [...new Set(penaltyMessages)].join(" ");
    }
    
    const nextPlayerBarrelStatus = getPlayerBarrelStatus(nextPlayer);
    if (!nextPlayer.hasEnteredGame) {
        bankMessage += ` Ему нужно 50+ для входа.`;
    } else if (nextPlayerBarrelStatus) {
        bankMessage += ` Он(а) на бочке ${nextPlayerBarrelStatus}.`;
    }

    const bankState = { ...createInitialState(), players: playersWithPenalties, spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameStarted: true, canRoll: true, currentPlayerIndex: nextPlayerIndex, gameMessage: bankMessage, turnStartTime: Date.now() };
    publishState(bankState, true);
  };

  const handleSkipTurn = () => {
    const state = gameState;
    if(state.isGameOver || myPlayerId === state.currentPlayerIndex) return;
    
    const currentPlayer = state.players[state.currentPlayerIndex];
    if(currentPlayer.status === 'online') return;

    const newPlayers = state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, scores: [...p.scores, '/'] } : p);
    const nextIdx = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
    const nextPlayer = newPlayers[nextIdx];
    let msg = `${currentPlayer.name} пропустил ход. Ход ${nextPlayer.name}.`;
    if(!nextPlayer.hasEnteredGame) msg += ` Ему нужно 50+ для входа.`;
    publishState({ ...createInitialState(), players: newPlayers, spectators: state.spectators, leavers: state.leavers, hostId: state.hostId, isGameStarted: true, canRoll: true, currentPlayerIndex: nextIdx, gameMessage: msg, turnStartTime: Date.now() });
  }

  const handleNewGame = () => {
      if (myPlayerId !== gameState.hostId) return;
      const oldState = gameState;
      const newPlayers = Array.from({ length: 5 }, (_, index) => {
          const oldPlayer = oldState.players.find(p => p && p.id === index);

          if (oldPlayer && oldPlayer.isClaimed && !oldPlayer.isSpectator) {
              return {
                  id: oldPlayer.id,
                  name: oldPlayer.name,
                  scores: [], 
                  isClaimed: true,
                  status: oldPlayer.status,
                  isSpectator: false,
                  sessionId: oldPlayer.sessionId,
                  hasEnteredGame: false,
                  barrelBolts: 0,
              };
          }
          
          const cleanPlayerSlot = createInitialState().players[0];
          return {
              ...cleanPlayerSlot,
              id: index,
              name: `Игрок ${index + 1}`,
          };
      });

      const hostPlayer = newPlayers.find(p => p.id === oldState.hostId);
      const claimedPlayerCount = newPlayers.filter(p => p.isClaimed && !p.isSpectator).length;
      
      let gameMessage;
      if (claimedPlayerCount < 2) {
          gameMessage = `${hostPlayer.name} создал(а) новую игру. Ожидание других игроков...`;
      } else {
          gameMessage = `Новая игра! Ожидание начала от хоста.`;
      }

      const finalState = {
          ...createInitialState(), 
          players: newPlayers, 
          spectators: oldState.spectators, 
          hostId: oldState.hostId,
          currentPlayerIndex: oldState.hostId,
          gameMessage,
          turnStartTime: Date.now(),
      };
      
      publishState(finalState);
  };

  const handleJoinRequest = React.useCallback((requestSessionId, accepted) => {
    const state = gameStateRef.current;
    if (!state || myPlayerId !== state.hostId) return;

    const request = (state.joinRequests || []).find(r => r.sessionId === requestSessionId);
    if (!request) return;

    const remainingRequests = (state.joinRequests || []).filter(r => r.sessionId !== requestSessionId);
    let newState = { ...state, joinRequests: remainingRequests };

    if (accepted) {
        const lastClaimedIndex = newState.players.map(p => p.isClaimed).lastIndexOf(true);
        let joinIndex = newState.players.findIndex((p, i) => !p.isClaimed && i > lastClaimedIndex);
        if (joinIndex === -1) {
            joinIndex = newState.players.findIndex(p => !p.isClaimed);
        }

        if (joinIndex !== -1) {
            const restoredScore = newState.leavers?.[request.name] || 0;
            const initialScores = restoredScore > 0 ? [restoredScore] : [];
            const newLeavers = { ...newState.leavers };
            if (restoredScore > 0) delete newLeavers[request.name];

            const newPlayers = newState.players.map((p, i) =>
                i === joinIndex
                ? { ...p, name: request.name, isClaimed: true, scores: initialScores, status: 'online', isSpectator: false, sessionId: request.sessionId, hasEnteredGame: restoredScore > 0, barrelBolts: 0 } // Восстанавливаем статус входа
                : p
            );
            newState = { ...newState, players: newPlayers, leavers: newLeavers, gameMessage: `${request.name} присоединился к игре.` };
        } else {
            const newSpectator = { name: request.name, id: request.sessionId };
            newState = { ...newState, spectators: [...newState.spectators, newSpectator], gameMessage: `Для ${request.name} не нашлось места, он стал зрителем.` };
        }
    } else { // Rejected or timed out
        const newSpectator = { name: request.name, id: request.sessionId };
        newState = { ...newState, spectators: [...(newState.spectators || []), newSpectator], gameMessage: `Хост отклонил запрос ${request.name} на присоединение.` };
    }
    publishState(newState);
  }, [myPlayerId, publishState]);

  React.useEffect(() => {
      const isHost = myPlayerId === gameState?.hostId;
      if (isHost && gameState?.joinRequests?.length > 0) {
          const now = Date.now();
          const timeout = 30000; // 30 seconds
          const expiredRequest = gameState.joinRequests.find(r => now - r.timestamp > timeout);

          if (expiredRequest) {
              handleJoinRequest(expiredRequest.sessionId, false);
          }
      }
  }, [gameState, myPlayerId, handleJoinRequest]);

  const handleJoinGame = () => {
    const state = gameStateRef.current;
    if (myPlayerId !== null || isSpectator) return;
  
    if (state.joinRequests.some(r => r.sessionId === mySessionIdRef.current)) {
      return;
    }
  
    const availableSlots = state.players.filter(p => !p.isClaimed && !p.isSpectator).length;
    if (availableSlots === 0) {
      if (window.confirm("Нет свободных мест. Хотите присоединиться в качестве зрителя?")) {
        const newSpectator = { name: playerName, id: mySessionIdRef.current };
        publishState({ ...state, spectators: [...state.spectators, newSpectator] });
        setIsSpectator(true);
      }
      return;
    }

    const isGameInProgress = state.isGameStarted && !state.isGameOver;

    if (isGameInProgress) {
        const newRequest = {
            name: playerName,
            sessionId: mySessionIdRef.current,
            timestamp: Date.now()
        };
        const newState = {
            ...state,
            joinRequests: [...(state.joinRequests || []), newRequest],
            gameMessage: `${playerName} хочет присоединиться. Ожидание подтверждения от хоста.`
        };
        publishState(newState, true);
    } else {
        const lastClaimedIndex = state.players.map(p => p.isClaimed).lastIndexOf(true);
        let joinIndex = state.players.findIndex((p, i) => !p.isClaimed && i > lastClaimedIndex);
        if (joinIndex === -1) {
            joinIndex = state.players.findIndex(p => !p.isClaimed);
        }

        if (joinIndex === -1) return;

        setMyPlayerId(joinIndex);

        const restoredScore = state.leavers?.[playerName] || 0;
        const initialScores = restoredScore > 0 ? [restoredScore] : [];
        const newLeavers = { ...state.leavers };
        if (restoredScore > 0) delete newLeavers[playerName];

        const newPlayers = state.players.map((p, i) => {
            if (i === joinIndex) {
                return { ...p, name: playerName, isClaimed: true, scores: initialScores, status: 'online', isSpectator: false, sessionId: mySessionIdRef.current, hasEnteredGame: restoredScore > 0, barrelBolts: 0 };
            }
            return p;
        });

        let newHostId = state.hostId;
        if (state.hostId === null || !newPlayers.some(p => p.id === state.hostId && p.isClaimed)) {
            newHostId = findNextHost(newPlayers) ?? joinIndex;
        }

        const claimedPlayerCount = newPlayers.filter(p => p.isClaimed && !p.isSpectator).length;

        let gameMessage = state.gameMessage;

        if (claimedPlayerCount < 2) {
            gameMessage = `Ожидание игроков...`;
        } else if (!state.isGameStarted) {
            gameMessage = `Готовы к игре! Хост может начинать.`;
        } else {
            const scoreMessage = restoredScore > 0 ? ` (восстановлено ${restoredScore} очков)` : '';
            gameMessage = `${playerName} присоединился${scoreMessage}. Ход ${newPlayers[state.currentPlayerIndex].name}.`;
        }

        publishState({ ...state, players: newPlayers, leavers: newLeavers, gameMessage, hostId: newHostId }, true);
    }
  };


  const handleLeaveGame = () => {
    if (isSpectator) {
      const state = gameStateRef.current;
      if(state) {
          const newSpectators = state.spectators.filter(s => s.id !== mySessionIdRef.current);
          publishState({...state, spectators: newSpectators});
      }
      onExit();
      return;
    }

    if (myPlayerId === null) {
      onExit();
      return;
    }
      
    const state = gameStateRef.current;
    if(!state) return onExit();

    const me = state.players.find(p => p.id === myPlayerId);
    if (!me) return onExit();

    // 1. Save score to leavers object
    const totalScore = calculateTotalScore(me);
    const newLeavers = (totalScore > 0) 
      ? { ...state.leavers, [me.name]: totalScore }
      : { ...state.leavers };

    // 2. Create new player list: active players who are staying, re-indexed from 0
    let newPlayers = state.players
      .filter(p => p.isClaimed && p.id !== myPlayerId)
      .map((p, index) => ({ ...p, id: index }));

    // 3. Pad with empty slots until the list has 5 players
    while (newPlayers.length < 5) {
        const newId = newPlayers.length;
        newPlayers.push({ 
            id: newId, 
            name: `Игрок ${newId + 1}`, 
            scores: [], 
            isClaimed: false, 
            status: 'offline', 
            isSpectator: false,
            hasEnteredGame: false,
            barrelBolts: 0,
        });
    }

    // 4. Find new host
    const newHostId = findNextHost(newPlayers);
    
    // 5. Determine next current player
    let newCurrentPlayerIndex = 0;
    const gameWasInProgress = !state.isGameOver && state.isGameStarted;
    const oldCurrentPlayer = state.players[state.currentPlayerIndex];
    
    if (gameWasInProgress) {
        if (oldCurrentPlayer.id === myPlayerId) { // It was my turn
            // The turn passes to the next available player, starting search from the beginning
            newCurrentPlayerIndex = findNextActivePlayer(-1, newPlayers); 
        } else {
            // Find the same current player in the new list
            const currentPlayerInNewList = newPlayers.find(p => p.sessionId === oldCurrentPlayer.sessionId);
            newCurrentPlayerIndex = currentPlayerInNewList ? currentPlayerInNewList.id : findNextActivePlayer(-1, newPlayers);
        }
    } else {
        newCurrentPlayerIndex = state.hostId !== null && newPlayers.some(p => p.id === state.hostId) ? state.hostId : 0;
    }

    const remainingActivePlayers = newPlayers.filter(p => p.isClaimed && !p.isSpectator);
    const activePlayersBeforeLeave = state.players.filter(p => p.isClaimed && !p.isSpectator).length;
    
    let finalState;
    // 6. Check for auto-win condition
    if (gameWasInProgress && remainingActivePlayers.length < 2 && activePlayersBeforeLeave >= 2) {
        finalState = {
            ...state,
            players: newPlayers,
            hostId: newHostId,
            leavers: newLeavers,
            isGameOver: true,
            gameMessage: remainingActivePlayers.length === 1 
              ? `${remainingActivePlayers[0].name} победил, так как все остальные игроки вышли!`
              : 'Все игроки вышли. Игра окончена.',
        };
    } else {
        const nextPlayer = newPlayers[newCurrentPlayerIndex];
        const nextPlayerName = nextPlayer ? nextPlayer.name : '';
        
        let message = `${me.name} покинул(а) игру.`;
        if (gameWasInProgress && nextPlayerName && oldCurrentPlayer.id === myPlayerId) {
            message += ` Ход ${nextPlayerName}.`;
        }

        finalState = {
          ...state,
          players: newPlayers,
          hostId: newHostId,
          leavers: newLeavers,
          currentPlayerIndex: newCurrentPlayerIndex,
          gameMessage: message,
        };
        
        // If it was the leaver's turn, reset turn state for the next player
        if (oldCurrentPlayer.id === myPlayerId && gameWasInProgress) {
            const cleanTurnState = createInitialState();
            finalState = {
                ...finalState,
                diceOnBoard: cleanTurnState.diceOnBoard,
                keptDiceThisTurn: cleanTurnState.keptDiceThisTurn,
                diceKeptFromThisRoll: cleanTurnState.diceKeptFromThisRoll,
                selectedDiceIndices: cleanTurnState.selectedDiceIndices,
                scoreFromPreviousRolls: cleanTurnState.scoreFromPreviousRolls,
                currentTurnScore: cleanTurnState.currentTurnScore,
                potentialScore: cleanTurnState.potentialScore,
                canRoll: true,
                canBank: false,
                canKeep: false,
                turnStartTime: Date.now(),
            };
        }
    }
    
    publishState(finalState);
    onExit();
  };


  const handleDragStart = (e, index) => {
    if (gameState.selectedDiceIndices.length > 0 && gameState.selectedDiceIndices.includes(index)) {
      e.dataTransfer.setData('text/plain', 'selection');
    } else {
      e.dataTransfer.setData('application/json', JSON.stringify([index]));
    }
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (myPlayerId !== gameState.currentPlayerIndex) return;
    const type = e.dataTransfer.getData('text/plain');
    if (type === 'selection' && gameState.canKeep) {
      handleKeepDice(gameState.selectedDiceIndices);
    } else {
      try {
        const indices = JSON.parse(e.dataTransfer.getData('application/json'));
        if (Array.isArray(indices)) handleKeepDice(indices);
      } catch (error) { console.error("Drop error:", error); }
    }
  };
  const handleDieDoubleClick = (index) => {
    if (myPlayerId !== gameState.currentPlayerIndex) return;
    if (gameState.selectedDiceIndices.length > 0 && gameState.selectedDiceIndices.includes(index)) {
        if(gameState.canKeep) handleKeepDice(gameState.selectedDiceIndices);
    } else {
        handleKeepDice([index]);
    }
  };
  
  const PlayerStatus = ({ player }) => {
    if (!player.isClaimed || player.isSpectator) return null;
    const statusMap = {
        online: { text: 'онлайн', color: 'text-green-400' },
        away: { text: 'отошел', color: 'text-yellow-400' },
        disconnected: { text: 'отключен', color: 'text-red-500' },
        offline: { text: 'подключается', color: 'text-gray-400' },
    };
    const { text, color } = statusMap[player.status] || statusMap.offline;
    return React.createElement('span', { className: `text-xs ${color}` }, `(${text})`);
  };

  if (connectionStatus !== 'connected' || !gameState) {
    return React.createElement('div', { className: "text-center" }, 
      React.createElement('h2', { className: "font-ruslan text-4xl text-yellow-300 mb-4" }, 'Подключение...'),
      React.createElement('p', { className: "text-lg" }, 
        connectionStatus === 'connecting' ? 'Устанавливаем связь с сервером...' : 
        connectionStatus === 'reconnecting' ? 'Потеряна связь, переподключаемся...' :
        connectionStatus === 'error' ? 'Ошибка подключения. Попробуйте обновить страницу.' :
        'Загрузка игровой комнаты...'
      )
    );
  }

  const isMyTurn = myPlayerId === gameState.currentPlayerIndex && !isSpectator;
  const isHost = myPlayerId === gameState.hostId;
  const claimedPlayerCount = gameState.players.filter(p => p.isClaimed && !p.isSpectator).length;
  const rollButtonText = (gameState.keptDiceThisTurn.length >= 5 ? 5 : 5 - gameState.keptDiceThisTurn.length) === 5 
    ? 'Бросить все' : `Бросить ${5 - gameState.keptDiceThisTurn.length}`;
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isCurrentPlayerInactive = currentPlayer && (currentPlayer.status === 'away' || currentPlayer.status === 'disconnected');
  const showSkipButton = !isMyTurn && isCurrentPlayerInactive && !gameState.isGameOver && (Date.now() - gameState.turnStartTime > 60000);
  const canJoin = myPlayerId === null && !isSpectator;
  const availableSlotsForJoin = gameState.players.filter(p => !p.isClaimed && !p.isSpectator).length;
  const isAwaitingApproval = myPlayerId === null && gameState.joinRequests && gameState.joinRequests.some(r => r.sessionId === mySessionIdRef.current);

  let displayMessage = gameState.gameMessage;
  const myBarrelStatus = isMyTurn ? getPlayerBarrelStatus(currentPlayer) : null;

  if (gameState.isGameOver && !canJoin) {
      if (isHost && claimedPlayerCount < 2) {
          displayMessage = 'Недостаточно игроков для начала новой игры (нужно минимум 2).';
      } else if (!isHost) {
          const hostPlayer = gameState.players.find(p => p.id === gameState.hostId);
          const hostName = hostPlayer ? hostPlayer.name : 'хост';
          displayMessage = `${gameState.gameMessage} Ожидание, пока ${hostName} начнет новую игру.`;
      }
  } else if (isMyTurn && gameState.isGameStarted) {
      if (!currentPlayer.hasEnteredGame) {
          displayMessage = "Ваш ход. Вам нужно набрать 50+ очков, чтобы войти в игру.";
      } else if (myBarrelStatus === '200-300') {
          displayMessage = "Ваш ход. Вы на бочке! Нужно набрать очков, чтобы стало 300 или больше за этот ход.";
      } else if (myBarrelStatus === '700-800') {
          displayMessage = "Ваш ход. Вы на бочке! Нужно набрать очков, чтобы стало 800 или больше за этот ход.";
      }
  }


  const JoinRequestManager = () => {
    if (!isHost || !gameState.joinRequests || gameState.joinRequests.length === 0) {
        return null;
    }
    return React.createElement('div', { className: 'absolute top-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-slate-700 border-2 border-yellow-400 rounded-lg shadow-lg z-20 animate-pulse' },
        React.createElement('h3', { className: 'text-lg font-bold text-yellow-300 mb-2 text-center' }, 'Запросы на присоединение'),
        React.createElement('ul', { className: 'space-y-2' },
            gameState.joinRequests.map(req => React.createElement('li', { key: req.sessionId, className: 'flex items-center justify-between p-2 bg-slate-800 rounded' },
                React.createElement('span', { className: 'text-white' }, req.name),
                React.createElement('div', { className: 'flex gap-2' },
                    React.createElement('button', { onClick: () => handleJoinRequest(req.sessionId, true), className: 'px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm font-bold' }, 'Принять'),
                    React.createElement('button', { onClick: () => handleJoinRequest(req.sessionId, false), className: 'px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm font-bold' }, 'Отклонить')
                )
            ))
        )
    );
  };

  const AwaitingApprovalScreen = () => {
    return React.createElement('div', { className: 'text-center' },
        React.createElement('h3', { className: 'font-ruslan text-3xl text-yellow-300' }, 'Ожидание подтверждения'),
        React.createElement('p', { className: 'mt-4 text-lg' }, 'Ваш запрос на присоединение к игре отправлен хосту.'),
        React.createElement('div', { className: 'mt-6 w-16 h-16 border-4 border-t-transparent border-yellow-300 rounded-full animate-spin mx-auto' })
    );
  };


  return React.createElement(
    React.Fragment,
    null,
    showRules && React.createElement(RulesModal, { onClose: () => setShowRules(false) }),
    isSpectatorsModalOpen && React.createElement(SpectatorsModal, { spectators: gameState.spectators, onClose: () => setIsSpectatorsModalOpen(false) }),
    React.createElement(
      'div', { className: "w-full h-full flex flex-col p-4 text-white overflow-hidden" },
      React.createElement('header', { className: `flex justify-between items-center mb-4 flex-shrink-0 transition-opacity duration-300 ${isScoreboardExpanded ? 'opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto' : 'opacity-100'}` },
        React.createElement('div', { className: "p-2 bg-black/50 rounded-lg text-sm" }, React.createElement('p', { className: "font-mono" }, `КОД КОМНАТЫ: ${roomCode}`)),
        React.createElement('h1', { onClick: () => setShowRules(true), className: "font-ruslan text-4xl text-yellow-300 cursor-pointer hover:text-yellow-200 transition-colors", title: "Показать правила" }, 'ТЫСЯЧА'),
        React.createElement('button', { onClick: handleLeaveGame, className: "px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold" }, isSpectator || canJoin ? 'Вернуться в лобби' : 'Выйти из игры')
      ),
      React.createElement('div', { className: "flex-grow flex flex-col lg:grid lg:grid-cols-4 gap-4 min-h-0" },
        React.createElement('aside', { className: `bg-slate-800/80 p-4 border border-slate-700 flex flex-col transition-all duration-500 ease-in-out lg:col-span-1 ${isScoreboardExpanded ? 'fixed inset-x-4 top-24 bottom-4 z-40 rounded-xl lg:relative lg:inset-auto lg:z-auto' : 'flex-shrink-0 rounded-xl'}` },
          React.createElement('div', { className: "flex justify-between items-center mb-4 flex-shrink-0" },
            React.createElement('h2', { className: "font-ruslan text-3xl text-yellow-300 flex items-baseline" },
              'Игроки',
              gameState.spectators.length > 0 && React.createElement('span', { className: "text-xl ml-2 font-normal font-['Roboto_Condensed']" },
                '(',
                React.createElement('button',
                  {
                    onClick: () => setIsSpectatorsModalOpen(true),
                    className: "text-blue-400 hover:text-blue-300 hover:underline"
                  },
                  `Зрители: ${gameState.spectators.length}`
                ),
                ')'
              )
            ),
            React.createElement('button', { onClick: () => setIsScoreboardExpanded(!isScoreboardExpanded), className: "p-1 rounded-full hover:bg-slate-700/50 lg:hidden ml-auto z-50" }, 
              React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: `h-6 w-6 text-yellow-300 transition-transform duration-300 ${isScoreboardExpanded ? 'rotate-180' : ''}`, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 },
                React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M19 9l-7 7-7-7" })
              )
            )
          ),
          React.createElement('div', { className: "flex-grow overflow-y-auto relative" },
            React.createElement('table', { className: "w-full text-sm text-left text-gray-300" },
              React.createElement('thead', { className: "text-xs text-yellow-300 uppercase bg-slate-800 sticky top-0 z-10" },
                React.createElement('tr', null, 
                  gameState.players.map(player => {
                    const index = player.id;
                    const isUnclaimedAndEmpty = !player.isClaimed && player.name === `Игрок ${player.id + 1}`;
                    const barrelStatus = getPlayerBarrelStatus(player);
                    const isHostPlayer = player.id === gameState.hostId;
            
                    return React.createElement('th', { 
                        key: `player-header-${player.id}`, 
                        scope: "col", 
                        className: `h-16 px-0 py-0 text-center align-middle transition-all duration-300 relative ${index === gameState.currentPlayerIndex && gameState.isGameStarted && !gameState.isGameOver && player.isClaimed ? 'bg-yellow-400 text-slate-900' : 'bg-slate-700/50'} ${index === myPlayerId ? 'outline outline-2 outline-blue-400' : ''}` 
                    },
                      isUnclaimedAndEmpty
                        ? React.createElement('div', { className: "flex flex-col items-center justify-center h-full py-2 text-gray-500" },
                            React.createElement('span', { className: "text-lg" }, `Место ${index + 1}`),
                            React.createElement('span', { className: "text-xs italic" }, '(свободно)')
                          )
                        : !player.isClaimed
                          ? React.createElement('div', { className: "flex flex-col items-center justify-center h-full py-2 text-gray-500" },
                              React.createElement('span', { className: "px-2 line-through" }, player.name),
                              React.createElement('span', { className: "text-xs italic" }, '(вышел)')
                            )
                          : React.createElement('div', { className: "flex flex-col items-center justify-center h-full py-2" },
                              React.createElement('div', { className: "flex items-center justify-center" },
                                isHostPlayer && React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-4 w-4 mr-1 text-yellow-400", viewBox: "0 0 24 24", fill: "currentColor" },
                                  React.createElement('path', { d: "M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" })
                                ),
                                React.createElement('span', { className: "px-1" }, player.name)
                              ),
                              !player.hasEnteredGame && gameState.isGameStarted && React.createElement('span', { className: "text-xs font-normal text-cyan-300 italic", title: "Нужно набрать 50+ очков для входа" }, '(на старте)'),
                              barrelStatus && React.createElement('span', { className: "text-xs font-normal text-orange-400 italic", title: `Нужно набрать очков, чтобы стало ${barrelStatus === '200-300' ? '300+' : '800+'}` }, '(на бочке)'),
                              barrelStatus && player.barrelBolts > 0 && React.createElement('span', { className: 'text-xs font-bold text-red-500 ml-1' }, '/'.repeat(player.barrelBolts)),
                              React.createElement(PlayerStatus, { player: player })
                            )
                    );
                  })
                )
              ),
              React.createElement('tbody', { className: `lg:table-row-group ${isScoreboardExpanded ? '' : 'hidden'}` },
                (() => {
                  const hasAnyPlayerJoined = gameState.players.some(p => p.isClaimed || p.isSpectator || p.name !== `Игрок ${p.id + 1}`);
                  const maxRounds = gameState.players.reduce((max, p) => Math.max(max, (p.scores ? p.scores.length : 0)), 0);

                  if (!hasAnyPlayerJoined) {
                     return React.createElement('tr', null, React.createElement('td', { colSpan: gameState.players.length, className: "py-4 px-2 text-center text-gray-400 italic" }, 'Ожидание игроков...'));
                  }
                  if (maxRounds === 0 && gameState.isGameStarted) {
                     return React.createElement('tr', null, React.createElement('td', { colSpan: gameState.players.length, className: "py-4 px-2 text-center text-gray-400 italic" }, 'Никто еще не вошел в игру.'));
                  }
                  if (maxRounds === 0) {
                     return React.createElement('tr', null, React.createElement('td', { colSpan: gameState.players.length, className: "py-4 px-2 text-center text-gray-400 italic" }, 'Еще не было записано очков.'));
                  }
                  
                  const rows = [];
                  for (let i = 0; i < maxRounds; i++) {
                    rows.push(React.createElement('tr', { key: `round-row-${i}`, className: "border-b border-slate-700 hover:bg-slate-700/30" },
                      gameState.players.map(player =>
                        React.createElement('td', { key: `cell-${player.id}-${i}`, className: "py-2 px-2 text-center font-mono" },
                           (player.isClaimed || player.isSpectator || player.scores.length > i) && player.scores[i] !== undefined ? player.scores[i] : React.createElement('span', { className: "text-slate-500" }, '-')
                        )
                      )
                    ));
                  }
                  return rows;
                })()
              ),
              React.createElement('tfoot', { className: "sticky bottom-0 bg-slate-800 font-bold text-white border-t-2 border-slate-500" },
                 React.createElement('tr', null, gameState.players.map((player) => {
                   const index = player.id;
                   const hasHistory = player.isClaimed || player.isSpectator || player.name !== `Игрок ${player.id + 1}`;
                   return React.createElement('td', { key: `total-score-${player.id}`, className: `h-10 px-2 text-center text-lg font-mono align-middle transition-colors duration-300 ${index === gameState.currentPlayerIndex && gameState.isGameStarted && !gameState.isGameOver && player.isClaimed ? 'bg-yellow-400/80 text-slate-900' : 'bg-slate-900/50'} ${index === myPlayerId ? 'outline outline-2 outline-blue-400' : ''}` }, 
                     hasHistory ? calculateTotalScore(player) : ''
                   );
                 }))
              )
            )
          )
        ),
        React.createElement('main', { className: `relative flex-grow lg:col-span-3 bg-slate-900/70 rounded-xl border-2 flex flex-col justify-between min-h-0 p-4 transition-all duration-300 ${isDragOver && isMyTurn ? 'border-green-400 shadow-2xl shadow-green-400/20' : 'border-slate-600'} ${isScoreboardExpanded ? 'opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto' : 'opacity-100'}`, onDragOver: (e) => {e.preventDefault(); setIsDragOver(true);}, onDrop: handleDrop, onDragLeave: () => setIsDragOver(false) },
          React.createElement(JoinRequestManager, null),
          React.createElement('div', { className: "w-full" },
            React.createElement('div', { className: `w-full p-3 mb-4 text-center rounded-lg ${gameState.isGameOver ? 'bg-green-600' : 'bg-slate-800'} border border-slate-600 flex items-center justify-center min-h-[72px]` },
              React.createElement('p', { className: "text-lg font-semibold" }, displayMessage)
            ),
            React.createElement('div', { className: "w-full flex justify-center md:justify-end" },
              React.createElement('div', { className: "p-3 rounded-lg bg-black/40 border border-slate-700 w-full md:w-auto md:min-w-[300px]" },
                React.createElement('p', { className: "text-xs text-gray-400 mb-2 text-center uppercase tracking-wider" }, 'Отложено'),
                React.createElement('div', { className: "flex gap-2 flex-wrap justify-center min-h-[40px] items-center" },
                  gameState.keptDiceThisTurn.length > 0
                    ? gameState.keptDiceThisTurn.map((value, i) => React.createElement(SmallDiceIcon, { key: `kept-${i}`, value: value }))
                    : React.createElement('span', { className: "text-slate-500 italic" }, 'Пусто')
                )
              )
            )
          ),
          React.createElement('div', { className: "flex-grow w-full flex flex-col items-center justify-center pt-3 pb-6" },
            React.createElement('div', { className: "w-full sm:max-w-[480px] flex items-center justify-between min-h-[80px]" },
              gameState.diceOnBoard.map((value, i) => React.createElement(DiceIcon, { key: `board-${i}`, value: value, isSelected: gameState.selectedDiceIndices.includes(i), onClick: isMyTurn ? () => handleToggleDieSelection(i) : null, onDragStart: isMyTurn ? (e) => handleDragStart(e, i) : null, onDoubleClick: isMyTurn ? () => handleDieDoubleClick(i) : null })),
              Array.from({ length: 5 - gameState.diceOnBoard.length }).map((_, i) => React.createElement(DiceIcon, { key: `placeholder-${i}`, value: 0 }))
            )
          ),
          React.createElement('div', { className: "w-full" },
             showSkipButton && React.createElement('div', {className: 'text-center mb-2'}, React.createElement('button', {onClick: handleSkipTurn, className: 'px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold animate-pulse'}, `Пропустить ход ${currentPlayer.name}`)),
            React.createElement('div', { className: "text-center mb-4" },
              React.createElement('p', { className: "text-xl" }, 'Очки за ход: ', React.createElement('span', { className: "font-ruslan text-5xl text-green-400" }, gameState.currentTurnScore + gameState.potentialScore))
            ),
            React.createElement('div', { className: "max-w-2xl mx-auto w-full" },
              isAwaitingApproval
                ? React.createElement(AwaitingApprovalScreen, null)
                : canJoin
                  ? React.createElement('button', { 
                      onClick: handleJoinGame, 
                      disabled: availableSlotsForJoin === 0, 
                      className: "w-full py-4 bg-green-600 hover:bg-green-700 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" 
                    }, 
                      availableSlotsForJoin > 0 ? `Войти в игру (${availableSlotsForJoin} мест)` : 'Нет свободных мест'
                    )
                  : gameState.isGameOver
                    ? (isHost
                        ? React.createElement('button', { onClick: handleNewGame, disabled: claimedPlayerCount < 2, className: "w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, 'Новая Игра')
                        : null
                      )
                    : !gameState.isGameStarted 
                      ? (isHost
                          ? React.createElement('button', { onClick: handleStartOfficialGame, disabled: claimedPlayerCount < 2, className: "w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, 'Начать игру')
                          : React.createElement('div', { className: "text-center text-lg text-gray-400" }, 'Ожидание начала игры от хоста...')
                        )
                      : React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                          React.createElement('button', { onClick: handleRollDice, disabled: !isMyTurn || !gameState.canRoll, className: "w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, rollButtonText),
                          React.createElement('button', { onClick: handleBankScore, disabled: !isMyTurn || !gameState.canBank, className: "w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-slate-900 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, 'Записать')
                        )
            )
          )
        )
      )
    )
  );
};

export default Game;