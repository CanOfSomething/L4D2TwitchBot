const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const oAuth = "***";
const user = "canofsomething";
const channel = "canofsomething";

const commandsFile = path.join(__dirname, 'commands.txt');
const outputFile = 'E:/SteamLibrary/steamapps/common/Left 4 Dead 2/left4dead2/addons/sourcemod/configs/beans.cfg';
let commands = {};

// Load commands from the commands.txt file with format:
// !command (Response to print)
function loadCommands() {
  commands = {};
  if (!fs.existsSync(commandsFile)) {
    console.warn('Commands file not found!');
    return;
  }

  const lines = fs.readFileSync(commandsFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match pattern: !command (Response)
    const match = trimmed.match(/^(!\S+)\s+\((.+)\)$/);
    if (match) {
      const cmd = match[1];
      const response = match[2];
      commands[cmd] = response;
    }
  }
}

const socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

socket.on('open', () => {
  socket.send(`PASS oauth:${oAuth}`);
  socket.send(`NICK ${user}`);
  socket.send(`JOIN #${channel}`);

  loadCommands();
  console.log('Commands loaded:', Object.keys(commands));
});

socket.on('message', (data) => {
  const message = data.toString();
  console.log(message);

  if (message.startsWith('PING')) {
    socket.send('PONG :tmi.twitch.tv');
    return;
  }

  const match = message.match(/:(\w+)!\w+@\w+\.tmi\.twitch\.tv PRIVMSG #\w+ :(.+)/);
  if (match) {
    const username = match[1];
    const chatMessage = match[2].trim();

    // Split command and parameter
    const [cmd, ...args] = chatMessage.split(' ');
    const param = args.join(' ');

    // Check if the command exists in commands
    if (commands.hasOwnProperty(cmd)) {
      let response = commands[cmd];

      // Special handling for !fu with 1/10 chance
      if (cmd === '!fu') {
        if (Math.random() >= 0.1) {
          console.log('!fu command ignored (did not meet 1/10 chance)');
          return;
        }
      }

      // Replace {param} in the response if present
      if (response.includes('{param}')) {
        if (!param) {
          console.log(`No parameter provided for ${cmd}`);
          return;
        }
        response = response.replace(/{param}/g, param);
      }

      const lineToWrite = `${response}\n`;
      console.log(`Command "${cmd}" triggered by ${username}. Writing to outputFile: ${lineToWrite.trim()}`);
      fs.appendFile(outputFile, lineToWrite, (err) => {
        if (err) {
          console.error('Error writing to beans.cfg:', err);
        } else {
          console.log(`Successfully wrote to beans.cfg: ${lineToWrite.trim()}`);
        }
      });
    }
  }
});
