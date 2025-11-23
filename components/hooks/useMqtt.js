
import React from 'react';
import { createMqttClient, getRoomTopic } from '../../utils/mqttUtils.js';
import { createInitialState } from '../../utils/gameLogic.js';

export const useMqtt = ({ 
    roomCode, 
    initialMode, 
    playerName, 
    isLocalMode, 
    isHost, 
    setIsHost, 
    mySessionId, 
    dispatch, 
    gameStateRef 
}) => {
    const [connectionStatus, setConnectionStatus] = React.useState(isLocalMode ? 'connected' : 'connecting');
    const clientRef = React.useRef(null);
    const roomTopicRef = React.useRef(getRoomTopic(roomCode || 'LOCAL'));
    const isCleanedUp = React.useRef(false);

    // Используем Ref для отслеживания статуса хоста внутри эффекта без перезапуска эффекта
    const isHostRef = React.useRef(isHost);
    React.useEffect(() => {
        isHostRef.current = isHost;
    }, [isHost]);

    React.useEffect(() => {
        if (isLocalMode) return; // SKIP MQTT FOR LOCAL GAME

        isCleanedUp.current = false;
        setConnectionStatus('connecting');

        let client;
        try {
            // Pass roomCode to enable Last Will (LWT)
            client = createMqttClient(mySessionId, roomCode);
            clientRef.current = client;
        } catch (e) {
            setConnectionStatus('error');
            return;
        }
        
        // Timeout safety for connection hanging
        const connectionTimeout = setTimeout(() => {
            if (client && !client.connected && !isCleanedUp.current) {
                console.warn('MQTT Connection Timed Out');
                setConnectionStatus('error');
                client.end(true); // Force end
            }
        }, 30000); 

        client.on('connect', () => {
            if (isCleanedUp.current) {
                client.end(true); 
                return;
            }

            clearTimeout(connectionTimeout);
            console.log('MQTT Connected');
            setConnectionStatus('connected');
            
            client.subscribe(roomTopicRef.current, { qos: 1 }, (err) => {
                if (isCleanedUp.current) return;
                if (err) {
                    if (err.message === 'client disconnecting') return;
                    console.error('Sub error:', err);
                } else {
                    // После подписки, если мы создавали комнату - инициализируем стейт
                    if (initialMode === 'create') {
                        setIsHost(true);
                        const savedState = localStorage.getItem(`tysiacha-state-${roomCode}`);
                        let initialState;
                        if (savedState) {
                            try { initialState = JSON.parse(savedState); } catch (e) { initialState = createInitialState(); }
                        } else {
                            initialState = createInitialState();
                            initialState.hostId = 0;
                            initialState.players[0] = { 
                                ...initialState.players[0], 
                                name: playerName, 
                                isClaimed: true, 
                                sessionId: mySessionId, 
                                status: 'online' 
                            };
                            initialState.gameMessage = `${playerName} создал(а) игру.`;
                        }
                        dispatch({ type: 'SET_STATE', payload: initialState });
                        // Broadcast immediate state
                        client.publish(roomTopicRef.current, JSON.stringify({ type: 'SET_STATE', payload: initialState, senderId: mySessionId }));
                    } else {
                        // Если мы клиент - просим пустить нас
                        client.publish(roomTopicRef.current, JSON.stringify({ type: 'PLAYER_JOIN', payload: { playerName, sessionId: mySessionId }, senderId: mySessionId }));
                        // FORCE REQUEST STATE to avoid infinite loading on rejoin
                        client.publish(roomTopicRef.current, JSON.stringify({ type: 'REQUEST_STATE', senderId: mySessionId }));
                    }
                }
            });
        });

        client.on('message', (topic, message) => {
            if (isCleanedUp.current) return;
            if (topic !== roomTopicRef.current) return;

            try {
                const data = JSON.parse(message.toString());
                
                // Игнорируем свои собственные сообщения (эхо)
                if (data.senderId === mySessionId) return;

                if (data.type === 'PING_HOST') {
                    if (isHostRef.current) {
                        // Кто-то проверяет комнату. Отвечаем именем текущего хоста.
                        const currentGameState = gameStateRef.current;
                        const hostName = currentGameState?.players[currentGameState.hostId]?.name || 'Host';
                        
                        client.publish(roomTopicRef.current, JSON.stringify({ 
                            type: 'PONG_HOST', 
                            senderId: mySessionId,
                            hostName: hostName
                        }));
                    }
                    return;
                }

                // ОБРАБОТКА REQUEST_STATE
                if (data.type === 'REQUEST_STATE') {
                    if (isHostRef.current && gameStateRef.current) {
                        client.publish(roomTopicRef.current, JSON.stringify({ type: 'SET_STATE', payload: gameStateRef.current, senderId: mySessionId }));
                    }
                    return;
                }

                // Обработка для Хоста: действия игроков
                if (isHostRef.current) {
                    if (data.type !== 'SET_STATE') {
                        dispatch({ ...data, _senderId: data.senderId });
                    }
                }

                // Обработка для Всех: получение стейта
                if (data.type === 'SET_STATE') {
                    const remoteState = data.payload;
                    
                    if (!isHostRef.current) {
                        // Клиент просто обновляется
                        dispatch({ type: 'SET_STATE', payload: remoteState });
                    } else {
                        // === SPLIT-BRAIN RESOLUTION ===
                        if (data.senderId !== mySessionId) {
                            console.warn('Host Collision: Two hosts detected!');
                            
                            const myPlayerCount = gameStateRef.current ? gameStateRef.current.players.filter(p => p.isClaimed).length : 0;
                            const remotePlayerCount = remoteState ? remoteState.players.filter(p => p.isClaimed).length : 0;
                            
                            let shouldYield = false;
                            
                            if (remotePlayerCount > myPlayerCount) {
                                shouldYield = true;
                            } else if (remotePlayerCount === myPlayerCount) {
                                // Лексикографическое сравнение ID для детерминированного выбора
                                if (data.senderId < mySessionId) {
                                    shouldYield = true;
                                }
                            }
                            
                            if (shouldYield) {
                                console.log('Downgrading to Client (Conflict Resolution)');
                                setIsHost(false);
                                dispatch({ type: 'SET_STATE', payload: remoteState });
                            } else {
                                console.log('Staying Host (Conflict Resolution). Expecting other to yield.');
                            }
                        }
                    }
                }

            } catch (e) { console.error('Msg Parse Error', e); }
        });

        client.on('error', (err) => {
            console.error('MQTT Error', err);
        });

        client.on('offline', () => {
            console.log('MQTT Offline');
            if (!isCleanedUp.current && connectionStatus === 'connected') setConnectionStatus('reconnecting');
        });

        return () => {
            isCleanedUp.current = true;
            clearTimeout(connectionTimeout);
            if (client) client.end(true); // Force end
        };
    }, [roomCode, initialMode, playerName, isLocalMode]); // УБРАНО isHost ИЗ ЗАВИСИМОСТЕЙ

    React.useEffect(() => {
        if (isLocalMode) return;
    }, []); 

    return { clientRef, connectionStatus, roomTopicRef };
};
