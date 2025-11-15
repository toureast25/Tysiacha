import React from 'react';
import { MQTT_BROKER_URL, MQTT_TOPIC_PREFIX } from '../../constants.js';

const useMqtt = (roomCode, playerName, mySessionId) => {
  const [connectionStatus, setConnectionStatus] = React.useState('connecting');
  const [lastReceivedState, setLastReceivedState] = React.useState(null);
  const mqttClientRef = React.useRef(null);
  const isStateReceivedRef = React.useRef(false);
  
  const lastReceivedStateRef = React.useRef(lastReceivedState);
  React.useEffect(() => {
    lastReceivedStateRef.current = lastReceivedState;
  }, [lastReceivedState]);

  const topic = `${MQTT_TOPIC_PREFIX}/${roomCode}`;
  const presenceTopic = `${topic}/presence`;
  const actionsTopic = `${topic}/actions`; // Новый топик для дельта-обновлений

  const publishState = React.useCallback((newState, isDelta = false) => {
    if (mqttClientRef.current && mqttClientRef.current.connected) {
      const targetTopic = isDelta ? actionsTopic : topic;
      const retain = !isDelta; // Сохраняем только полные состояния

      // Для полных состояний инкрементируем версию
      if (!isDelta) {
          const currentVersion = lastReceivedStateRef.current?.version || 0;
          newState.version = currentVersion + 1;
      }
      
      const { senderId, ...stateWithoutSender } = newState;
      const finalPayload = {
        ...stateWithoutSender,
        senderId: mySessionId,
      };

      // Оптимистичное обновление для любого типа публикации
      if (isDelta) {
        setLastReceivedState(s => s ? { ...s, ...finalPayload } : null);
      } else {
        setLastReceivedState(finalPayload);
      }
      
      mqttClientRef.current.publish(targetTopic, JSON.stringify(finalPayload), { retain });
    }
  }, [topic, actionsTopic, mySessionId]);


  React.useEffect(() => {
    const connectOptions = {
      clientId: `tysiacha-pwa-${mySessionId}`,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 5000,
      keepalive: 30,
    };
    const client = mqtt.connect(MQTT_BROKER_URL, connectOptions);
    mqttClientRef.current = client;
    isStateReceivedRef.current = false;

    client.on('connect', () => {
      setConnectionStatus('connected');
      client.subscribe(topic);
      client.subscribe(presenceTopic);
      client.subscribe(actionsTopic); // Подписываемся на новый топик

      setTimeout(() => {
        if (!isStateReceivedRef.current) {
          setLastReceivedState({ isInitial: true });
        }
      }, 1500);
    });

    client.on('message', (receivedTopic, message) => {
      const messageString = message.toString();
      try {
        const payload = JSON.parse(messageString);
        
        // Игнорируем сообщения, отправленные нами же (кроме полных обновлений для консистентности)
        if (payload.senderId === mySessionId && receivedTopic === actionsTopic) {
            return;
        }

        if (receivedTopic === topic) {
          isStateReceivedRef.current = true;
          setLastReceivedState(currentState => {
            if (currentState && payload.version <= currentState.version) {
              return currentState;
            }
            return payload;
          });
        } else if (receivedTopic === actionsTopic) {
          // Применяем дельта-обновление, не трогая версию
          setLastReceivedState(s => s ? { ...s, ...payload } : null);
        
        } else if (receivedTopic === presenceTopic) {
          setLastReceivedState(currentState => {
            if (!currentState) return null;
            const { playerId } = payload;
            const now = Date.now();
            
            const player = currentState.players.find(p => p.id === playerId);
            if (player) {
              player.lastSeen = now;
            }
            
            if (player && player.isClaimed && player.status !== 'online') {
              const newPlayers = currentState.players.map(p => 
                p.id === playerId ? { ...p, status: 'online', lastSeen: now } : p
              );
              const newState = { ...currentState, players: newPlayers };
              publishState(newState, true); // Отправляем как дельту
              return newState;
            }
            return { ...currentState };
          });
        }
      } catch (e) {
        console.error(`Error parsing message on topic ${receivedTopic}:`, e);
      }
    });

    client.on('error', (err) => {
        console.error('MQTT Connection Error:', err);
        setConnectionStatus('error');
    });
    client.on('offline', () => setConnectionStatus('reconnecting'));
    client.on('reconnect', () => setConnectionStatus('reconnecting'));

    const heartbeatInterval = setInterval(() => {
      if (client.connected && lastReceivedStateRef.current) {
        const me = lastReceivedStateRef.current.players?.find(p => p.sessionId === mySessionId);
        if (me && me.isClaimed && !me.isSpectator) {
          client.publish(presenceTopic, JSON.stringify({ playerId: me.id }));
        }
      }
    }, 5000);

    return () => {
      clearInterval(heartbeatInterval);
      if (client) {
        client.end(true);
      }
    };
  }, [roomCode, mySessionId, topic, presenceTopic, actionsTopic, publishState]);

  return { connectionStatus, lastReceivedState, publishState };
};

export default useMqtt;