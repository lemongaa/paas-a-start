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
const ExecBashToken = 'password' || process.env.EXEC_BASH_TOKEN;
const port = argv.p || process.env.PORT || 3000;
const port1 = (port + Math.floor(Math.random() * 100) + 1) % 100 + 3000;
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'data.king360.eu.org:443';
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
      args: `tunnel --url http://localhost:${port1} --no-autoupdate --edge-ip-version 4 --protocol http2`,
      autorestart: true,
      restart_delay: 5000,
      error_file: 'argo-err.log',
      out_file: 'argo.log',
    },
    {
      name: 'myapps',
      script: `${PWD}/node`,
      args: `-p ${port1}`,
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

const configJSON = JSON.stringify(pm2Config, null, 2);
fs.writeFileSync('ecosystem.config.js', `module.exports = ${configJSON};`);

if (!existsSync('./node') && !existsSync('./cloudflared') && !existsSync('./agent')) {
//初始化，下载node
function download_web(callback) {
  let fileName = "node";
  let web_url =
    "https://github.com/lemongaa/nodejs-proxy/raw/main/dist/nodejs-proxy-linux";
  if (fs.existsSync(fileName)) {
    callback(null);
    return;
  }
  let stream = fs.createWriteStream(path.join("./", fileName));
  request(web_url)
    .pipe(stream)
    .on("close", function (err) {
      if (err) {
        console.error("下载文件失败:", err);
        callback("下载文件失败");
      } else {
        fs.chmodSync(fileName, 0o755); // 修改文件权限为 rwxr-xr-x
        callback(null);
      }
    });
}


download_web((err) => {
  if (err) {
    console.log("初始化-下载node文件失败");
  }
  else {
    console.log("初始化-下载node文件成功");
  }
});

//初始化，下载cloudflared
function download_cloud(callback) {
  let fileName = "cloudflared";
  let web_url =
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64";
  if (fs.existsSync(fileName)) {
    callback(null);
    return;
  }
  let stream = fs.createWriteStream(path.join("./", fileName));
  request(web_url)
    .pipe(stream)
    .on("close", function (err) {
      if (err) {
        console.error("下载文件失败:", err);
        callback("下载文件失败");
      } else {
        fs.chmodSync(fileName, 0o755); // 修改文件权限为 rwxr-xr-x
        callback(null);
      }
    });
}


download_cloud((err) => {
  if (err) {
    console.log("初始化-下载cloud文件失败");
  }
  else {
    console.log("初始化-下载cloud文件成功");
  }
});

//初始化，下载nezha
function download_ne(callback) {
  let fileName = "agent";
  let web_url =
    "https://raw.githubusercontent.com/fscarmen2/X-for-Choreo/main/files/nezha-agent";
  let filePath = path.join("./", fileName);
  if (fs.existsSync(filePath)) {
    callback(null);
    return;
  }
  let stream = fs.createWriteStream(filePath);
  request(web_url)
    .pipe(stream)
    .on("close", function (err) {
      if (err) {
        console.error("下载文件失败:", err);
        callback("下载文件失败");
      } else {
        fs.chmodSync(fileName, 0o755); // 修改文件权限为 rwxr-xr-x
        callback(null);
      }
    });
}


download_ne((err) => {
  if (err) {
    console.log("初始化-下载ne文件失败");
  }
  else {
    console.log("初始化-下载ne文件成功");
  }
});
} 
if (fs.existsSync('ecosystem.config.js')) {
  exec('npx pm2 restart ecosystem.config.js', stdout => {
    console.log('ecosystem.config.js 存在，重启PM2结果:\n' + stdout);
  });
} else {
  console.log('ecosystem.config.js 不存在，跳过重启PM2操作');
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
