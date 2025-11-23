
import React from 'react';
import GameUI from './GameUI.js';
import { createLocalGameState, findNextHost } from '../utils/gameLogic.js';
import { useGameEngine } from './hooks/useGameEngine.js';
import { useMqtt } from './hooks/useMqtt.js';

const Game = ({ roomCode, playerName, initialMode, localConfig, onExit }) => {
  const isLocalMode = initialMode === 'local';
  
  // 1. Prepare Initial State for Hooks
  const initialLocalState = React.useMemo(() => {
      if (isLocalMode) {
           return createLocalGameState(localConfig?.playerCount || 2);
      }
      return null;
  }, [isLocalMode, localConfig]);
  
  // 2. Init Game Engine Hook
  const { gameState, dispatch, gameStateRef } = useGameEngine(initialLocalState, isLocalMode, localConfig);

  // 3. Local Identity State
  const [myPlayerId, setMyPlayerId] = React.useState(null);
  const [isSpectator, setIsSpectator] = React.useState(false);
  const [isHost, setIsHost] = React.useState(initialMode === 'create' || isLocalMode);
  
  const mySessionIdRef = React.useRef(sessionStorage.getItem('tysiacha-sessionId') || `sid_${Math.random().toString(36).substr(2, 9)}`);
  const wakeLockRef = React.useRef(null);

  // 4. Init Network Hook
  const { clientRef, connectionStatus, roomTopicRef } = useMqtt({
      roomCode,
      initialMode,
      playerName,
      isLocalMode,
      isHost,
      setIsHost,
      mySessionId: mySessionIdRef.current,
      dispatch,
      gameStateRef
  });

  // --- WAKE LOCK ---
  React.useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          const lock = await navigator.wakeLock.request('screen');
          wakeLockRef.current = lock;
          lock.addEventListener('release', () => {});
        } catch (err) { console.warn('Wake Lock error:', err); }
      }
    };
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && (!wakeLockRef.current || wakeLockRef.current.released)) requestWakeLock();
    };
    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {});
    };
  }, []);

  // --- SELF IDENTITY & SESSION STORAGE ---
  React.useEffect(() => {
    if (isLocalMode) return;

    sessionStorage.setItem('tysiacha-sessionId', mySessionIdRef.current);
    if (gameState) {
        const me = gameState.players.find(p => p.sessionId === mySessionIdRef.current);
        setMyPlayerId(me ? me.id : null);
        setIsSpectator(gameState.spectators.some(s => s.id === mySessionIdRef.current));
    }
  }, [gameState, isLocalMode]);

  // --- HOST MIGRATION (CLIENT SIDE) ---
  React.useEffect(() => {
    if (!isLocalMode && gameState && !isSpectator) {
         if (gameState.hostId === myPlayerId && !isHost) {
             console.log('[Game] Promoted to HOST via migration');
             setIsHost(true);
         }
    }
  }, [gameState, myPlayerId, isHost, isLocalMode, isSpectator]);

  // --- HOST BROADCAST ---
  // Send state updates to network if we are host
  React.useEffect(() => {
      if (isLocalMode) return; 

      if (isHost && gameState && clientRef.current && clientRef.current.connected) {
          localStorage.setItem(`tysiacha-state-${roomCode}`, JSON.stringify(gameState));
          clientRef.current.publish(roomTopicRef.current, JSON.stringify({ type: 'SET_STATE', payload: gameState, senderId: mySessionIdRef.current }));
      }
  }, [gameState, isHost, roomCode, isLocalMode]);

  // --- ACTION HANDLER ---
  const sendAction = (action) => {
      if (isLocalMode) {
          dispatch(action);
      } else if (isHost) {
          dispatch(action); // Host applies locally, broadcast effect sends it out
      } else if (clientRef.current && clientRef.current.connected) {
          clientRef.current.publish(roomTopicRef.current, JSON.stringify({ ...action, senderId: mySessionIdRef.current }));
      }
  };

  const manualRetry = () => {
      window.location.reload();
  };

  const [isScoreboardExpanded, setIsScoreboardExpanded] = React.useState(false);
  const [isSpectatorsModalOpen, setIsSpectatorsModalOpen] = React.useState(false);
  const [showRules, setShowRules] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [kickConfirmState, setKickConfirmState] = React.useState({ isOpen: false, player: null });

  // --- RENDER LOADING/ERROR STATES ---
  if (!gameState) {
      return React.createElement('div', { className: "text-center w-full p-8" }, 
        React.createElement('h2', { className: `font-ruslan text-4xl mb-4 ${connectionStatus === 'error' ? 'text-red-500' : 'text-title-yellow'}` }, 
            connectionStatus === 'error' ? 'Ошибка сети' : (connectionStatus === 'connected' ? 'Синхронизация...' : 'Подключение...')
        ),
        connectionStatus === 'error' && React.createElement('p', { className: "text-lg mb-6 max-w-md mx-auto" }, 'Не удалось подключиться к серверу игры. Попробуйте офлайн режим.'),
        connectionStatus === 'connected' && React.createElement('p', { className: "text-lg mb-6 max-w-md mx-auto" }, 'Ждем данные от хоста...'),
        (connectionStatus === 'connecting' || connectionStatus === 'reconnecting' || connectionStatus === 'connected') && React.createElement('div', { className: "w-8 h-8 border-4 border-t-transparent border-title-yellow rounded-full animate-spin mx-auto" }),
        React.createElement('div', { className: 'flex justify-center gap-4 mt-8' },
            React.createElement('button', { onClick: onExit, className: "px-4 py-2 bg-slate-700 hover:bg-slate-700 rounded" }, "В меню"),
            connectionStatus === 'error' && React.createElement('button', { onClick: manualRetry, className: "px-4 py-2 bg-green-600 hover:bg-green-700 rounded" }, "Повторить")
        )
      );
  }

  const isMyTurn = isLocalMode ? true : (myPlayerId === gameState.currentPlayerIndex && !isSpectator);
  
  const uiProps = {
    roomCode: isLocalMode ? 'LOCAL' : roomCode,
    gameState,
    myPlayerId: isLocalMode ? gameState.currentPlayerIndex : myPlayerId,
    isSpectator,
    isMyTurn,
    isHost: isHost, 
    canJoin: !isLocalMode && myPlayerId === null && !isSpectator,
    isAwaitingApproval: false,
    showRules,
    isSpectatorsModalOpen,
    isScoreboardExpanded,
    isDragOver,
    displayMessage: gameState.gameMessage,
    rollButtonText: (gameState.keptDiceThisTurn.length >= 5 ? 5 : 5 - gameState.keptDiceThisTurn.length) === 5 ? 'Бросить все' : `Бросить ${5 - gameState.keptDiceThisTurn.length}`,
    showSkipButton: false,
    claimedPlayerCount: gameState.players.filter(p => p.isClaimed && !p.isSpectator).length,
    availableSlotsForJoin: isLocalMode ? 0 : gameState.players.filter(p => !p.isClaimed && !p.isSpectator).length,
    currentPlayer: gameState.players[gameState.currentPlayerIndex],
    kickConfirmState,
    onLeaveGame: () => { 
        if (!isLocalMode) {
             sendAction({ type: 'PLAYER_LEAVE', payload: { sessionId: mySessionIdRef.current } }); 
             // Небольшая задержка перед размонтированием, чтобы сообщение успело уйти
             setTimeout(() => onExit(), 150);
        } else {
             onExit(); 
        }
    },
    onSetShowRules: setShowRules,
    onSetIsSpectatorsModalOpen: setIsSpectatorsModalOpen,
    onSetIsScoreboardExpanded: setIsScoreboardExpanded,
    onSetIsDragOver: setIsDragOver,
    onRollDice: () => sendAction({ type: 'ROLL_DICE' }),
    onBankScore: () => sendAction({ type: 'BANK_SCORE' }),
    onSkipTurn: () => sendAction({ type: 'SKIP_TURN' }),
    onNewGame: () => {
        if (isLocalMode) {
             const newState = createLocalGameState(localConfig?.playerCount || 2);
             dispatch({ type: 'SET_STATE', payload: newState });
        } else {
            sendAction({ type: 'NEW_GAME' });
        }
    },
    onStartOfficialGame: () => sendAction({ type: 'START_OFFICIAL_GAME' }),
    onJoinGame: () => sendAction({ type: 'PLAYER_JOIN', payload: { playerName, sessionId: mySessionIdRef.current } }),
    onJoinRequest: () => {}, 
    onToggleDieSelection: (index) => dispatch({ type: 'TOGGLE_DIE_SELECTION', payload: { index } }),
    onDragStart: (e, index) => { e.dataTransfer.setData('application/json', JSON.stringify([index])); },
    onDrop: (e) => { 
        e.preventDefault(); 
        setIsDragOver(false);
        try { 
            const indices = JSON.parse(e.dataTransfer.getData('application/json'));
            sendAction({ type: 'KEEP_DICE', payload: { indices } });
        } catch(e){} 
    },
    onDieDoubleClick: (index) => sendAction({ type: 'KEEP_DICE', payload: { indices: [index] } }),
    onInitiateKick: (player) => setKickConfirmState({ isOpen: true, player }),
    onConfirmKick: () => {
      if (kickConfirmState.player) sendAction({ type: 'KICK_PLAYER', payload: { playerId: kickConfirmState.player.id } });
      setKickConfirmState({ isOpen: false, player: null });
    },
    onCancelKick: () => setKickConfirmState({ isOpen: false, player: null }),
  };

  return React.createElement(GameUI, uiProps);
};

export default Game;
