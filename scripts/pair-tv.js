#!/usr/bin/env node

/**
 * LG TV Pairing Script
 * Run this from your regular macOS Terminal (not Cursor) to pair with your LG TV.
 * 
 * Usage: node scripts/pair-tv.js
 *        node scripts/pair-tv.js --port 3000
 *        node scripts/pair-tv.js --insecure   (for ws:// instead of wss://)
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

// Parse args
const args = process.argv.slice(2);
const useInsecure = args.includes('--insecure') || args.includes('-i');
const portArgIdx = args.findIndex(a => a === '--port' || a === '-p');
const portArg = portArgIdx >= 0 ? args[portArgIdx + 1] : null;

const TV_IP = process.env.LG_TV_IP || '192.168.1.70';
const TV_PORT = portArg || process.env.LG_TV_PORT || '3001';
const protocol = useInsecure ? 'ws' : 'wss';
const TV_URL = `${protocol}://${TV_IP}:${TV_PORT}`;
const KEY_FILE_PATH = path.join(os.homedir(), '.copyai', 'lg-tv-key');

// Disable SSL verification for self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Ensure config directory exists
const configDir = path.dirname(KEY_FILE_PATH);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Check for existing key
let existingKey = null;
if (fs.existsSync(KEY_FILE_PATH)) {
  try {
    existingKey = fs.readFileSync(KEY_FILE_PATH, 'utf8').trim();
    if (existingKey) {
      console.log(`Found existing key: ${existingKey.substring(0, 10)}...`);
    }
  } catch (e) {
    console.log('No valid existing key found');
  }
}

// LG TV handshake payload
const handshake = {
  type: 'register',
  id: 'register_0',
  payload: {
    forcePairing: false,
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
        'READ_COUNTRY_INFO'
      ],
      signatures: [{
        signatureVersion: 1,
        signature: 'eyJhbGdvcml0aG0iOiJSU0EtU0hBMjU2Iiwia2V5SWQiOiJ0ZXN0LXNpZ25pbmctY2VydCIsInNpZ25hdHVyZVZlcnNpb24iOjF9.hrVRgjCwXVvE2OOSpDZ58hR+59aFNwYDyjQgKk3auukd7pcegmE2CzPCa0bJ0ZsRAcKkCTJrWo5iDzNhMBWRyaMOv5zWSrthlf7G128qvIlpMT0YNY+n/FaOHE73uLrS/g7swl3/qH/BGFG2Hu4RlL48eb3lLKqTt2xKHdCs6Cd4RMfJPYnzgvI4BNrFUKsjkcu+WD4OO2A27Pq1n50cMchmcaXadJhGrOqH5YmHdOCj5NSHzJYrsW0HPlpuAx/ECMeIZYDh6RMqaFM2DXzdKX9NmmyqzJ3o/0lkk/N97gfVRLW5hA29yeAwaCViZNCP8iC9aO0q9fQojoa7NQnAtw=='
      }]
    }
  }
};

function suggestAlternatives() {
  console.log('\n📋 Try these alternatives:');
  console.log(`   node scripts/pair-tv.js --port 3000`);
  console.log(`   node scripts/pair-tv.js --insecure`);
  console.log(`   node scripts/pair-tv.js --port 3000 --insecure`);
  process.exit(1);
}

function startWebSocket() {
  console.log(`\n🔌 Connecting WebSocket to ${TV_URL}...`);

  const ws = new WebSocket(TV_URL, {
    rejectUnauthorized: false,
    handshakeTimeout: 10000
  });

  const timeoutId = setTimeout(() => {
    console.log('\n❌ WebSocket timeout after 30 seconds');
    ws.close();
    process.exit(1);
  }, 30000);

  ws.on('open', () => {
    console.log('✓ WebSocket connected, sending handshake...');
    console.log('👀 Watch your TV screen for a pairing prompt!\n');
    ws.send(JSON.stringify(handshake));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'registered') {
        clearTimeout(timeoutId);
        const clientKey = msg.payload['client-key'];
        
        if (clientKey) {
          fs.writeFileSync(KEY_FILE_PATH, clientKey);
          console.log('\n✅ PAIRING SUCCESSFUL!');
          console.log(`   Key saved to: ${KEY_FILE_PATH}`);
          console.log(`   Key: ${clientKey.substring(0, 20)}...`);
        } else {
          console.log('\n✅ Connected (using existing key)');
        }
        
        // Test with a simple request
        ws.send(JSON.stringify({
          type: 'request',
          id: 'test_1',
          uri: 'ssap://com.webos.service.tvpower/power/getPowerState',
          payload: {}
        }));
        
      } else if (msg.type === 'response' && msg.id === 'test_1') {
        console.log('\n📺 TV Status:', JSON.stringify(msg.payload));
        console.log('\n🎉 All done! Your TV is paired and ready.');
        ws.close();
        process.exit(0);
        
      } else if (msg.type === 'error') {
        console.log('\n❌ Error from TV:', msg.error);
        ws.close();
        process.exit(1);
        
      } else {
        console.log('📨 Received:', msg.type);
      }
    } catch (e) {
      console.log('Raw message:', data.toString().substring(0, 200));
    }
  });

  ws.on('error', (err) => {
    clearTimeout(timeoutId);
    console.log('\n❌ WebSocket error:', err.message);
    
    if (err.message.includes('socket hang up')) {
      console.log('\n🔍 "socket hang up" usually means:');
      console.log('   - Wrong protocol (try --insecure for ws://)');
      console.log('   - Wrong port (try --port 3000)');
      console.log('   - TV rejected the connection');
      suggestAlternatives();
    }
    
    process.exit(1);
  });

  ws.on('close', () => {
    clearTimeout(timeoutId);
  });
}

// First, test raw TCP connection
console.log(`\n🔍 Testing TCP connection to ${TV_IP}:${TV_PORT}...`);

const testSocket = new net.Socket();
testSocket.setTimeout(5000);

testSocket.on('connect', () => {
  console.log(`✓ TCP port ${TV_PORT} is reachable`);
  testSocket.destroy();
  startWebSocket();
});

testSocket.on('timeout', () => {
  console.log(`❌ TCP timeout on port ${TV_PORT}`);
  testSocket.destroy();
  suggestAlternatives();
});

testSocket.on('error', (err) => {
  console.log(`❌ TCP error: ${err.message}`);
  testSocket.destroy();
  suggestAlternatives();
});

testSocket.connect(parseInt(TV_PORT), TV_IP);
