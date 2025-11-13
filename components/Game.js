// 
import React from 'react';
import GameUI from './GameUI.js';
import useMqtt from './hooks/useMqtt.js';
import useGameEngine from './hooks/useGameEngine.js';
import { getPlayerBarrelStatus } from '../utils/gameLogic.js';

const Game = ({ roomCode, playerName, onExit }) => {
  const mySessionIdRef = React.useRef(sessionStorage.getItem('tysiacha-sessionId') || `sid_${Math.random().toString(36).substr(2, 9)}`);

  React.useEffect(() => {
    if (!sessionStorage.getItem('tysiacha-sessionId')) {
      sessionStorage.setItem('tysiacha-sessionId', mySessionIdRef.current);
    }
  }, []);

  const { connectionStatus, lastReceivedState, lastReceivedAction, lastReceivedSyncRequest, publishState, publishAction, requestStateSync } = useMqtt(roomCode, playerName, mySessionIdRef.current);

  const {
    gameState,
    myPlayerId,
    isSpectator,
    isLocked, // Получаем состояние блокировки
    requestGameAction,
    handleJoinGame,
    handleLeaveGame: engineHandleLeave,
  } = useGameEngine(lastReceivedState, lastReceivedAction, lastReceivedSyncRequest, publishState, publishAction, requestStateSync, playerName, mySessionIdRef.current);

  const [isScoreboardExpanded, setIsScoreboardExpanded] = React.useState(false);
  const [isSpectatorsModalOpen, setIsSpectatorsModalOpen] = React.useState(false);
  const [showRules, setShowRules] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [kickConfirmState, setKickConfirmState] = React.useState({ isOpen: false, player: null });

  React.useEffect(() => {
    if (playerName) {
      document.title = `Тысяча (${playerName}) - онлайн игра в кости`;
    }
    return () => {
      document.title = 'Тысяча - Онлайн Игра в Кости';
    };
  }, [playerName]);
  
  React.useEffect(() => {
    if (myPlayerId !== null) {
        const sessionData = { roomCode, playerName, myPlayerId };
        localStorage.setItem('tysiacha-session', JSON.stringify(sessionData));
        if (!isSpectator) {
          localStorage.setItem('tysiacha-lastRoom', roomCode);
        }
    }
  }, [myPlayerId, roomCode, playerName, isSpectator]);

  const handleLeaveGame = () => {
    engineHandleLeave(); 
    onExit();
  };

  const handleInitiateKick = (player) => {
    if (myPlayerId !== gameState.hostId) return;
    setKickConfirmState({ isOpen: true, player: player });
  };

  const handleConfirmKick = () => {
    if (kickConfirmState.player) {
      requestGameAction('kickPlayer', { 
          playerId: kickConfirmState.player.id,
          sessionId: kickConfirmState.player.sessionId 
      });
    }
    setKickConfirmState({ isOpen: false, player: null });
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
      requestGameAction('keepDice', { indices: gameState.selectedDiceIndices });
    } else {
      try {
        const indices = JSON.parse(e.dataTransfer.getData('application/json'));
        if (Array.isArray(indices)) requestGameAction('keepDice', { indices });
      } catch (error) { console.error("Drop error:", error); }
    }
  };

  const handleDieDoubleClick = (index) => {
    if (myPlayerId !== gameState.currentPlayerIndex) return;
    if (gameState.selectedDiceIndices.length > 0 && gameState.selectedDiceIndices.includes(index)) {
        if(gameState.canKeep) requestGameAction('keepDice', { indices: gameState.selectedDiceIndices });
    } else {
        requestGameAction('keepDice', { indices: [index] });
    }
  };
  
  if (connectionStatus !== 'connected' || !gameState) {
    return React.createElement('div', { className: "text-center" }, 
      React.createElement('h2', { className: "font-ruslan text-4xl text-title-yellow mb-4" }, 'Подключение...'),
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
  const showSkipButton = isHost && !isMyTurn && isCurrentPlayerInactive && !gameState.isGameOver && (Date.now() - gameState.turnStartTime > 60000);
  const canJoin = myPlayerId === null && !isSpectator;
  const availableSlotsForJoin = gameState.players.filter(p => !p.isClaimed && !p.isSpectator).length;
  
  // Здесь мы напрямую обрабатываем joinRequests, так как это специфичная логика для хоста
  const handleJoinRequest = (sessionId, approved) => {
    requestGameAction('handleJoinRequest', { sessionId, approved });
  };
  const isAwaitingApproval = myPlayerId === null && gameState.joinRequests && gameState.joinRequests.some(r => r.sessionId === mySessionIdRef.current);


  let displayMessage = gameState.gameMessage;
  const myBarrelStatus = isMyTurn && currentPlayer ? getPlayerBarrelStatus(currentPlayer) : null;

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
  
  const uiProps = {
    roomCode,
    gameState,
    myPlayerId,
    isSpectator,
    isMyTurn,
    isHost,
    canJoin,
    isAwaitingApproval,
    showRules,
    isSpectatorsModalOpen,
    isScoreboardExpanded,
    isDragOver,
    displayMessage,
    rollButtonText,
    showSkipButton,
    claimedPlayerCount,
    availableSlotsForJoin,
    currentPlayer,
    kickConfirmState,
    isLocked, // Передаем состояние блокировки в UI
    onLeaveGame: handleLeaveGame,
    onSetShowRules: setShowRules,
    onSetIsSpectatorsModalOpen: setIsSpectatorsModalOpen,
    onSetIsScoreboardExpanded: setIsScoreboardExpanded,
    onSetIsDragOver: setIsDragOver,
    onRollDice: () => requestGameAction('rollDice'),
    onBankScore: () => requestGameAction('bankScore'),
    onSkipTurn: () => requestGameAction('skipTurn'),
    onNewGame: () => requestGameAction('newGame'),
    onStartOfficialGame: () => requestGameAction('startOfficialGame'),
    onJoinGame: handleJoinGame,
    onJoinRequest: handleJoinRequest,
    onToggleDieSelection: (index) => requestGameAction('toggleDieSelection', { index }),
    onDragStart: handleDragStart,
    onDrop: handleDrop,
    onDieDoubleClick: handleDieDoubleClick,
    onInitiateKick: handleInitiateKick,
    onConfirmKick: handleConfirmKick,
    onCancelKick: () => setKickConfirmState({ isOpen: false, player: null }),
  };

  return React.createElement(GameUI, uiProps);
};

export default Game;