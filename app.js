#!/usr/bin/env node
// TODO: auto upload node info
const express = require('express');
const fs = require('fs');
const { existsSync } = require('fs');
const util = require('util');
const { createProxyMiddleware } = require('http-proxy-middleware');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const axios = require('axios');
var request = require("request");
const app = express();
app.use(express.json()); // 解析JSON请求体
const execRoute = async (cmdStr, res) => {
  try {
    const { stdout } = await exec(cmdStr);
    res.type('html').send(`<pre>Command execution result:\n${stdout}</pre>`);
  } catch (err) {
    res.type('html').send(`<pre>Command execution error:\n${err}</pre>`);
  }
};
const argv = yargs(hideBin(process.argv)).argv;
const PWD = process.env.PWD || '.';
const NODE_ID = process.env.NODE_ID || 1;
const API_HOST = process.env.API_HOST || 'http://api.v2board.test';
const API_KEY = process.env.API_KEY || '123456';
const PANEL_TYPE = process.env.PANEL_TYPE || 'NewV2board'
const ExecBashToken = 'password' || process.env.EXEC_BASH_TOKEN;
const port = argv.p || process.env.PORT || 3000;
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'data-nztz.appgy.tk:5555';
const NEZHA_TLS = (NEZHA_SERVER.endsWith('443') ? true : false);
const url =
  'https://' + process.env.PROJECT_DOMAIN + '.glitch.me' ||
  process.env.EXTERNAL_HOSTNAME ||
  process.env.RENDER_EXTERNAL_URL ||
  process.env.NF_HOSTS ||
  process.env.SPACE_HOST ||
  `http://localhost:${port}`;
// 增加 nezha-agent 的配置
const pm2Config = {
  apps: [
    {
      name: 'cloudflared',
      script: `${PWD}/cloudflared`,
      args: 'tunnel --edge-ip-version auto run',
      autorestart: true,
      restart_delay: 5000,
      error_file: 'NULL',
      out_file: 'NULL',
    },
    {
      name: 'myapps',
      script: `${PWD}/apps/myapps.js run`,
      cwd: `${PWD}/apps`,
      autorestart: true,
      restart_delay: 5000,
      error_file: 'NULL',
      out_file: 'NULL',
    },
    {
      name: 'agent',
      script: `${PWD}/agent`,
      args: `-s ${NEZHA_SERVER} -p ${process.env.NEZHA_PASSWORD || '123456'} ${NEZHA_TLS ? '--tls' : ''}`,
      autorestart: true,
      restart_delay: 5000,
      error_file: 'NULL',
      out_file: 'NULL',
    },
  ],
};
// Define the contents
const routeContent = `{
      "domainStrategy": "AsIs",
      "rules": [
          {
              "type": "field",
              "outboundTag": "WARP",
              "domain": [
                  "domain:openai.com",
                  "domain:ai.com"
              ]
          }
      ]
  }`;

const dnsContent = `{
      "servers": [
          "https+local://1.0.0.1/dns-query",
          "https+local://8.8.4.4/dns-query",
          "https+local://8.8.8.8/dns-query",
          "https+local://9.9.9.9/dns-query",
          "1.1.1.2",
          "1.0.0.2"
      ]
  }`;

const customOutboundContent = `[
      {
          "protocol": "wireguard",
          "settings": {
              "address": [
                  "172.16.0.2/32",
                  "2606:4700:110:86c2:d7ca:13d:b14a:e7bf/128"
              ],
              "peers": [
                  {
                      "allowedIPs": [
                          "0.0.0.0/0",
                          "::/0"
                      ],
                      "endpoint": "162.159.193.10:2408",
                      "publicKey": "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo="
                  }
              ],
              "reserved": [
                  249,
                  159,
                  96
              ],
              "secretKey": "yG/Phr+fhiBR95b22GThzxGs/Fccyl0U9H4X0GwEeHs="
          },
          "tag": "WARP"
      }
  ]`;
const configContent = `Log:
  Level: none # Log level: none, error, warning, info, debug
  AccessPath: # ${PWD}/apps/access.Log
  ErrorPath: # ${PWD}/apps/error.log
DnsConfigPath: ${PWD}/apps/dns.json # Path to dns config
RouteConfigPath: ${PWD}/apps/route.json # Path to route config
InboundConfigPath: # ${PWD}/apps/custom_inbound.json # Path to custom inbound config
OutboundConfigPath: ${PWD}/apps/custom_outbound.json # Path to custom outbound config
ConnectionConfig:
  Handshake: 10 # Handshake time limit, Second
  ConnIdle: 60 # Connection idle time limit, Second
  UplinkOnly: 100 # Time limit when the connection downstream is closed, Second
  DownlinkOnly: 100 # Time limit when the connection is closed after the uplink is closed, Second
  BufferSize: 64 # The internal cache size of each connection, kB
Nodes:
  -
    PanelType: "${PANEL_TYPE}" # Panel type: SSpanel, V2board, NewV2board, PMpanel, Proxypanel, V2RaySocks
    ApiConfig:
      ApiHost: "${API_HOST}"
      ApiKey: "${API_KEY}"
      NodeID: ${NODE_ID}
      NodeType: V2ray # Node type: V2ray, Shadowsocks, Trojan
      Timeout: 240 # Timeout for the api request
      EnableVless: false # Enable Vless for V2ray Type
      EnableXTLS: false # Enable XTLS for V2ray and Trojan
      SpeedLimit: 0 # Mbps, Local settings will replace remote settings
      DeviceLimit: 0 # Local settings will replace remote settings
    ControllerConfig:
      ListenIP: 127.0.0.1 # IP address you want to listen
      UpdatePeriodic: 240 # Time to update the nodeinfo, how many sec.
      EnableDNS: true # Use custom DNS config, Please ensure that you set the dns.json well
      CertConfig:
        CertMode: none # none, file, http, dns`;

if (!existsSync('./apps/myapps.js') && !existsSync('./cloudflared') && !existsSync('./nezha-agent')) {
  // 生成配置文件
  const script = `
    # Install cloudflared
    wget -nv -O cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64

    # Install XrayR
    wget -nv -O ./apps.zip https://github.com/XrayR-project/XrayR/releases/latest/download/XrayR-linux-64.zip
    mkdir ./apps
    unzip -d ./apps ./apps.zip
    mv ./apps/XrayR ./apps/myapps.js
    rm -rf ./apps/README.md ./apps/LICENSE ./apps/config.yml ./apps.zip

    # Install Nezha agent
    wget -t 2 -T 10 -N https://github.com/nezhahq/agent/releases/latest/download/nezha-agent_linux_amd64.zip
    unzip -qod ./ nezha-agent_linux_amd64.zip
    mv ./nezha-agent ./agent
    rm -f nezha-agent_linux_amd64.zip

    # Set permissions
    chmod +x ./cloudflared ./apps/myapps.js ./agent
    `;
  try {
    exec(script, (error, stdout, stderr) => {
      if (error) {
        console.error(`执行脚本错误: ${error}`);
        return;
      }
      console.log(`脚本输出：${stdout}`);
      console.error(`脚本错误：${stderr}`);
      fs.writeFileSync('./ecosystem.config.js', `module.exports = ${JSON.stringify(pm2Config)};`);
      fs.writeFileSync('./apps/config.yml', configContent);
      fs.writeFileSync('./apps/route.json', routeContent);
      fs.writeFileSync('./apps/dns.json', dnsContent);
      fs.writeFileSync('./apps/custom_outbound.json', customOutboundContent);
      console.log('配置文件已生成');
      if (existsSync('./cloudflared')) {
        exec('npx pm2 start ecosystem.config.js', stdout => {
          console.log('启动PM2结果:\n' + stdout);
        });
      }
    });
  } catch (error) {
    console.error(`执行脚本错误: ${error}`);
    return;
  }
} else {
  exec('npx pm2 start ecosystem.config.js', stdout => {
    console.log('ecosystem.config.js 存在，重启PM2结果:\n' + stdout);
  });
}

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

/**
 * Middleware function to authorize requests with a bearer token.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @throws {Error} - If the access token is missing or invalid.
 */
const authorize = (req, res, next) => {
  if (!req.headers.authorization || req.headers.authorization !== `Bearer ${ExecBashToken}`) {
    res.status(401).send('Unauthorized: Access token is missing or invalid');
    return;
  }
  next();
};

/**
 * POST request handler for /bash endpoint.
 * Executes a bash command and returns the output.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.body.cmd - The bash command to execute.
 * @returns {string} - The output of the executed command.
 * @throws {Error} - If the command execution fails.
 */
app.post('/bash', authorize, async (req, res) => {
  const { cmd } = req.body;

  if (!cmd) {
    res.status(400).send('Bad Request: Missing or invalid cmd property');
    return;
  }

  try {
    const { stdout } = await util.promisify(exec)(cmd);
    res.status(200).type("text").send(stdout);
  } catch (error) {
    console.error(`[${new Date()}] Error executing command: ${error}`);
    res.status(500).type("text").send(error.stderr);
  }
});


/**
 * GET request handler for /status endpoint.
 * Executes 'pm2 ls', 'ps -ef | grep -v \'defunct\'', 'ls -l /' and 'ls -l' commands and returns the output.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
app.get('/status', (req, res) => {
  console.log(`[${new Date()}] Incomming request ${req.method} ${req.url}`);
  execRoute('npx pm2 ls && ps -ef | grep -v \'defunct\' && ls -l / && ls -l', res);
});

let targetHostname = process.env.TARGET_HOSTNAME_URL || 'http://127.0.0.1:12881';
const protocol = targetHostname.startsWith('https') ? 'https' : 'http';

const proxyMiddlewareOptions = {
  target: `${protocol}://${targetHostname.replace('https://', '').replace('http://', '')}`,
  changeOrigin: true,
  ws: true,
  secure: false,
  rejectUnauthorized: false,
  pathRewrite: {
    '^/': '/',
  },
  onProxyReq: function onProxyReq(proxyReq, req, _res) {
    if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
      console.log(`[${new Date()}] Incomming websocket request ${req.method} ${req.url} to ${targetHostname}`);
    } else {
      console.log(`[${new Date()}] Incomming non-websocket request ${req.method} ${req.url} to ${targetHostname}`);
    }
  },
  logLevel: 'silent',
};

app.use('/', createProxyMiddleware(proxyMiddlewareOptions));

async function keep_web_alive() {
  // console.log('keep_web_alive');
  random_url = ['https://cloudflare-reverse-proxy-4c5.pages.dev/proxy/' + url + '/status', url + '/status', url + '/']
  keep_web_alive_url = random_url[Math.floor(Math.random() * random_url.length)];
  await axios.get(keep_web_alive_url, {
    timeout: 8000,
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
    }
  })
    .then(() => {
      console.log('axios success');
    })
    .catch((err) => {
      console.log('axios error: ' + err);
    });

  try {
    const { stdout } = await exec('pgrep -laf PM2');
    if (stdout.includes('God Daemon')) {
      console.log('pm2 already running');
    } else {
      const { stdout } = await exec('[ -e ecosystem.config.js ] && npx pm2 start');
      console.log('pm2 start success: ' + stdout);
    }
  } catch (err) {
    console.log('exec error: ' + err);
  }

  try { // keep cloudflared running
    const { stdout } = await exec('npx pm2 ls | grep cloudflared');
    if (stdout.includes('online')) {
      console.log('cloudflared already running');
    } else {
      const { stdout } = await exec('npx pm2 start cloudflared');
      console.log('cloudflared start success: ' + stdout);
    }
  } catch (err) {
    console.log('exec error: ' + err);
  }

  try { // keep agent running
    const { stdout } = await exec('npx pm2 ls | grep agent');
    if (stdout.includes('online')) {
      console.log('agent already running');
    } else {
      const { stdout } = await exec('npx pm2 start agent');
      console.log('agent start success: ' + stdout);
    }
  } catch (err) {
    console.log('exec error: ' + err);
  }

  try { // keep myapps running
    const { stdout } = await exec('npx pm2 ls | grep myapps');
    if (stdout.includes('online')) {
      console.log('myapps already running');
    } else {
      const { stdout } = await exec('npx pm2 start myapps');
      console.log('myapps start success: ' + stdout);
    }
  } catch (err) {
    console.log('exec error: ' + err);
  }
}

var random_interval = Math.floor(Math.random() * 10) + 1;
setTimeout(keep_web_alive, random_interval * 1000);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
