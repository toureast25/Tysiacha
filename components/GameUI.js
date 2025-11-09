// 
import React from 'react';
import { calculateTotalScore, getPlayerBarrelStatus } from '../utils/gameLogic.js';
import RulesModal from './RulesModal.js';
import SpectatorsModal from './SpectatorsModal.js';
import KickConfirmModal from './KickConfirmModal.js';
import PlayerContextMenu from './PlayerContextMenu.js';
import { DiceIcon, SmallDiceIcon } from './Dice.js';

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

const JoinRequestManager = ({ isHost, gameState, onJoinRequest }) => {
    if (!isHost || !gameState.joinRequests || gameState.joinRequests.length === 0) {
        return null;
    }
    return React.createElement('div', { className: 'absolute top-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-slate-700 border-2 border-yellow-400 rounded-lg shadow-lg z-20 animate-pulse' },
        React.createElement('h3', { className: 'text-lg font-bold text-yellow-300 mb-2 text-center' }, 'Запросы на присоединение'),
        React.createElement('ul', { className: 'space-y-2' },
            gameState.joinRequests.map(req => React.createElement('li', { key: req.sessionId, className: 'flex items-center justify-between p-2 bg-slate-800 rounded' },
                React.createElement('span', { className: 'text-white' }, req.name),
                React.createElement('div', { className: 'flex gap-2' },
                    React.createElement('button', { onClick: () => onJoinRequest(req.sessionId, true), className: 'px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm font-bold' }, 'Принять'),
                    React.createElement('button', { onClick: () => onJoinRequest(req.sessionId, false), className: 'px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm font-bold' }, 'Отклонить')
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


const GameUI = (props) => {
    const {
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
        onLeaveGame,
        onSetShowRules,
        onSetIsSpectatorsModalOpen,
        onSetIsScoreboardExpanded,
        onSetIsDragOver,
        onRollDice,
        onBankScore,
        onSkipTurn,
        onNewGame,
        onStartOfficialGame,
        onJoinGame,
        onJoinRequest,
        onToggleDieSelection,
        onDragStart,
        onDrop,
        onDieDoubleClick,
        onInitiateKick,
        onConfirmKick,
        onCancelKick,
    } = props;

    const [contextMenu, setContextMenu] = React.useState({
        isOpen: false,
        player: null,
        x: 0,
        y: 0,
    });

    const handlePlayerHeaderClick = (event, player) => {
        event.preventDefault();
        setContextMenu({
            isOpen: true,
            player: player,
            x: event.clientX,
            y: event.clientY,
        });
    };

    const handleContextMenuAction = (action, player) => {
        setContextMenu({ isOpen: false, player: null, x: 0, y: 0 }); // Close menu first
        if (action === 'kick') {
            onInitiateKick(player);
        }
    };


    return React.createElement(
        React.Fragment,
        null,
        showRules && React.createElement(RulesModal, { onClose: () => onSetShowRules(false) }),
        isSpectatorsModalOpen && React.createElement(SpectatorsModal, { spectators: gameState.spectators, onClose: () => onSetIsSpectatorsModalOpen(false) }),
        kickConfirmState.isOpen && React.createElement(KickConfirmModal, { playerToKick: kickConfirmState.player, onConfirm: onConfirmKick, onCancel: onCancelKick }),
        contextMenu.isOpen && React.createElement(PlayerContextMenu, {
            player: contextMenu.player,
            position: { x: contextMenu.x, y: contextMenu.y },
            onClose: () => setContextMenu({ isOpen: false, player: null, x: 0, y: 0 }),
            onAction: handleContextMenuAction,
        }),
        React.createElement(
          'div', { className: "w-full h-full flex flex-col p-2 sm:p-4 text-white overflow-hidden" },
          React.createElement('header', { className: "flex justify-between items-center mb-2 sm:mb-4 flex-shrink-0" },
            React.createElement('div', { className: "p-2 bg-black/50 rounded-lg text-sm" }, React.createElement('p', { className: "font-mono" }, `КОД КОМНАТЫ: ${roomCode}`)),
            React.createElement('h1', { onClick: () => onSetShowRules(true), className: "font-ruslan text-4xl text-yellow-300 cursor-pointer hover:text-yellow-200 transition-colors", title: "Показать правила" }, 'ТЫСЯЧА'),
            React.createElement('button', { onClick: onLeaveGame, className: "px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold" }, isSpectator || canJoin ? 'Вернуться в лобби' : 'Выйти из игры')
          ),
          React.createElement('div', { className: "flex-grow flex flex-col lg:grid lg:grid-cols-4 gap-2 sm:gap-4 min-h-0" },
            React.createElement('aside', { className: `bg-slate-800/80 p-2 sm:p-4 border border-slate-700 flex flex-col transition-all duration-500 ease-in-out lg:col-span-1 rounded-xl ${isScoreboardExpanded ? 'flex-grow' : 'flex-shrink-0'}` },
              React.createElement('div', { className: "flex justify-between items-center mb-2 sm:mb-4 flex-shrink-0" },
                React.createElement('h2', { className: "font-ruslan text-3xl text-yellow-300 flex items-baseline" },
                  'Игроки',
                  gameState.spectators.length > 0 && React.createElement('span', { className: "text-xl ml-2 font-normal font-['Roboto_Condensed']" },
                    '(',
                    React.createElement('button',
                      {
                        onClick: () => onSetIsSpectatorsModalOpen(true),
                        className: "text-blue-400 hover:text-blue-300 hover:underline"
                      },
                      `Зрители: ${gameState.spectators.length}`
                    ),
                    ')'
                  )
                ),
                React.createElement('button', { onClick: () => onSetIsScoreboardExpanded(!isScoreboardExpanded), className: "p-1 rounded-full hover:bg-slate-700/50 lg:hidden ml-auto z-50" }, 
                  React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: `h-6 w-6 text-yellow-300 transition-transform duration-300 ${isScoreboardExpanded ? 'rotate-180' : ''}`, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 },
                    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M19 9l-7 7-7-7" })
                  )
                )
              ),
              React.createElement('div', { className: "flex-grow overflow-auto relative" },
                React.createElement('table', { className: "w-full table-fixed text-sm text-left text-gray-300 border-collapse" },
                  React.createElement('thead', { className: "text-xs text-yellow-300 uppercase bg-slate-800 sticky top-0 z-10" },
                    React.createElement('tr', null, 
                      gameState.players.map(player => {
                        const index = player.id;
                        const isUnclaimedAndEmpty = !player.isClaimed && player.name === `Игрок ${player.id + 1}`;
                        const barrelStatus = getPlayerBarrelStatus(player);
                        const isHostPlayer = player.id === gameState.hostId;
                        const isKickable = isHost && player.isClaimed && player.id !== myPlayerId;
                
                        let headerClasses = `h-14 sm:h-16 px-0 py-0 text-center align-middle transition-all duration-300 relative border-r border-slate-600 last:border-r-0 ${index === gameState.currentPlayerIndex && gameState.isGameStarted && !gameState.isGameOver && player.isClaimed ? 'bg-yellow-400 text-slate-900' : 'bg-slate-700/50'}`;
                        if (isKickable) {
                            headerClasses += ' cursor-pointer hover:bg-red-800/60';
                        }
                        
                        return React.createElement('th', { 
                            key: `player-header-${player.id}`, 
                            scope: "col", 
                            className: headerClasses,
                            onClick: isKickable ? (e) => handlePlayerHeaderClick(e, player) : undefined,
                            onContextMenu: isKickable ? (e) => handlePlayerHeaderClick(e, player) : undefined,
                            title: isKickable ? `Действия для игрока ${player.name}` : ''
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
                                  React.createElement('div', { className: "w-full flex items-center justify-center px-1" },
                                    isHostPlayer && React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-4 w-4 mr-1 text-yellow-400 flex-shrink-0", viewBox: "0 0 24 24", fill: "currentColor" },
                                      React.createElement('path', { d: "M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" })
                                    ),
                                    React.createElement('span', { className: "truncate", title: player.name }, player.name)
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
                  React.createElement('tbody', { className: `lg:table-row-group` },
                    (() => {
                      const hasAnyPlayerJoined = gameState.players.some(p => p.isClaimed || p.isSpectator || p.name !== `Игрок ${p.id + 1}`);
                      const maxRounds = gameState.players.reduce((max, p) => Math.max(max, (p.scores ? p.scores.length : 0)), 0);
    
                      const createPlaceholderRow = (text) => {
                        return React.createElement('tr', { className: `border-slate-700 ${isScoreboardExpanded ? 'border-b' : 'border-b-0 lg:border-b'}` },
                            React.createElement('td', {
                                colSpan: gameState.players.length,
                                className: `text-center text-gray-400 italic transition-all duration-500 ease-in-out ${isScoreboardExpanded ? 'p-2' : 'p-0 lg:p-2'}`
                            },
                                React.createElement('div', {
                                    className: `overflow-hidden transition-all duration-500 ease-in-out ${isScoreboardExpanded ? 'max-h-8' : 'max-h-0 lg:max-h-8'}`
                                }, text)
                            )
                        );
                      };

                      if (!hasAnyPlayerJoined) {
                         return createPlaceholderRow('Ожидание игроков...');
                      }
                      if (maxRounds === 0 && gameState.isGameStarted) {
                         return createPlaceholderRow('Никто еще не вошел в игру.');
                      }
                      if (maxRounds === 0) {
                         return createPlaceholderRow('Еще не было записано очков.');
                      }
                      
                      const rows = [];
                      for (let i = 0; i < maxRounds; i++) {
                        rows.push(React.createElement('tr', { key: `round-row-${i}`, className: `hover:bg-slate-700/30 border-slate-700 ${isScoreboardExpanded ? 'border-b' : 'border-b-0 lg:border-b'}` },
                          gameState.players.map(player =>
                            React.createElement('td', { 
                                key: `cell-${player.id}-${i}`, 
                                className: `text-center font-mono transition-all duration-500 ease-in-out border-r border-slate-600 last:border-r-0 ${isScoreboardExpanded ? 'p-2' : 'p-0 lg:p-2'}` 
                              },
                              React.createElement('div', {
                                className: `overflow-hidden transition-all duration-500 ease-in-out ${isScoreboardExpanded ? 'max-h-8' : 'max-h-0 lg:max-h-8'}`
                               },
                                 (player.isClaimed || player.isSpectator || player.scores.length > i) && player.scores[i] !== undefined ? player.scores[i] : React.createElement('span', { className: "text-slate-500" }, '-')
                               )
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
                       return React.createElement('td', { key: `total-score-${player.id}`, className: `h-8 sm:h-10 px-1 sm:px-2 text-center text-lg font-mono align-middle transition-colors duration-300 border-r border-slate-600 last:border-r-0 ${index === gameState.currentPlayerIndex && gameState.isGameStarted && !gameState.isGameOver && player.isClaimed ? 'bg-yellow-400/80 text-slate-900' : 'bg-slate-900/50'}` }, 
                         hasHistory ? calculateTotalScore(player) : ''
                       );
                     }))
                  )
                )
              )
            ),
            React.createElement('main', { className: `relative lg:col-span-3 bg-slate-900/70 rounded-xl border-2 flex flex-col justify-between min-h-0 p-2 sm:p-4 transition-all duration-500 ease-in-out ${isDragOver && isMyTurn ? 'border-green-400 shadow-2xl shadow-green-400/20' : 'border-slate-600'} ${isScoreboardExpanded ? 'flex-grow-0 opacity-0 pointer-events-none lg:flex-grow lg:opacity-100 lg:pointer-events-auto' : 'flex-grow'}`, onDragOver: (e) => {e.preventDefault(); onSetIsDragOver(true);}, onDrop: onDrop, onDragLeave: () => onSetIsDragOver(false) },
              React.createElement(JoinRequestManager, { isHost, gameState, onJoinRequest }),
              React.createElement('div', { className: "w-full" },
                React.createElement('div', { className: `w-full p-2 sm:p-3 mb-2 sm:mb-4 text-center rounded-lg ${gameState.isGameOver ? 'bg-green-600' : 'bg-slate-800'} border border-slate-600 flex items-center justify-center min-h-[60px] sm:min-h-[72px]` },
                  React.createElement('p', { className: "text-lg font-semibold" }, displayMessage)
                ),
                React.createElement('div', { className: "w-full flex justify-center md:justify-end" },
                  React.createElement('div', { className: "p-2 sm:p-3 rounded-lg bg-black/40 border border-slate-700 w-full md:w-auto md:min-w-[300px]" },
                    React.createElement('p', { className: "text-xs text-gray-400 mb-2 text-center uppercase tracking-wider" }, 'Отложено'),
                    React.createElement('div', { className: "flex gap-2 flex-wrap justify-center min-h-[40px] items-center" },
                      gameState.keptDiceThisTurn.length > 0
                        ? gameState.keptDiceThisTurn.map((value, i) => React.createElement(SmallDiceIcon, { key: `kept-${i}`, value: value }))
                        : React.createElement('span', { className: "text-slate-500 italic" }, 'Пусто')
                    )
                  )
                )
              ),
              React.createElement('div', { className: "flex-grow w-full flex flex-col items-center justify-center pt-2 pb-2 sm:pt-3 sm:pb-6 px-0 sm:px-4" },
                React.createElement('div', { className: "w-full sm:max-w-[480px] flex items-center justify-between min-h-[72px] sm:min-h-[80px]" },
                  gameState.diceOnBoard.map((value, i) => React.createElement(DiceIcon, { key: `board-${i}`, value: value, isSelected: gameState.selectedDiceIndices.includes(i), onClick: isMyTurn ? () => onToggleDieSelection(i) : null, onDragStart: isMyTurn ? (e) => onDragStart(e, i) : null, onDoubleClick: isMyTurn ? () => onDieDoubleClick(i) : null })),
                  Array.from({ length: 5 - gameState.diceOnBoard.length }).map((_, i) => React.createElement(DiceIcon, { key: `placeholder-${i}`, value: 0 }))
                )
              ),
              React.createElement('div', { className: "w-full" },
                 showSkipButton && React.createElement('div', {className: 'text-center mb-2'}, React.createElement('button', {onClick: onSkipTurn, className: 'px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold animate-pulse'}, `Пропустить ход ${currentPlayer.name}`)),
                React.createElement('div', { className: "text-center mb-2 sm:mb-4" },
                  React.createElement('p', { className: "text-xl" }, 'Очки за ход: ', React.createElement('span', { className: "font-ruslan text-5xl text-green-400" }, gameState.currentTurnScore + gameState.potentialScore))
                ),
                React.createElement('div', { className: "max-w-2xl mx-auto w-full" },
                  isAwaitingApproval
                    ? React.createElement(AwaitingApprovalScreen, null)
                    : canJoin
                      ? React.createElement('button', { 
                          onClick: onJoinGame, 
                          disabled: availableSlotsForJoin === 0, 
                          className: "w-full py-5 sm:py-4 bg-green-600 hover:bg-green-700 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" 
                        }, 
                          availableSlotsForJoin > 0 ? `Войти в игру (${availableSlotsForJoin} мест)` : 'Нет свободных мест'
                        )
                      : gameState.isGameOver
                        ? (isHost
                            ? React.createElement('button', { onClick: onNewGame, disabled: claimedPlayerCount < 2, className: "w-full py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, 'Новая Игра')
                            : null
                          )
                        : !gameState.isGameStarted 
                          ? (isHost
                              ? React.createElement('button', { onClick: onStartOfficialGame, disabled: claimedPlayerCount < 2, className: "w-full py-5 sm:py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, 'Начать игру')
                              : React.createElement('div', { className: "text-center text-lg text-gray-400" }, 'Ожидание начала игры от хоста...')
                            )
                          : React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4" },
                              React.createElement('button', { onClick: onRollDice, disabled: !isMyTurn || !gameState.canRoll, className: "w-full py-2 sm:py-3 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, rollButtonText),
                              React.createElement('button', { onClick: onBankScore, disabled: !isMyTurn || !gameState.canBank, className: "w-full py-2 sm:py-3 bg-yellow-500 hover:bg-yellow-600 text-slate-900 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100" }, 'Записать')
                            )
                )
              )
            )
          )
        )
    );
};

export default GameUI;