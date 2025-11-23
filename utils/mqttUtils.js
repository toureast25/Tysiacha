
import { mqttConfig } from './config.js';

const APP_PREFIX = 'tysiacha-v3-app';

// Генерирует топик для конкретной комнаты
export const getRoomTopic = (roomCode) => {
    return `${APP_PREFIX}/room/${roomCode.toUpperCase()}`;
};

// Создает MQTT клиент
// roomCode нужен для установки LWT (Last Will and Testament)
export const createMqttClient = (clientId, roomCode) => {
    if (!window.mqtt) {
        throw new Error("MQTT library not loaded");
    }

    const brokerUrl = `${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}${mqttConfig.path}`;
    console.log('[MQTT] Connecting to private broker:', brokerUrl);
    
    // Опции подключения, включая авторизацию для HiveMQ Cloud
    const options = {
        clientId: clientId || `guest_${Math.random().toString(16).substr(2, 8)}`,
        keepalive: 60,
        clean: true,
        reconnectPeriod: 2000, 
        connectTimeout: 10000,
        resubscribe: true,
        // Учетные данные из конфига
        username: mqttConfig.username,
        password: mqttConfig.password,
        // HiveMQ Cloud требует SSL
        ssl: true, 
    };

    // --- LAST WILL AND TESTAMENT (Последняя воля) ---
    // Если соединение разорвется аварийно, брокер отправит это сообщение за нас.
    if (roomCode && roomCode !== 'LOCAL') {
        const topic = getRoomTopic(roomCode);
        const payload = JSON.stringify({ 
            type: 'PLAYER_DISCONNECT', 
            payload: { sessionId: clientId },
            senderId: clientId 
        });
        options.will = {
            topic: topic,
            payload: payload,
            qos: 1,
            retain: false
        };
    }

    const client = window.mqtt.connect(brokerUrl, options);

    return client;
};

// Функция для проверки существования комнаты (отправляет PING, ждет PONG)
export const checkRoomAvailability = (roomCode) => {
    return new Promise((resolve, reject) => {
        const tempId = `checker_${Math.random().toString(16).substr(2, 8)}`;
        let client;
        try {
             // Для чекера не устанавливаем LWT
             client = createMqttClient(tempId, null);
        } catch (e) {
             console.error("Failed to create MQTT client for check:", e);
             resolve({ exists: false, error: true });
             return;
        }

        const topic = getRoomTopic(roomCode);
        let found = false;
        let timeout;

        client.on('connect', () => {
            console.log('[Check] Connected, subscribing...');
            client.subscribe(topic, { qos: 1 }, (err) => { 
                if (!err) {
                    // Отправляем запрос "Ты жив?"
                    client.publish(topic, JSON.stringify({ type: 'PING_HOST', senderId: tempId }));
                }
            });
        });

        client.on('message', (topic, message) => {
            try {
                const data = JSON.parse(message.toString());
                // Если хост ответил, значит комната занята
                if (data.type === 'PONG_HOST') {
                    found = true;
                    clearTimeout(timeout);
                    client.end(true);
                    resolve({ 
                        exists: true, 
                        hostName: data.hostName || 'Неизвестный' 
                    });
                }
            } catch (e) {}
        });

        client.on('error', (err) => {
            console.warn("Check room temporary error:", err);
        });

        // Ждем ответа. 
        timeout = setTimeout(() => {
            if (!found) {
                if (client) client.end(true);
                resolve({ exists: false });
            }
        }, 3000); // Уменьшили таймаут до 3с для лучшего UX
    });
};
