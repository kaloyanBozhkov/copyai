#!/usr/bin/env node

/**
 * LG TV Screen On/Off Test Script
 * 
 * Usage: node scripts/tv-screen.js off
 *        node scripts/tv-screen.js on
 *        node scripts/tv-screen.js off --force  (re-pair with new permissions)
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TV_IP = process.env.LG_TV_IP || '192.168.1.70';
const TV_PORT = '3001';
const TV_URL = `wss://${TV_IP}:${TV_PORT}`;
const KEY_FILE_PATH = path.join(os.homedir(), '.copyai', 'lg-tv-key');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const action = process.argv[2]; // 'on' or 'off'
const forcePair = process.argv.includes('--force');

if (!action || (action !== 'on' && action !== 'off')) {
  console.log('Usage: node scripts/tv-screen.js [on|off] [--force]');
  process.exit(1);
}

let existingKey = null;
if (fs.existsSync(KEY_FILE_PATH) && !forcePair) {
  existingKey = fs.readFileSync(KEY_FILE_PATH, 'utf8').trim();
}

if (!existingKey && !forcePair) {
  console.log('No TV key found. Run with --force to pair.');
  process.exit(1);
}

if (forcePair) {
  console.log('🔄 Force pairing mode - watch TV for prompt!');
}

const handshake = {
  type: 'register',
  id: 'register_0',
  payload: {
    forcePairing: forcePair,
    pairingType: 'PROMPT',
    'client-key': existingKey || undefined,
    manifest: {
      manifestVersion: 1,
      appVersion: '1.1',
      signed: {
        created: '20140509',
        appId: 'com.lge.test',
        vendorId: 'com.lge',
        localizedAppNames: {
          '': 'LG Remote App',
          'ko-KR': 'LG Remote App',
          'zxx-XX': 'LG Remote App'
        },
        localizedVendorNames: {
          '': 'LG Electronics'
        },
        permissions: [
          'TEST_SECURE', 'CONTROL_INPUT_TEXT', 'CONTROL_MOUSE_AND_KEYBOARD',
          'READ_INSTALLED_APPS', 'READ_LGE_SDX', 'READ_NOTIFICATIONS', 'SEARCH',
          'WRITE_SETTINGS', 'WRITE_NOTIFICATION_ALERT', 'CONTROL_POWER',
          'READ_CURRENT_CHANNEL', 'READ_RUNNING_APPS', 'READ_UPDATE_INFO',
          'UPDATE_FROM_REMOTE_APP', 'READ_LGE_TV_INPUT_EVENTS', 'READ_TV_CURRENT_TIME'
        ],
        serial: 'SerialNumber'
      },
      permissions: [
        'LAUNCH', 'LAUNCH_WEBAPP', 'APP_TO_APP', 'CLOSE', 'TEST_OPEN', 'TEST_PROTECTED',
        'CONTROL_AUDIO', 'CONTROL_DISPLAY', 'CONTROL_INPUT_JOYSTICK',
        'CONTROL_INPUT_MEDIA_RECORDING', 'CONTROL_INPUT_MEDIA_PLAYBACK',
        'CONTROL_INPUT_TV', 'CONTROL_POWER', 'READ_APP_STATUS', 'READ_CURRENT_CHANNEL',
        'READ_INPUT_DEVICE_LIST', 'READ_NETWORK_STATE', 'READ_RUNNING_APPS',
        'READ_TV_CHANNEL_LIST', 'WRITE_NOTIFICATION_TOAST', 'READ_POWER_STATE',
        'READ_COUNTRY_INFO', 'CONTROL_TV_SCREEN'
      ],
      signatures: [{
        signatureVersion: 1,
        signature: 'eyJhbGdvcml0aG0iOiJSU0EtU0hBMjU2Iiwia2V5SWQiOiJ0ZXN0LXNpZ25pbmctY2VydCIsInNpZ25hdHVyZVZlcnNpb24iOjF9.hrVRgjCwXVvE2OOSpDZ58hR+59aFNwYDyjQgKk3auukd7pcegmE2CzPCa0bJ0ZsRAcKkCTJrWo5iDzNhMBWRyaMOv5zWSrthlf7G128qvIlpMT0YNY+n/FaOHE73uLrS/g7swl3/qH/BGFG2Hu4RlL48eb3lLKqTt2xKHdCs6Cd4RMfJPYnzgvI4BNrFUKsjkcu+WD4OO2A27Pq1n50cMchmcaXadJhGrOqH5YmHdOCj5NSHzJYrsW0HPlpuAx/ECMeIZYDh6RMqaFM2DXzdKX9NmmyqzJ3o/0lkk/N97gfVRLW5hA29yeAwaCViZNCP8iC9aO0q9fQojoa7NQnAtw=='
      }]
    }
  }
};

// Endpoints to try
const endpoints = action === 'off' 
  ? [
      'ssap://system/setScreenOff',
      'ssap://com.webos.service.tvpower/power/turnOffScreen',
    ]
  : [
      'ssap://system/setScreenOn',
      'ssap://com.webos.service.tvpower/power/turnOnScreen',
    ];

console.log(`\n🔌 Connecting to TV at ${TV_URL}...`);

const ws = new WebSocket(TV_URL, { rejectUnauthorized: false });

ws.on('open', () => {
  console.log('✓ Connected, authenticating...');
  ws.send(JSON.stringify(handshake));
});

let cmdIndex = 0;

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'registered') {
    const clientKey = msg.payload['client-key'];
    if (clientKey) {
      // Ensure directory exists
      const configDir = path.dirname(KEY_FILE_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(KEY_FILE_PATH, clientKey);
      console.log('✓ New key saved!');
    }
    console.log('✓ Authenticated\n');
    
    // Send first command
    const uri = endpoints[cmdIndex];
    console.log(`📺 Trying: ${uri}`);
    ws.send(JSON.stringify({
      type: 'request',
      id: `cmd_${cmdIndex}`,
      uri: uri,
      payload: {}
    }));
    
  } else if (msg.type === 'response') {
    console.log(`   Response: ${JSON.stringify(msg.payload)}`);
    
    cmdIndex++;
    if (cmdIndex < endpoints.length) {
      // Try next endpoint
      const uri = endpoints[cmdIndex];
      console.log(`\n📺 Trying: ${uri}`);
      ws.send(JSON.stringify({
        type: 'request',
        id: `cmd_${cmdIndex}`,
        uri: uri,
        payload: {}
      }));
    } else {
      console.log('\n✅ Done testing all endpoints');
      ws.close();
      process.exit(0);
    }
    
  } else if (msg.type === 'error') {
    console.log(`   ❌ Error: ${msg.error}`);
    
    cmdIndex++;
    if (cmdIndex < endpoints.length) {
      const uri = endpoints[cmdIndex];
      console.log(`\n📺 Trying: ${uri}`);
      ws.send(JSON.stringify({
        type: 'request',
        id: `cmd_${cmdIndex}`,
        uri: uri,
        payload: {}
      }));
    } else {
      console.log('\n✅ Done testing all endpoints');
      ws.close();
      process.exit(0);
    }
  }
});

ws.on('error', (err) => {
  console.log('❌ Connection error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('❌ Timeout');
  ws.close();
  process.exit(1);
}, 15000);
