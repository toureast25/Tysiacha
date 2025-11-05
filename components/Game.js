// 
import React from 'react';
import { MQTT_BROKER_URL, MQTT_TOPIC_PREFIX } from '../constants.js';
import { analyzeDice, validateSelection, calculateTotalScore, createInitialState, findNextHost } from '../utils/gameLogic.js';
import RulesModal from './RulesModal.js';
import SpectatorsModal from './SpectatorsModal.js';
import { DiceIcon, SmallDiceIcon } from './Dice.js';

const Game = ({ roomCode, playerCount, playerName, onExit }) => {
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
        const sessionData = { roomCode, playerCount, playerName, myPlayerId };
        localStorage.setItem('tysiacha-session', JSON.stringify(sessionData));
        // Save the last room the user actively played in
        if (!isSpectator) {
          localStorage.setItem('tysiacha-lastRoom', roomCode);
        }
    }
  }, [myPlayerId, roomCode, playerCount, playerName, isSpectator]);

  const publishState = React.useCallback((newState, isOptimisticUpdate = false) => {
    if (mqttClientRef.current && mqttClientRef.current.connected) {
      const currentVersion = gameStateRef.current?.version || 0;
      // Ensure we don't pass the senderId from a received state back into a new state
      const { senderId, ...stateWithoutSender } = newState; 
      
      const finalState = {
        ...stateWithoutSender,
        version: currentVersion + 1,
        senderId: myPlayerId,
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
      return startIndex; // Only one player left
  }, []);

  React.useEffect(() => {
    const client = mqtt.connect(MQTT_BROKER_URL);
    mqttClientRef.current = client;
    isStateReceivedRef.current = false;
    
    // Restore session if available
    try {
        const savedSession = localStorage.getItem('tysiacha-session');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            if(session.roomCode === roomCode){
                setMyPlayerId(session.myPlayerId);
            }
        }
    } catch(e) { console.error("Could not restore session:", e); }


    client.on('connect', () => {
      setConnectionStatus('connected');
      client.subscribe(topic);
      client.subscribe(presenceTopic);

      setTimeout(() => {
        if (!isStateReceivedRef.current) {
            const initialPlayerCount = gameStateRef.current ? gameStateRef.current.players.length : playerCount;
            const initialState = createInitialState(initialPlayerCount);
            initialState.players[0] = {
                ...initialState.players[0],
                name: playerName,
                isClaimed: true,
                status: 'online',
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
                
                const currentGameState = gameStateRef.current;
                
                // If a joining client has a different player count, adjust the state.
                if (!currentGameState && receivedState.players.length !== playerCount) {
                    const clientInitialState = createInitialState(receivedState.players.length);
                    setGameState(clientInitialState);
                }

                setGameState(state => {
                    // New logic for optimistic updates
                    if (state && receivedState.version === state.version) {
                        // If it's from another player with the same version, it's a race condition.
                        // We accept their state to stay in sync. "Last write wins".
                        if (receivedState.senderId !== myPlayerId) {
                            return receivedState;
                        }
                        // If it's my own message that I already updated for, ignore.
                        return state;
                    }

                    if (!state || receivedState.version > state.version) {
                        // Standard update for newer versions
                        if(myPlayerId !== null && receivedState.players[myPlayerId]?.isSpectator){
                            setIsSpectator(true);
                            localStorage.removeItem('tysiacha-session');
                        }
                        if(myPlayerId !== null && !receivedState.players[myPlayerId]?.isClaimed && !receivedState.players[myPlayerId]?.isSpectator){
                            onExit();
                        }
                        return receivedState;
                    }
                    
                    return state; // Old version, ignore.
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
                return { ...playerCopy, isClaimed: false, isSpectator: true, status: 'offline' };
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
  }, [roomCode, playerCount, playerName, onExit]);


  // --- Game Logic Actions ---
  const handleRollDice = () => {
    const state = gameState;
    if (!state.canRoll || state.isGameOver) return;
    
    const isFirstMoveEver = state.players.every(p => p.scores.length === 0);
    if (isFirstMoveEver && myPlayerId !== state.hostId) {
      return;
    }

    const isHotDiceRoll = state.keptDiceThisTurn.length >= 5;
    const diceToRollCount = isHotDiceRoll ? 5 : 5 - state.keptDiceThisTurn.length;
    const newDice = Array.from({ length: diceToRollCount }, () => Math.floor(Math.random() * 6) + 1);
    const { scoringGroups } = analyzeDice(newDice);
    const rollScore = scoringGroups.reduce((sum, group) => sum + group.score, 0);

    if (rollScore === 0) { // BOLT!
      const newPlayers = state.players.map((player, index) =>
        index === state.currentPlayerIndex ? { ...player, scores: [...player.scores, '/'] } : player
      );
      const nextPlayerIndex = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
      const nextPlayer = newPlayers[nextPlayerIndex];

      const boltState = {
        ...createInitialState(state.players.length),
        players: newPlayers,
        spectators: state.spectators,
        hostId: state.hostId,
        currentPlayerIndex: nextPlayerIndex,
        diceOnBoard: newDice,
        gameMessage: `${state.players[state.currentPlayerIndex].name} получает болт! Ход ${nextPlayer.name}.`,
        turnStartTime: Date.now(),
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
      const newPlayersWithBolt = state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, scores: [...p.scores, '/'] } : p);
      const nextIdx = findNextActivePlayer(state.currentPlayerIndex, newPlayersWithBolt);
      const nextPlayerName = newPlayersWithBolt[nextIdx].name;
      const boltState = { ...createInitialState(state.players.length), players: newPlayersWithBolt, spectators: state.spectators, hostId: state.hostId, currentPlayerIndex: nextIdx, gameMessage: `${currentPlayer.name} получает болт. Ход ${nextPlayerName}.`, turnStartTime: Date.now() };
      publishState(boltState, true);
      return;
    }

    const newPlayers = state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, scores: [...p.scores, finalTurnScore] } : p);
    const totalScore = calculateTotalScore(newPlayers[state.currentPlayerIndex]);
    
    if (totalScore >= 1000) {
      const winState = { ...createInitialState(state.players.length), players: newPlayers, spectators: state.spectators, hostId: state.hostId, isGameOver: true, gameMessage: `${currentPlayer.name} победил, набрав ${totalScore} очков!` };
      publishState(winState, true);
      return;
    }

    const nextPlayerIndex = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
    const nextPlayerName = newPlayers[nextPlayerIndex].name;
    const bankState = { ...createInitialState(state.players.length), players: newPlayers, spectators: state.spectators, hostId: state.hostId, currentPlayerIndex: nextPlayerIndex, gameMessage: `${currentPlayer.name} записал ${finalTurnScore} очков. Ход ${nextPlayerName}.`, turnStartTime: Date.now() };
    publishState(bankState, true);
  };

  const handleSkipTurn = () => {
    const state = gameState;
    if(state.isGameOver || myPlayerId === state.currentPlayerIndex) return;
    
    const currentPlayer = state.players[state.currentPlayerIndex];
    if(currentPlayer.status === 'online') return;

    const newPlayers = state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, scores: [...p.scores, '/'] } : p);
    const nextIdx = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
    const nextPlayerName = newPlayers[nextIdx].name;
    publishState({ ...createInitialState(state.players.length), players: newPlayers, spectators: state.spectators, hostId: state.hostId, currentPlayerIndex: nextIdx, gameMessage: `${currentPlayer.name} пропустил ход. Ход ${nextPlayerName}.`, turnStartTime: Date.now() });
  }

  const handleNewGame = () => {
      if (myPlayerId !== gameState.hostId) return;

      const oldState = gameState;

      const newPlayers = Array.from({ length: oldState.players.length }, (_, index) => {
          const oldPlayer = oldState.players.find(p => p && p.id === index);

          if (oldPlayer && oldPlayer.isClaimed && !oldPlayer.isSpectator) {
              return {
                  id: oldPlayer.id,
                  name: oldPlayer.name,
                  scores: [], 
                  isClaimed: true,
                  status: oldPlayer.id === oldState.hostId ? 'online' : 'offline',
                  isSpectator: false,
              };
          }
          
          const cleanPlayerSlot = createInitialState(1).players[0];
          return {
              ...cleanPlayerSlot,
              id: index,
              name: `Игрок ${index + 1}`,
          };
      });

      const hostPlayer = newPlayers.find(p => p.id === oldState.hostId);
      const claimedPlayerCount = newPlayers.filter(p => p.isClaimed && !p.isSpectator).length;
      
      let gameMessage;
      let canRoll;

      if (claimedPlayerCount < 2) {
          gameMessage = `${hostPlayer.name} создал(а) новую игру. Ожидание других игроков...`;
          canRoll = false;
      } else {
          const startingPlayerName = hostPlayer ? hostPlayer.name : 'Игрок';
          gameMessage = `Новая игра! Ход ${startingPlayerName}.`;
          canRoll = true;
      }

      const finalState = {
          ...createInitialState(oldState.players.length), 
          players: newPlayers, 
          spectators: oldState.spectators, 
          hostId: oldState.hostId,
          currentPlayerIndex: oldState.hostId,
          gameMessage,
          canRoll,
          turnStartTime: Date.now(),
      };
      
      publishState(finalState);
  };

  const handleJoinGame = () => {
    const state = gameStateRef.current;
    if (myPlayerId !== null) return;
  
    // --- Step 1: Check for Rejoin ---
    const returningPlayerIndex = state.players.findIndex(p => p.name === playerName && !p.isClaimed);
  
    if (returningPlayerIndex > -1) {
      setMyPlayerId(returningPlayerIndex);
      const newPlayers = state.players.map((p, i) => {
        if (i === returningPlayerIndex) {
          return { ...p, isClaimed: true, status: 'online', isSpectator: false };
        }
        return p;
      });
      const newState = {
        ...state,
        players: newPlayers,
        gameMessage: `${playerName} вернулся в игру.`
      };
      publishState(newState, true);
      setIsSpectator(false); // Make sure to reset spectator status on client
      return;
    }
  
    // --- Step 2: Find a New Slot (overwrite if needed) ---
    const firstAvailableIndex = state.players.findIndex(p => !p.isClaimed && !p.isSpectator);
  
    if (firstAvailableIndex === -1) {
      if (window.confirm("Комната заполнена. Хотите присоединиться в качестве зрителя?")) {
        const newSpectator = { name: playerName, id: `spec-${Date.now()}` };
        const newState = { ...state, spectators: [...state.spectators, newSpectator] };
        publishState(newState);
        setIsSpectator(true);
      }
      return;
    }
  
    setMyPlayerId(firstAvailableIndex);
  
    // A new player RESETS the scores of the slot they take.
    const newPlayers = state.players.map((p, i) => {
      if (i === firstAvailableIndex) {
        return { ...p, name: playerName, isClaimed: true, scores: [], status: 'online', isSpectator: false };
      }
      return p;
    });
  
    let newHostId = state.hostId;
    if (state.hostId === null || !newPlayers.some(p => p.id === state.hostId && p.isClaimed)) {
      newHostId = findNextHost(newPlayers) ?? firstAvailableIndex;
    }
  
    const claimedPlayerCount = newPlayers.filter(p => p.isClaimed && !p.isSpectator).length;
    const isFreshGame = newPlayers.every(p => p.scores.length === 0);
  
    let gameMessage = state.gameMessage;
    let canRoll = state.canRoll;
  
    if (claimedPlayerCount >= 2 && (isFreshGame || state.isGameOver) && !state.canRoll) {
      gameMessage = `Игра началась! Ход ${newPlayers[newHostId].name}.`;
      canRoll = true;
    } else if (claimedPlayerCount < 2) {
      gameMessage = `Ожидание игроков...`;
    } else {
      gameMessage = `${playerName} присоединился. Ход ${newPlayers[state.currentPlayerIndex].name}.`;
    }
  
    publishState({ ...state, players: newPlayers, gameMessage, hostId: newHostId, canRoll }, true);
  };

  const handleLeaveGame = () => {
      if (myPlayerId === null) {
        onExit();
        return;
      }
      if (isSpectator) {
        // Handle spectator leaving - just exit, no state change needed from their side
        onExit();
        return;
      }
      
      const state = gameStateRef.current;
      const me = state.players[myPlayerId];
      
      // Mark the player as "left" by making them unclaimed, but keep their data.
      const newPlayers = state.players.map(p => 
        p.id === myPlayerId 
        ? { ...p, isClaimed: false, status: 'offline' }
        : p
      );
      
      let newHostId = state.hostId;
      if (myPlayerId === state.hostId) {
          newHostId = findNextHost(newPlayers);
      }
      
      let nextPlayerIndex = state.currentPlayerIndex;
      const gameWasInProgress = !state.isGameOver;

      if (myPlayerId === state.currentPlayerIndex && gameWasInProgress) {
          nextPlayerIndex = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
      }
      
      const remainingPlayers = newPlayers.filter(p => p.isClaimed && !p.isSpectator);
      const activePlayersBeforeLeave = state.players.filter(p => p.isClaimed && !p.isSpectator).length;
      
      let finalState;

      if (gameWasInProgress && remainingPlayers.length < 2 && activePlayersBeforeLeave >= 2) {
          finalState = {
              ...state,
              players: newPlayers,
              hostId: newHostId,
              isGameOver: true,
              gameMessage: remainingPlayers.length === 1 
                ? `${remainingPlayers[0].name} победил, так как все остальные игроки вышли!`
                : 'Все игроки вышли. Игра окончена.',
          };
      } else {
          const nextPlayer = newPlayers[nextPlayerIndex];
          const nextPlayerName = nextPlayer ? nextPlayer.name : '';
          
          let message = `${me.name} покинул(а) игру.`;
          if(gameWasInProgress && nextPlayerName && myPlayerId === state.currentPlayerIndex) {
              message += ` Ход ${nextPlayerName}.`;
          }

          finalState = {
            ...state,
            players: newPlayers,
            hostId: newHostId,
            currentPlayerIndex: nextPlayerIndex,
            gameMessage: message,
          };
          
          if (myPlayerId === state.currentPlayerIndex && gameWasInProgress) {
              const cleanTurnState = createInitialState(1);
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

  const isFirstMoveEver = gameState.players.every(p => p.scores.length === 0);

  let displayMessage = gameState.gameMessage;
  if (gameState.isGameOver) {
      if (isHost && claimedPlayerCount < 2) {
          displayMessage = 'Недостаточно игроков для начала новой игры (нужно минимум 2).';
      } else if (!isHost) {
          const hostPlayer = gameState.players.find(p => p.id === gameState.hostId);
          const hostName = hostPlayer ? hostPlayer.name : 'хост';
          displayMessage = `${gameState.gameMessage} Ожидание, пока ${hostName} начнет новую игру.`;
      }
  }

  return React.createElement(
    React.Fragment,
    null,
    showRules && React.createElement(RulesModal, { onClose: () => setShowRules(false) }),
    isSpectatorsModalOpen && React.createElement(SpectatorsModal, { spectators: gameState.spectators, onClose: () => setIsSpectatorsModalOpen(false) }),
    React.createElement(
      'div', { className: "w-full h-full flex flex-col p-4 text-white overflow-hidden" },
      React.createElement('header', { className: "flex justify-between items-center mb-4 flex-shrink-0" },
        React.createElement('div', { className: "p-2 bg-black/50 rounded-lg text-sm" }, React.createElement('p', { className: "font-mono" }, `КОД КОМНАТЫ: ${roomCode}`)),
        React.createElement('h1', { onClick: () => setShowRules(true), className: "font-ruslan text-4xl text-yellow-300 cursor-pointer hover:text-yellow-200 transition-colors", title: "Показать правила" }, 'ТЫСЯЧА'),
        React.createElement('button', { onClick: handleLeaveGame, className: "px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold" }, isSpectator ? 'Вернуться в лобби' : 'Выйти из игры')
      ),
      React.createElement('div', { className: "flex-grow flex flex-col lg:grid lg:grid-cols-4 gap-4 min-h-0" },
        React.createElement('aside', { className: `lg:col-span-1 bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col transition-all duration-500 ease-in-out ${isScoreboardExpanded ? 'h-full' : 'flex-shrink-0'}` },
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
            React.createElement('button', { onClick: () => setIsScoreboardExpanded(!isScoreboardExpanded), className: "p-1 rounded-full hover:bg-slate-700/50 lg:hidden ml-auto" }, 
              React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: `h-6 w-6 text-yellow-300 transition-transform duration-300 ${isScoreboardExpanded ? 'rotate-180' : ''}`, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 },
                React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M19 9l-7 7-7-7" })
              )
            )
          ),
          React.createElement('div', { className: "flex-grow overflow-y-auto relative" },
            React.createElement('table', { className: "w-full text-sm text-left text-gray-300" },
              React.createElement('thead', { className: "text-xs text-yellow-300 uppercase bg-slate-800 sticky top-0 z-10" },
                React.createElement('tr', null, (() => {
                  const canJoin = myPlayerId === null && !isSpectator;
                  let joinButtonRendered = false;
                  const availableSlotsForJoin = gameState.players.filter(p => !p.isClaimed && !p.isSpectator).length;

                  return gameState.players.map(player => {
                    const hasHistory = player.isClaimed || player.isSpectator || player.name !== `Игрок ${player.id + 1}`;

                    if (hasHistory) {
                      const index = player.id;
                      return React.createElement('th', { key: `player-header-${player.id}`, scope: "col", className: `h-16 px-0 py-0 text-center align-middle transition-all duration-300 relative ${index === gameState.currentPlayerIndex && !gameState.isGameOver && player.isClaimed ? 'bg-yellow-400 text-slate-900' : 'bg-slate-700/50'} ${index === myPlayerId ? 'outline outline-2 outline-blue-400' : ''}` },
                        !player.isClaimed
                          ? React.createElement('div', { className: "flex flex-col items-center justify-center h-full py-2 text-gray-500" },
                              React.createElement('span', { className: "px-2 line-through" }, player.name),
                              React.createElement('span', { className: "text-xs italic" }, '(вышел)')
                            )
                          : React.createElement('div', { className: "flex flex-col items-center justify-center h-full py-2" },
                              React.createElement('span', { className: "px-2" }, player.name),
                              React.createElement(PlayerStatus, { player: player })
                            )
                      );
                    }

                    if (canJoin && !joinButtonRendered && availableSlotsForJoin > 0) {
                      joinButtonRendered = true;
                      return React.createElement('th', {
                        key: 'join-cell',
                        colSpan: availableSlotsForJoin,
                        className: 'p-0 align-middle'
                      }, React.createElement('button', {
                        onClick: handleJoinGame,
                        className: 'w-full h-16 bg-green-600 hover:bg-green-700 text-white font-bold transition-all text-center uppercase tracking-wider text-lg'
                      }, `Войти в игру (${availableSlotsForJoin} мест)`));
                    }
                    
                    return null;
                  });
                })())
              ),
              React.createElement('tbody', { className: `lg:table-row-group ${isScoreboardExpanded ? '' : 'hidden'}` },
                (() => {
                  const hasAnyPlayerJoined = gameState.players.some(p => p.isClaimed || p.isSpectator || p.name !== `Игрок ${p.id + 1}`);
                  const maxRounds = gameState.players.reduce((max, p) => Math.max(max, (p.scores ? p.scores.length : 0)), 0);

                  if (!hasAnyPlayerJoined) {
                     return React.createElement('tr', null, React.createElement('td', { colSpan: gameState.players.length, className: "py-4 px-2 text-center text-gray-400 italic" }, 'Ожидание игроков...'));
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
                   return React.createElement('td', { key: `total-score-${player.id}`, className: `h-10 px-2 text-center text-lg font-mono align-middle transition-colors duration-300 ${index === gameState.currentPlayerIndex && !gameState.isGameOver && player.isClaimed ? 'bg-yellow-400/80 text-slate-900' : 'bg-slate-900/50'} ${index === myPlayerId ? 'outline outline-2 outline-blue-400' : ''}` }, 
                     hasHistory ? calculateTotalScore(player) : ''
                   );
                 }))
              )
            )
          )
        ),
        React.createElement('main', { className: `relative flex-grow lg:col-span-3 bg-slate-900/70 rounded-xl border-2 flex flex-col justify-between transition-all duration-300 min-h-0 ${isDragOver && isMyTurn ? 'border-green-400 shadow-2xl shadow-green-400/20' : 'border-slate-600'} p-4`, onDragOver: (e) => {e.preventDefault(); setIsDragOver(true);}, onDrop: handleDrop, onDragLeave: () => setIsDragOver(false) },
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
            React.createElement('div', { className: "max-w-2xl mx-auto" },
              gameState.isGameOver
                ? React.createElement('button', { onClick: handleNewGame, disabled: !isHost || claimedPlayerCount < 2, className: "w-full py-4 bg-blue-600 hover:bg-blue-600 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, 'Новая Игра')
                : React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                    React.createElement('button', { onClick: handleRollDice, disabled: !isMyTurn || !gameState.canRoll || (isFirstMoveEver && myPlayerId !== gameState.hostId), className: "w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, rollButtonText),
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