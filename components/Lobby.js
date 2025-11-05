// 
import React from 'react';
import { MQTT_BROKER_URL, MQTT_TOPIC_PREFIX } from '../constants.js';

const Lobby = ({ onStartGame }) => {
  const [roomCode, setRoomCode] = React.useState('');
  const [playerName, setPlayerName] = React.useState('');
  const [roomStatus, setRoomStatus] = React.useState(null); // { status: 'loading' | 'found' | 'not_found', message?: string, data?: { hostName: string, playerCount: number } }
  const [isClientConnected, setIsClientConnected] = React.useState(false);
  
  const mqttClientRef = React.useRef(null);
  const statusCheckTimeoutRef = React.useRef(null);
  const currentTopicRef = React.useRef(null);
  const debounceTimeoutRef = React.useRef(null);

  // Effect to load saved data and generate initial room code if needed
  React.useEffect(() => {
    const savedName = localStorage.getItem('tysiacha-playerName');
    if (savedName) {
      setPlayerName(savedName);
    }
    const lastRoom = localStorage.getItem('tysiacha-lastRoom');
    if (lastRoom) {
      setRoomCode(lastRoom);
    } else {
      generateRoomCode();
    }
  }, []);

  // Effect to manage the single MQTT client lifecycle
  React.useEffect(() => {
    const client = mqtt.connect(MQTT_BROKER_URL);
    mqttClientRef.current = client;

    client.on('connect', () => {
      setIsClientConnected(true);
    });

    client.on('close', () => {
      setIsClientConnected(false);
    });
    client.on('error', () => {
      setIsClientConnected(false);
    });

    const onMessage = (topic, message) => {
      // Check if the message is for the topic we are currently interested in
      if (topic === currentTopicRef.current) {
        clearTimeout(statusCheckTimeoutRef.current);
        try {
          const state = JSON.parse(message.toString());
          const host = state.players.find(p => p.id === state.hostId);
          const playerCount = state.players.filter(p => p.isClaimed && !p.isSpectator).length;
          setRoomStatus({
            status: 'found',
            data: {
              hostName: host ? host.name : 'Неизвестен',
              playerCount: playerCount,
            }
          });
        } catch (e) {
          setRoomStatus({ status: 'found' }); // Found, but couldn't parse details
        }
      }
    };
    
    client.on('message', onMessage);

    return () => {
      if (client) {
        client.end(true);
      }
    };
  }, []);

  // Debounced effect to check room status, now depends on client connection
  React.useEffect(() => {
    clearTimeout(debounceTimeoutRef.current);
    clearTimeout(statusCheckTimeoutRef.current);

    const code = roomCode.trim().toUpperCase();
    const client = mqttClientRef.current;

    if (!isClientConnected || code.length < 4) {
      setRoomStatus(null);
      if (client && currentTopicRef.current && client.connected) {
        client.unsubscribe(currentTopicRef.current);
      }
      currentTopicRef.current = null;
      return;
    }
    
    // Set loading state immediately for better UX
    setRoomStatus({ status: 'loading' });

    debounceTimeoutRef.current = setTimeout(() => {
      if (!client || !client.connected) {
        setRoomStatus({ status: 'not_found', message: 'Ошибка сети' });
        return;
      }

      // Unsubscribe from the previous topic
      if (currentTopicRef.current) {
        client.unsubscribe(currentTopicRef.current);
      }
      
      const newTopic = `${MQTT_TOPIC_PREFIX}/${code}`;
      currentTopicRef.current = newTopic;
      client.subscribe(newTopic);
      
      // Set a timeout for the 'not_found' case
      statusCheckTimeoutRef.current = setTimeout(() => {
        setRoomStatus({ status: 'not_found' });
      }, 2000); // 2 seconds is plenty for a response over an existing connection

    }, 300); // 300ms debounce delay

  }, [roomCode, isClientConnected]);

  const generateRoomCode = () => {
    const chars = 'АБВГДЕЖЗИКЛМНПРСТУФХЦЧШЫЭЮЯ123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoomCode(result);
  };

  const handleStart = () => {
    const finalRoomCode = roomCode.trim().toUpperCase();
    const finalPlayerName = playerName.trim();
    if (finalRoomCode.length >= 4 && finalPlayerName.length > 2) {
      localStorage.setItem('tysiacha-playerName', finalPlayerName);
      onStartGame(finalRoomCode, finalPlayerName);
    }
  };
  
  const RoomStatusInfo = () => {
    if (!roomCode || roomCode.trim().length < 4) return React.createElement('div', { className: "text-sm text-gray-400 mt-2 min-h-[20px]" }, 'Код должен быть не менее 4 символов');
    if (!isClientConnected) return React.createElement('div', { className: "text-sm text-gray-400 mt-2 min-h-[20px] flex items-center justify-center" }, React.createElement('div', {className: "w-4 h-4 border-2 border-t-transparent border-yellow-300 rounded-full animate-spin mr-2"}), 'Подключение к сети...');
    if (!roomStatus) return React.createElement('div', { className: "text-sm text-gray-400 mt-2 min-h-[20px]" }, 'Придумайте код или введите существующий');
    
    let content;
    let icon;
    
    switch(roomStatus.status) {
        case 'loading':
            icon = React.createElement('div', {className: "w-4 h-4 border-2 border-t-transparent border-yellow-300 rounded-full animate-spin mr-2"});
            content = 'Проверка комнаты...';
            break;
        case 'not_found':
            icon = React.createElement('svg', { xmlns:"http://www.w3.org/2000/svg", className:"h-5 w-5 mr-2 text-blue-400", viewBox:"0 0 20 20", fill:"currentColor" }, React.createElement('path', { fillRule:"evenodd", d:"M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z", clipRule:"evenodd" }));
            content = roomStatus.message || 'Комната не найдена. Можно создать новую.';
            break;
        case 'found':
            icon = React.createElement('svg', { xmlns:"http://www.w3.org/2000/svg", className:"h-5 w-5 mr-2 text-green-400", viewBox:"0 0 20 20", fill:"currentColor" }, React.createElement('path', { fillRule:"evenodd", d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule:"evenodd" }));
            const { hostName, playerCount } = roomStatus.data || {};
            if (hostName && typeof playerCount === 'number') {
                content = `Хост: ${hostName}, Игроков: ${playerCount}/5`;
            } else {
                content = 'Комната найдена. Можно войти.';
            }
            break;
        default:
            return React.createElement('div', { className: "text-sm text-gray-400 mt-2 min-h-[20px]" }, 'Придумайте код или введите существующий');
    }
    
    return React.createElement('div', { className: "text-sm text-gray-400 mt-2 min-h-[20px] flex items-center justify-center" }, icon, content);
  }

  const buttonText = roomStatus?.status === 'found' ? 'Войти в игру' : 'Создать и войти';
  const isButtonDisabled = roomCode.trim().length < 4 || playerName.trim().length < 3 || roomStatus?.status === 'loading' || !isClientConnected;


  return React.createElement(
    'div',
    { className: "w-full max-w-md p-8 bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700 text-center" },
    React.createElement('h2', { className: "font-ruslan text-2xl sm:text-4xl lg:text-5xl text-yellow-300 mb-6" }, 'Вход в игру'),
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
          'Код комнаты'
        ),
        React.createElement(
            'div',
            { className: 'relative flex items-center' },
            React.createElement('input', {
              id: "roomCode",
              type: "text",
              value: roomCode,
              onChange: (e) => setRoomCode(e.target.value.toUpperCase()),
              placeholder: "Введите код",
              className: "w-full p-3 pr-12 text-center bg-slate-900 border-2 border-slate-600 rounded-lg text-2xl font-mono tracking-widest text-white focus:outline-none focus:border-yellow-400 transition-colors"
            }),
            React.createElement(
                'button',
                {
                    onClick: generateRoomCode,
                    className: "absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-yellow-300 transition-colors focus:outline-none",
                    'aria-label': "Сгенерировать новый код",
                    title: "Сгенерировать новый код"
                },
                React.createElement(
                    'svg',
                    { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 },
                    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 21.75l-.648-1.188a2.25 2.25 0 01-1.44-1.442L12.97 18.75l1.188-.648a2.25 2.25 0 011.44 1.442l.648 1.188z" })
                )
            )
        ),
        React.createElement(RoomStatusInfo, null)
      ),
      React.createElement(
        'button',
        {
          onClick: handleStart,
          className: "w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed",
          disabled: isButtonDisabled
        },
        buttonText
      )
    )
  );
};

export default Lobby;