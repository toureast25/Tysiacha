// 
import React from 'react';
import { MQTT_BROKER_URL, MQTT_TOPIC_PREFIX } from '../constants.js';
import { analyzeDice, validateSelection, calculateTotalScore, createInitialState } from '../utils/gameLogic.js';
import RulesModal from './RulesModal.js';
import SpectatorsModal from './SpectatorsModal.js';
import { DiceIcon, SmallDiceIcon } from './Dice.js';

const { useState, useEffect, useCallback, useRef } = React;

const Game = ({ roomCode, playerCount, playerName, onExit }) => {
  const [gameState, setGameState] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isScoreboardExpanded, setIsScoreboardExpanded] = useState(false);
  const [isSpectatorsModalOpen, setIsSpectatorsModalOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const mqttClientRef = useRef(null);
  const isStateReceivedRef = useRef(false);
  const lastSeenTimestampsRef = useRef({});
  const gameStateRef = useRef(); // Ref to hold the latest game state for intervals/callbacks

  // Keep the ref updated with the latest state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
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
  useEffect(() => {
    if (myPlayerId !== null) {
        const sessionData = { roomCode, playerCount, playerName, myPlayerId };
        localStorage.setItem('tysiacha-session', JSON.stringify(sessionData));
        // Save the last room the user actively played in
        if (!isSpectator) {
          localStorage.setItem('tysiacha-lastRoom', roomCode);
        }
    }
  }, [myPlayerId, roomCode, playerCount, playerName, isSpectator]);

  const publishState = useCallback((newState) => {
    if (mqttClientRef.current && mqttClientRef.current.connected) {
      const currentVersion = gameStateRef.current?.version || 0;
      const stateWithVersion = { ...newState, version: currentVersion + 1 };
      mqttClientRef.current.publish(topic, JSON.stringify(stateWithVersion), { retain: true });
    }
  }, [topic]);

  const findNextActivePlayer = useCallback((startIndex, players) => {
      let nextIndex = (startIndex + 1) % players.length;
      while (nextIndex !== startIndex) {
          if (players[nextIndex].isClaimed && !players[nextIndex].isSpectator) {
              return nextIndex;
          }
          nextIndex = (nextIndex + 1) % players.length;
      }
      return startIndex; // Only one player left
  }, []);

  useEffect(() => {
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
            const initialState = createInitialState(playerCount);
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
                setGameState(state => {
                    if (!state || receivedState.version > state.version) {
                        // Check if I have been made a spectator by timeout (this logic is now deprecated by slot reset)
                        if(myPlayerId !== null && receivedState.players[myPlayerId]?.isSpectator){
                            setIsSpectator(true);
                            localStorage.removeItem('tysiacha-session');
                        }
                        // Check if my slot has been reset
                         if(myPlayerId !== null && !receivedState.players[myPlayerId]?.isClaimed){
                            onExit(); // Go to lobby if kicked
                        }
                        return receivedState;
                    }
                    return state;
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
            if (now - lastSeen > 600000) {
                // If player is still marked as claimed, reset them.
                const initialPlayerState = createInitialState(playerCount).players[playerCopy.id];
                needsUpdate = true;
                return { ...initialPlayerState, id: playerCopy.id };
            }

            // Status update check
            let newStatus = playerCopy.status;
            if (now - lastSeen > 60000) { // 60 seconds
                newStatus = 'disconnected';
            } else if (now - lastSeen > 10000) { // 10 seconds
                newStatus = 'away';
            } else {
                newStatus = 'online';
            }

            if (newStatus !== playerCopy.status) {
                needsUpdate = true;
                playerCopy.status = newStatus;
            }
            return playerCopy;
        });

        // We only publish if a state change was detected.
        // The versioning on the receiver side will handle race conditions.
        if (needsUpdate) {
            const remainingPlayersAfterUpdate = newPlayers.filter(p => p.isClaimed && !p.isSpectator);
            
            if (remainingPlayersAfterUpdate.length === 1 && activePlayersCountBeforeUpdate > 1 && !localGameState.isGameOver) {
                 publishState({
                    ...localGameState,
                    players: newPlayers,
                    isGameOver: true,
                    gameMessage: `${remainingPlayersAfterUpdate[0].name} победил, так как все остальные игроки вышли!`,
                });
                return; // End early if game is over
            }
            
            publishState({ ...localGameState, players: newPlayers });
        }
    }, 5000); // Check every 5 seconds

    client.on('error', () => setConnectionStatus('error'));
    client.on('offline', () => setConnectionStatus('reconnecting'));
    client.on('reconnect', () => setConnectionStatus('reconnecting'));

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(statusCheckInterval);
      if (client) client.end();
    };
  }, [roomCode, playerCount, playerName, publishState]); // Dependencies are correct


  // --- Game Logic Actions ---
  const handleRollDice = () => {
    const state = gameState;
    if (!state.canRoll || state.isGameOver) return;
    
    // First move can only be made by the host (player 0)
    const isFirstMoveEver = state.players.every(p => p.scores.length === 0);
    if (isFirstMoveEver && myPlayerId !== 0) {
      return; // Should be blocked by UI, but this is a safeguard
    }

    const claimedPlayerCount = state.players.filter(p => p.isClaimed && !p.isSpectator).length;
    if (claimedPlayerCount < 2 && state.players.every(p => p.scores.length === 0)) {
        publishState({ ...state, gameMessage: "Нужно как минимум 2 игрока, чтобы начать игру." });
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
        ...createInitialState(playerCount),
        players: newPlayers,
        spectators: state.spectators,
        currentPlayerIndex: nextPlayerIndex,
        diceOnBoard: newDice,
        gameMessage: `${state.players[state.currentPlayerIndex].name} получает болт! Ход ${nextPlayer.name}.`,
        turnStartTime: Date.now(),
      };
      publishState(boltState);
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
    publishState(newState);
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
    publishState(newState);
  };

  const handleKeepDice = (indices) => {
    const state = gameState;
    if (state.isGameOver) return;

    const newlySelectedValues = indices.map(i => state.diceOnBoard[i]);
    const combinedDiceForValidation = [...state.diceKeptFromThisRoll, ...newlySelectedValues];
    const validation = validateSelection(combinedDiceForValidation);

    if (!validation.isValid) {
        publishState({ ...state, gameMessage: "Неверный выбор. Эта кость не образует очковую комбинацию." });
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
    publishState(newState);
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
      publishState({ ...createInitialState(playerCount), players: newPlayersWithBolt, spectators: state.spectators, currentPlayerIndex: nextIdx, gameMessage: `${currentPlayer.name} получает болт. Ход ${nextPlayerName}.`, turnStartTime: Date.now() });
      return;
    }

    const newPlayers = state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, scores: [...p.scores, finalTurnScore] } : p);
    const totalScore = calculateTotalScore(newPlayers[state.currentPlayerIndex]);
    
    if (totalScore >= 1000) {
      publishState({ ...createInitialState(playerCount), players: newPlayers, spectators: state.spectators, isGameOver: true, gameMessage: `${currentPlayer.name} победил, набрав ${totalScore} очков!` });
      return;
    }

    const nextPlayerIndex = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
    const nextPlayerName = newPlayers[nextPlayerIndex].name;
    publishState({ ...createInitialState(playerCount), players: newPlayers, spectators: state.spectators, currentPlayerIndex: nextPlayerIndex, gameMessage: `${currentPlayer.name} записал ${finalTurnScore} очков. Ход ${nextPlayerName}.`, turnStartTime: Date.now() });
  };

  const handleSkipTurn = () => {
    const state = gameState;
    if(state.isGameOver || myPlayerId === state.currentPlayerIndex) return;
    
    const currentPlayer = state.players[state.currentPlayerIndex];
    if(currentPlayer.status === 'online') return;

    const newPlayers = state.players.map((p, i) => i === state.currentPlayerIndex ? { ...p, scores: [...p.scores, '/'] } : p);
    const nextIdx = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
    const nextPlayerName = newPlayers[nextIdx].name;
    publishState({ ...createInitialState(playerCount), players: newPlayers, spectators: state.spectators, currentPlayerIndex: nextIdx, gameMessage: `${currentPlayer.name} пропустил ход. Ход ${nextPlayerName}.`, turnStartTime: Date.now() });
  }

  const handleNewGame = () => {
      if (myPlayerId !== 0) return; // Only host can start a new game

      const newInitialState = createInitialState(playerCount);
      const newPlayers = newInitialState.players.map((p, i) => {
          const oldPlayer = gameState.players[i];
          if (oldPlayer && oldPlayer.isClaimed && !oldPlayer.isSpectator) {
              return { ...p, name: oldPlayer.name, isClaimed: true, status: 'offline' };
          }
          return p;
      });
      publishState({ ...newInitialState, players: newPlayers, turnStartTime: Date.now() });
  };


  const handleJoin = (playerIndex) => {
    const state = gameState;
    if (myPlayerId !== null || state.players[playerIndex].isClaimed) return;
    
    setMyPlayerId(playerIndex);

    const newPlayers = state.players.map((p, i) => {
      if (i === playerIndex) {
        return { ...p, name: playerName, isClaimed: true, scores: [], status: 'online' };
      }
      return p;
    });

    const claimedPlayerCount = newPlayers.filter(p => p.isClaimed && !p.isSpectator).length;
    const gameMessage = claimedPlayerCount > 1
        ? `Ход ${state.players[state.currentPlayerIndex].name}. Бросайте кости!`
        : `Ожидание игроков...`;

    publishState({ ...state, players: newPlayers, gameMessage });
  };
  
  const handleLeaveGame = () => {
      if (myPlayerId === null || isSpectator) {
        onExit(); // If spectator or not really in game, just exit to lobby
        return;
      }
      
      const state = gameState;
      const me = state.players[myPlayerId];
      const initialPlayerState = createInitialState(playerCount).players[myPlayerId];
      const newPlayers = state.players.map(p => 
        p.id === myPlayerId 
        ? { ...initialPlayerState, id: myPlayerId } // Reset player slot
        : p
      );
      
      let nextPlayerIndex = state.currentPlayerIndex;
      // If the current player is the one leaving, find the next active player
      if (myPlayerId === state.currentPlayerIndex) {
          nextPlayerIndex = findNextActivePlayer(state.currentPlayerIndex, newPlayers);
      }
      
      const remainingPlayers = newPlayers.filter(p => p.isClaimed && !p.isSpectator);
      const activePlayersBeforeLeave = state.players.filter(p => p.isClaimed && !p.isSpectator).length;
      
      let finalState;

      // If only one player remains, they win.
      if (remainingPlayers.length === 1 && activePlayersBeforeLeave > 1) {
          finalState = {
              ...state,
              players: newPlayers,
              spectators: state.spectators,
              isGameOver: true,
              gameMessage: `${remainingPlayers[0].name} победил, так как все остальные игроки вышли!`,
          };
      } else if (remainingPlayers.length === 0) {
          // If the last player leaves, reset the game state entirely
          finalState = createInitialState(playerCount);
          finalState.gameMessage = 'Все игроки вышли. Игра окончена.';
      }
      else {
          finalState = {
              ...state,
              players: newPlayers,
              spectators: state.spectators,
              currentPlayerIndex: nextPlayerIndex,
              gameMessage: `${me.name} покинул(а) игру.`,
          };
      }
      
      publishState(finalState);
      onExit(); // Go back to lobby
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
    return React.createElement('span', { className: `text-xs ml-1 ${color}` }, `(${text})`);
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
  const isHost = myPlayerId === 0;
  const rollButtonText = (gameState.keptDiceThisTurn.length >= 5 ? 5 : 5 - gameState.keptDiceThisTurn.length) === 5 
    ? 'Бросить все' : `Бросить ${5 - gameState.keptDiceThisTurn.length}`;
  const firstAvailableSlotIndex = gameState.players.findIndex(p => !p.isClaimed && !p.isSpectator);
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isCurrentPlayerInactive = currentPlayer && (currentPlayer.status === 'away' || currentPlayer.status === 'disconnected');
  const showSkipButton = !isMyTurn && isCurrentPlayerInactive && !gameState.isGameOver && (Date.now() - gameState.turnStartTime > 60000);

  const isFirstMoveEver = gameState.players.every(p => p.scores.length === 0);

  let displayMessage = gameState.gameMessage;
  if (gameState.isGameOver && !isHost) {
      displayMessage = `${gameState.gameMessage} Ожидание, пока хост начнет новую игру.`;
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
                React.createElement('tr', null, gameState.players.map((player, index) =>
                  React.createElement('th', { key: player.id, scope: "col", className: `h-16 px-0 py-0 text-center align-middle transition-all duration-300 relative ${index === gameState.currentPlayerIndex && !gameState.isGameOver ? 'bg-yellow-400 text-slate-900' : 'bg-slate-700/50'} ${index === myPlayerId ? 'outline outline-2 outline-blue-400' : ''}` },
                    player.isSpectator
                      ? React.createElement('span', { className: "px-2 text-gray-500 italic" }, 'Вышел')
                      : !player.isClaimed
                        ? (index === firstAvailableSlotIndex && myPlayerId === null && !isSpectator)
                          ? React.createElement('button', { onClick: () => handleJoin(index), className: "w-full h-full bg-green-600 hover:bg-green-700 font-bold text-white transition-colors" }, "Войти")
                          : React.createElement('span', { className: "px-2 text-gray-400" }, `Место ${index + 1}`)
                        : React.createElement('div', null, React.createElement('span', { className: "px-2" }, player.name), React.createElement(PlayerStatus, { player: player }))
                  )
                ))
              ),
              React.createElement('tbody', { className: `lg:table-row-group ${isScoreboardExpanded ? '' : 'hidden'}` },
                (() => {
                  const maxRounds = gameState.players.reduce((max, p) => Math.max(max, p.scores.length), 0);
                  if (maxRounds === 0) return React.createElement('tr', null, React.createElement('td', { colSpan: playerCount, className: "py-4 px-2 text-center text-gray-400 italic" }, 'Еще не было записано очков.'));
                  const rows = [];
                  for (let i = 0; i < maxRounds; i++) {
                    rows.push(React.createElement('tr', { key: i, className: "border-b border-slate-700 hover:bg-slate-700/30" },
                      gameState.players.map(player =>
                        React.createElement('td', { key: `${player.id}-${i}`, className: "py-2 px-2 text-center font-mono" }, player.scores[i] !== undefined ? player.scores[i] : React.createElement('span', { className: "text-slate-500" }, '-'))
                      )
                    ));
                  }
                  return rows;
                })()
              ),
              React.createElement('tfoot', { className: "sticky bottom-0 bg-slate-800 font-bold text-white border-t-2 border-slate-500" },
                React.createElement('tr', null, gameState.players.map((player, index) =>
                  React.createElement('td', { key: player.id, className: `h-10 px-2 text-center text-lg font-mono align-middle transition-colors duration-300 ${index === gameState.currentPlayerIndex && !gameState.isGameOver ? 'bg-yellow-400/80 text-slate-900' : 'bg-slate-900/50'} ${index === myPlayerId ? 'outline outline-2 outline-blue-400' : ''}` }, calculateTotalScore(player))
                ))
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
                ? React.createElement('button', { onClick: handleNewGame, disabled: !isHost, className: "w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, 'Новая Игра')
                : React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                    React.createElement('button', { onClick: handleRollDice, disabled: !isMyTurn || !gameState.canRoll || (isFirstMoveEver && myPlayerId !== 0), className: "w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, rollButtonText),
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