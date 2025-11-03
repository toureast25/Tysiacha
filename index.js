

import React from 'react';
import ReactDOM from 'react-dom/client';

const { useState, useEffect, useCallback, useReducer, useRef } = React;

// --- MQTT Configuration ---
const MQTT_BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_TOPIC_PREFIX = 'tysiacha-game-aistudio-v2'; // Unique prefix to avoid collisions

// --- Компонент RulesModal ---
const RulesModal = ({ onClose }) => {
  return React.createElement(
    'div',
    {
      className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm",
      onClick: onClose,
      'aria-modal': "true",
      role: "dialog"
    },
    React.createElement(
      'div',
      {
        className: "relative w-full max-w-2xl max-h-[90vh] bg-slate-800 text-gray-300 rounded-2xl shadow-2xl border border-slate-600 flex flex-col",
        onClick: e => e.stopPropagation()
      },
      React.createElement(
        'header',
        { className: "flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0" },
        React.createElement('h2', { className: "font-ruslan text-3xl text-yellow-300" }, 'Правила Игры "Тысяча"'),
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: "text-gray-400 hover:text-white transition-colors p-1 rounded-full bg-slate-700 hover:bg-slate-600",
            'aria-label': "Закрыть правила"
          },
          React.createElement(
            'svg',
            { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 },
            React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" })
          )
        )
      ),
      React.createElement(
        'main',
        { className: "p-6 overflow-y-auto space-y-6" },
        React.createElement(
          'section',
          null,
          React.createElement('h3', { className: "text-xl font-bold text-yellow-400 mb-2" }, '1. Цель игры'),
          React.createElement('p', null, 'Первый игрок, набравший 1000 или более очков по итогам завершенного раунда, объявляется победителем.')
        ),
        React.createElement(
          'section',
          null,
          React.createElement('h3', { className: "text-xl font-bold text-yellow-400 mb-2" }, '2. Ход игрока'),
          React.createElement(
            'ul',
            { className: "list-disc list-inside space-y-1" },
            React.createElement('li', null, 'В начале своего хода вы бросаете 5 костей.'),
            React.createElement('li', null, 'После каждого броска вы обязаны отложить хотя бы одну очковую кость или комбинацию.'),
            React.createElement(
              'li',
              null,
              'После этого у вас есть выбор:',
              React.createElement(
                'ul',
                { className: "list-['-_'] list-inside ml-6 mt-1" },
                React.createElement('li', null, 'Записать: Завершить ход и добавить набранные очки к общему счёту.'),
                React.createElement('li', null, 'Бросить снова: Бросить оставшиеся кости, чтобы набрать больше очков.')
              )
            ),
            React.createElement('li', null, 'Ход продолжается до тех пор, пока вы не решите записать счёт или не получите "Болт".')
          )
        ),
        React.createElement(
          'section',
          null,
          React.createElement('h3', { className: "text-xl font-bold text-yellow-400 mb-2" }, '3. Подсчет очков'),
          React.createElement('p', { className: "mb-2 italic text-gray-400" }, 'Важно: Комбинация засчитывается, только если все её кости выпали в одном броске.'),
          React.createElement(
            'div',
            { className: "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4" },
            React.createElement(
              'div',
              null,
              React.createElement('h4', { className: "font-semibold text-lg text-white mb-1" }, 'Одиночные кости'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '1'), ' = 10 очков'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '5'), ' = 5 очков')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('h4', { className: "font-semibold text-lg text-white mb-1" }, 'Стрит (за 1 бросок)'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '1-2-3-4-5'), ' = 125 очков')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('h4', { className: "font-semibold text-lg text-white mb-1" }, 'Три одинаковых'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '1,1,1'), ' = 100'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '2,2,2'), ' = 20'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '3,3,3'), ' = 30'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '4,4,4'), ' = 40'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '5,5,5'), ' = 50'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '6,6,6'), ' = 60')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('h4', { className: "font-semibold text-lg text-white mb-1" }, 'Четыре одинаковых'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '1,1,1,1'), ' = 200'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '2,2,2,2'), ' = 40'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '3,3,3,3'), ' = 60'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '4,4,4,4'), ' = 80'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '5,5,5,5'), ' = 100'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '6,6,6,6'), ' = 120')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('h4', { className: "font-semibold text-lg text-white mb-1" }, 'Пять одинаковых'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '1,1,1,1,1'), ' = 1000'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '2,2,2,2,2'), ' = 200'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '3,3,3,3,3'), ' = 300'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '4,4,4,4,4'), ' = 400'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '5,5,5,5,5'), ' = 500'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '6,6,6,6,6'), ' = 600')
            )
          )
        ),
        React.createElement(
          'section',
          null,
          React.createElement('h3', { className: "text-xl font-bold text-yellow-400 mb-2" }, '4. Особые ситуации'),
          React.createElement(
            'dl',
            null,
            React.createElement('dt', { className: "font-semibold text-lg text-white" }, 'Болт'),
            React.createElement(
              'dd',
              { className: "ml-4 mb-2" },
              'Вы получаете "Болт" (отмечается как / в таблице), если:',
              React.createElement(
                'ul',
                { className: "list-disc list-inside mt-1" },
                React.createElement('li', null, 'Ваш бросок не принес ни одной очковой кости или комбинации.'),
                React.createElement('li', null, 'Вы решили записать счёт, набрав 0 очков за ход.')
              ),
              'При получении "Болта" все очки, набранные в текущем ходу, сгорают, и ход переходит к следующему игроку.'
            ),
            React.createElement('dt', { className: "font-semibold text-lg text-white" }, 'Горячие кости (Hot Dice)'),
            React.createElement('dd', { className: "ml-4" }, 'Если вы смогли отложить все 5 костей, вы можете сделать новый бросок всеми 5 костями, продолжая свой ход. Накопленные очки при этом сохраняются.')
          )
        ),
        React.createElement(
          'section',
          null,
          React.createElement('h3', { className: "text-xl font-bold text-yellow-400 mb-2" }, '5. Управление'),
          React.createElement(
            'ul',
            { className: "list-disc list-inside space-y-1" },
            React.createElement('li', null, 'Выбор костей: Кликайте на кости, чтобы выбрать их для комбинации.'),
            React.createElement('li', null, 'Отложить: Перетащите выбранные кости в зону игрового поля или сделайте двойной клик по одной из них.'),
            React.createElement('li', null, 'Ответственность игрока: Игра не подсказывает комбинации. Вы сами должны их находить и правильно откладывать.'),
            React.createElement('li', null, 'Дополнение комбинации: Если вы отложили часть комбинации (например, 3 шестерки из 4-х выпавших), вы можете до-отложить оставшуюся кость в рамках того же броска.')
          )
        )
      )
    )
  );
};


// --- Компонент Lobby ---
const Lobby = ({ onStartGame }) => {
  const [roomCode, setRoomCode] = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    // Pre-fill player name from a previous session if it exists
    const savedName = localStorage.getItem('tysiacha-playerName');
    if (savedName) {
        setPlayerName(savedName);
    }
  }, []);

  useEffect(() => {
    if (!isJoining) {
      generateRoomCode();
    }
  }, [isJoining]);

  const generateRoomCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
  };

  const handleStart = () => {
    const finalRoomCode = roomCode.trim();
    const finalPlayerName = playerName.trim();
    if (finalRoomCode.length >= 4 && finalPlayerName.length > 2) {
      localStorage.setItem('tysiacha-playerName', finalPlayerName);
      onStartGame(finalRoomCode, playerCount, finalPlayerName);
    }
  };

  return React.createElement(
    'div',
    { className: "w-full max-w-md p-8 bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700 text-center" },
    React.createElement('h2', { className: "font-ruslan text-5xl text-yellow-300 mb-6" }, isJoining ? 'Присоединиться' : 'Создать Игру'),
    React.createElement(
      'div',
      { className: "space-y-6" },
      React.createElement(
        'div',
        null,
        React.createElement(
          'label',
          { htmlFor: "playerName", className: "block text-lg font-semibold text-gray-300 mb-2" },
          'Ваше имя'
        ),
        React.createElement('input', {
          id: "playerName",
          type: "text",
          value: playerName,
          onChange: (e) => setPlayerName(e.target.value),
          placeholder: "Введите имя",
          className: "w-full p-3 text-center bg-slate-900 border-2 border-slate-600 rounded-lg text-xl font-semibold text-white focus:outline-none focus:border-yellow-400 transition-colors"
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement(
          'label',
          { htmlFor: "roomCode", className: "block text-lg font-semibold text-gray-300 mb-2" },
          isJoining ? 'Введите код комнаты' : 'Код вашей комнаты'
        ),
        React.createElement('input', {
          id: "roomCode",
          type: "text",
          value: roomCode,
          onChange: (e) => setRoomCode(e.target.value.toUpperCase()),
          readOnly: !isJoining,
          className: "w-full p-3 text-center bg-slate-900 border-2 border-slate-600 rounded-lg text-2xl font-mono tracking-widest text-white focus:outline-none focus:border-yellow-400 transition-colors"
        }),
        !isJoining && React.createElement('p', { className: "text-sm text-gray-400 mt-2" }, 'Поделитесь этим кодом с друзьями')
      ),
      React.createElement(
        'div',
        null,
        React.createElement(
          'label',
          { htmlFor: "playerCount", className: "block text-lg font-semibold text-gray-300 mb-2" },
          'Количество игроков'
        ),
        React.createElement(
          'div',
          { className: "flex items-center justify-center space-x-4" },
          [2, 3, 4, 5].map(num =>
            React.createElement(
              'button',
              {
                key: num,
                onClick: () => setPlayerCount(num),
                disabled: isJoining,
                className: `w-12 h-12 text-xl font-bold rounded-full transition-all ${playerCount === num && !isJoining ? 'bg-yellow-400 text-slate-900 scale-110' : 'bg-slate-700 text-white hover:bg-slate-600'} ${isJoining ? 'opacity-50 cursor-not-allowed' : ''}`
              },
              num
            )
          )
        )
      ),
      React.createElement(
        'button',
        {
          onClick: handleStart,
          className: "w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed",
          disabled: roomCode.trim().length < 4 || playerName.trim().length < 3
        },
        isJoining ? 'Войти' : 'Начать игру'
      ),
      React.createElement(
        'div',
        { className: "relative flex py-2 items-center" },
        React.createElement('div', { className: "flex-grow border-t border-gray-600" }),
        React.createElement('span', { className: "flex-shrink mx-4 text-gray-400" }, 'ИЛИ'),
        React.createElement('div', { className: "flex-grow border-t border-gray-600" })
      ),
      React.createElement(
        'button',
        {
          onClick: () => setIsJoining(!isJoining),
          className: "w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg"
        },
        isJoining ? 'Создать свою игру' : 'Присоединиться к игре'
      )
    )
  );
};


// --- Компонент Game ---

// Утилиты игровой логики
const analyzeDice = (dice) => {
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

const validateSelection = (dice) => {
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

const calculateTotalScore = (player) => {
    if (!player || !player.scores) return 0;
    return player.scores
        .filter(s => typeof s === 'number')
        .reduce((sum, s) => sum + s, 0);
};

// Вспомогательные компоненты для костей
const DiceIcon = ({ value, isSelected, onClick, onDragStart, onDoubleClick }) => {
  const dots = {
    1: ['center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'center', 'bottom-right'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right'],
  };

  const dotClasses = {
      'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      'top-left': 'top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2',
      'top-right': 'top-1/4 right-1/4 translate-x-1/2 -translate-y-1/2',
      'bottom-left': 'bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2',
      'bottom-right': 'bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2',
      'mid-left': 'top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2',
      'mid-right': 'top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2',
  }
  
  const baseClasses = "w-16 sm:w-20 aspect-square bg-slate-200 rounded-lg shadow-md flex items-center justify-center relative border-2 transition-all duration-200 flex-shrink-0";
  
  let stateClasses = "border-slate-400";
  if (onClick) {
      stateClasses += " cursor-pointer";
  }

  if (isSelected) {
      stateClasses = "border-yellow-400 scale-105 shadow-lg shadow-yellow-400/50 cursor-pointer";
  }
  
  if (value === 0) {
      return React.createElement('div', { className: `${baseClasses} bg-slate-700/50 border-slate-600 border-dashed` });
  }

  return React.createElement(
    'div',
    {
      className: `${baseClasses} ${stateClasses}`,
      onClick: onClick,
      onDoubleClick: onDoubleClick,
      draggable: !!onDragStart,
      onDragStart: onDragStart
    },
    value > 0 && dots[value] && dots[value].map(pos => 
      React.createElement('div', { key: pos, className: `absolute w-[18%] h-[18%] bg-slate-900 rounded-full ${dotClasses[pos]}` })
    )
  );
};

const SmallDiceIcon = ({ value }) => {
  const dots = {
    1: ['center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'center', 'bottom-right'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right'],
  };

  const dotClasses = {
      'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      'top-left': 'top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2',
      'top-right': 'top-1/4 right-1/4 translate-x-1/2 -translate-y-1/2',
      'bottom-left': 'bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2',
      'bottom-right': 'bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2',
      'mid-left': 'top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2',
      'mid-right': 'top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2',
  }
  
  return React.createElement(
    'div',
    { className: "w-10 h-10 bg-slate-300 rounded shadow-sm flex items-center justify-center relative border border-slate-400" },
    value > 0 && dots[value] && dots[value].map(pos => 
      React.createElement('div', { key: pos, className: `absolute w-2 h-2 bg-slate-900 rounded-full ${dotClasses[pos]}` })
    )
  );
};

const createInitialState = (pCount) => {
  return {
    players: Array.from({ length: pCount }, (_, i) => ({ 
        id: i, 
        name: `Игрок ${i + 1}`, 
        scores: [], 
        isClaimed: false,
        status: 'offline', // 'online', 'away', 'disconnected'
        isSpectator: false,
    })),
    spectators: [],
    currentPlayerIndex: 0,
    diceOnBoard: [],
    keptDiceThisTurn: [],
    diceKeptFromThisRoll: [],
    selectedDiceIndices: [],
    scoreFromPreviousRolls: 0,
    currentTurnScore: 0,
    potentialScore: 0,
    gameMessage: `Ожидание игроков...`,
    isGameOver: false,
    canRoll: true,
    canBank: false,
    canKeep: false,
    turnStartTime: 0,
    version: 1,
  };
};

const Game = ({ roomCode, playerCount, playerName, onExit }) => {
  const [gameState, setGameState] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isScoreboardExpanded, setIsScoreboardExpanded] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const mqttClientRef = useRef(null);
  const isStateReceivedRef = useRef(false);
  const lastSeenTimestampsRef = useRef({});

  const topic = `${MQTT_TOPIC_PREFIX}/${roomCode}`;
  const presenceTopic = `${topic}/presence`;
  
  // This effect ensures the session is saved when a player ID is assigned
  useEffect(() => {
    if (myPlayerId !== null) {
        const sessionData = { roomCode, playerCount, playerName, myPlayerId };
        localStorage.setItem('tysiacha-session', JSON.stringify(sessionData));
    }
  }, [myPlayerId, roomCode, playerCount, playerName]);

  const publishState = useCallback((newState) => {
    if (mqttClientRef.current && mqttClientRef.current.connected) {
      const stateWithVersion = { ...newState, version: (gameState?.version || 0) + 1 };
      mqttClientRef.current.publish(topic, JSON.stringify(stateWithVersion), { retain: true });
    }
  }, [topic, gameState]);

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
                        // Check if I have been made a spectator by timeout
                        if(myPlayerId !== null && receivedState.players[myPlayerId]?.isSpectator){
                            setIsSpectator(true);
                            localStorage.removeItem('tysiacha-session');
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

    // Status checking interval (only player 0 acts as the "host" for this)
    const statusCheckInterval = setInterval(() => {
        if (myPlayerId === 0 && gameState) {
            const now = Date.now();
            let needsUpdate = false;
            let activePlayersCount = 0;

            const newPlayers = gameState.players.map(p => {
                if (!p.isClaimed || p.isSpectator) return p;
                
                activePlayersCount++;
                const lastSeen = lastSeenTimestampsRef.current[p.id] || 0;
                let newStatus = p.status;

                if (now - lastSeen > 600000) { // 10 minutes timeout
                    newStatus = 'disconnected';
                    p.isSpectator = true; // Remove from game
                    needsUpdate = true;
                } else if (now - lastSeen > 60000) { // 60 seconds
                    newStatus = 'disconnected';
                } else if (now - lastSeen > 10000) { // 10 seconds
                    newStatus = 'away';
                } else {
                    newStatus = 'online';
                }

                if (newStatus !== p.status) {
                    needsUpdate = true;
                    p.status = newStatus;
                }
                return p;
            });
            
            const remainingPlayers = newPlayers.filter(p => p.isClaimed && !p.isSpectator);
            if (remainingPlayers.length === 1 && activePlayersCount > 1 && !gameState.isGameOver) {
                 publishState({
                    ...gameState,
                    players: newPlayers,
                    isGameOver: true,
                    gameMessage: `${remainingPlayers[0].name} победил, так как все остальные игроки вышли!`,
                });
                return;
            }

            if (needsUpdate) {
                publishState({ ...gameState, players: newPlayers });
            }
        }
    }, 2000);

    client.on('error', () => setConnectionStatus('error'));
    client.on('offline', () => setConnectionStatus('reconnecting'));
    client.on('reconnect', () => setConnectionStatus('reconnecting'));

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(statusCheckInterval);
      if (client) client.end();
    };
  }, [roomCode, playerCount, playerName]); // Dependencies are correct


  // --- Game Logic Actions ---
  const handleRollDice = () => {
    const state = gameState;
    if (!state.canRoll || state.isGameOver) return;

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
  
  const handleLeaveAndSpectate = () => {
      if (myPlayerId === null) return;
      
      const me = gameState.players[myPlayerId];
      const newPlayers = gameState.players.map(p => p.id === myPlayerId ? {...p, isSpectator: true, isClaimed: false } : p);
      const newSpectators = [...gameState.spectators, { name: me.name, score: calculateTotalScore(me) }];
      
      let nextPlayerIndex = gameState.currentPlayerIndex;
      if (myPlayerId === gameState.currentPlayerIndex) {
          nextPlayerIndex = findNextActivePlayer(gameState.currentPlayerIndex, newPlayers);
      }
      
      publishState({ ...gameState, players: newPlayers, spectators: newSpectators, currentPlayerIndex: nextPlayerIndex });
      
      setIsSpectator(true);
      localStorage.removeItem('tysiacha-session');
  }

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
  const rollButtonText = (gameState.keptDiceThisTurn.length >= 5 ? 5 : 5 - gameState.keptDiceThisTurn.length) === 5 
    ? 'Бросить все' : `Бросить ${5 - gameState.keptDiceThisTurn.length}`;
  const firstAvailableSlotIndex = gameState.players.findIndex(p => !p.isClaimed && !p.isSpectator);
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isCurrentPlayerInactive = currentPlayer && (currentPlayer.status === 'away' || currentPlayer.status === 'disconnected');
  const showSkipButton = !isMyTurn && isCurrentPlayerInactive && !gameState.isGameOver && (Date.now() - gameState.turnStartTime > 60000);

  return React.createElement(
    React.Fragment,
    null,
    showRules && React.createElement(RulesModal, { onClose: () => setShowRules(false) }),
    React.createElement(
      'div', { className: "w-full h-full flex flex-col p-4 text-white overflow-hidden" },
      React.createElement('header', { className: "flex justify-between items-center mb-4 flex-shrink-0" },
        React.createElement('div', { className: "p-2 bg-black/50 rounded-lg text-sm" }, React.createElement('p', { className: "font-mono" }, `КОД КОМНАТЫ: ${roomCode}`)),
        React.createElement('h1', { onClick: () => setShowRules(true), className: "font-ruslan text-4xl text-yellow-300 cursor-pointer hover:text-yellow-200 transition-colors", title: "Показать правила" }, 'ТЫСЯЧА'),
        React.createElement('button', { onClick: isSpectator ? onExit : handleLeaveAndSpectate, className: "px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold" }, isSpectator ? 'Вернуться в лобби' : 'Покинуть игру')
      ),
      React.createElement('div', { className: "flex-grow flex flex-col lg:grid lg:grid-cols-4 gap-4 min-h-0" },
        React.createElement('aside', { className: `lg:col-span-1 bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col transition-all duration-500 ease-in-out ${isScoreboardExpanded ? 'h-full' : 'flex-shrink-0'}` },
          React.createElement('div', { className: "flex justify-between items-center mb-4 flex-shrink-0 flex-wrap" },
            React.createElement('h2', { className: "font-ruslan text-3xl text-yellow-300" }, 'Игроки'),
            gameState.spectators.length > 0 && React.createElement('div', { className: "text-sm text-gray-400 ml-auto mr-2" }, `Зрители: ${gameState.spectators.length}`),
            React.createElement('button', { onClick: () => setIsScoreboardExpanded(!isScoreboardExpanded), className: "p-1 rounded-full hover:bg-slate-700/50 lg:hidden" }, 
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
              React.createElement('p', { className: "text-lg font-semibold" }, gameState.gameMessage)
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
                ? React.createElement('button', { onClick: handleNewGame, className: "w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg" }, 'Новая Игра')
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


// --- Компонент App ---
const App = () => {
  const [screen, setScreen] = useState('LOBBY');
  const [gameProps, setGameProps] = useState({});

  useEffect(() => {
    try {
        const savedSession = localStorage.getItem('tysiacha-session');
        if (savedSession) {
            const { roomCode, playerCount, playerName } = JSON.parse(savedSession);
            // We don't pass myPlayerId here, Game component will restore it itself
            handleStartGame(roomCode, playerCount, playerName);
        }
    } catch(e) {
        console.error("Failed to load session:", e);
        localStorage.removeItem('tysiacha-session');
    }
  }, []);

  const handleStartGame = useCallback((roomCode, playerCount, playerName) => {
    setGameProps({ roomCode, playerCount, playerName });
    setScreen('GAME');
  }, []);

  const handleExitGame = useCallback(() => {
    localStorage.removeItem('tysiacha-session');
    setGameProps({});
    setScreen('LOBBY');
  }, []);

  const renderScreen = () => {
    switch (screen) {
      case 'GAME':
        return React.createElement(Game, { key: gameProps.roomCode, ...gameProps, onExit: handleExitGame });
      case 'LOBBY':
      default:
        return React.createElement(Lobby, { onStartGame: handleStartGame });
    }
  };

  return React.createElement(
    'main',
    {
      className: "w-screen h-screen bg-cover bg-center bg-no-repeat text-white",
      style: { backgroundImage: "url('https://images.unsplash.com/photo-1585501374353-8199cf8e1324?q=80&w=1920&auto=format&fit=crop')" }
    },
    React.createElement(
      'div',
      { className: "w-full h-full bg-black/70 backdrop-blur-sm flex items-center justify-center" },
      renderScreen()
    )
  );
};


// --- Точка входа в приложение ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Не удалось найти корневой элемент для монтирования");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(App)
  )
);
