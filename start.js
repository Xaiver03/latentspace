#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 配置
const CONFIG = {
  serverPort: null, // 动态分配
  dbPort: 5432,
  colors: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
  },
  getAppUrl: (port) => `http://localhost:${port}/platform`
};

// 辅助函数
const log = {
  info: (msg) => console.log(`${CONFIG.colors.blue}ℹ${CONFIG.colors.reset} ${msg}`),
  success: (msg) => console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} ${msg}`),
  error: (msg) => console.error(`${CONFIG.colors.red}✗${CONFIG.colors.reset} ${msg}`),
  warn: (msg) => console.log(`${CONFIG.colors.yellow}⚠${CONFIG.colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${CONFIG.colors.bright}${CONFIG.colors.cyan}${msg}${CONFIG.colors.reset}\n`)
};

// 检查端口是否被占用
const checkPort = (port) => {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' 
      ? `netstat -ano | findstr :${port}`
      : `lsof -i :${port}`;
    
    exec(command, (error) => {
      resolve(!!error); // 如果命令失败，说明端口未被占用，返回true表示可用
    });
  });
};

// 查找可用端口
const findAvailablePort = async (startPort = 5000, maxPort = 5100) => {
  for (let port = startPort; port <= maxPort; port++) {
    const isAvailable = await checkPort(port);
    if (isAvailable) {
      return port;
    }
  }
  throw new Error(`无法找到 ${startPort}-${maxPort} 范围内的可用端口`);
};

// 等待服务器启动
const waitForServer = (url, maxRetries = 30) => {
  return new Promise((resolve, reject) => {
    let retries = 0;
    
    const check = () => {
      fetch(url)
        .then(() => {
          resolve(true);
        })
        .catch(() => {
          retries++;
          if (retries >= maxRetries) {
            reject(new Error('服务器启动超时'));
          } else {
            setTimeout(check, 1000);
          }
        });
    };
    
    setTimeout(check, 2000); // 初始等待2秒
  });
};

// 打开浏览器
const openBrowser = (url) => {
  const platform = process.platform;
  let command;
  
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  
  exec(command, (error) => {
    if (error) {
      log.warn('无法自动打开浏览器，请手动访问: ' + url);
    }
  });
};

// 检查依赖
const checkDependencies = () => {
  log.info('检查项目依赖...');
  
  if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    log.error('未找到 node_modules，请先运行 npm install');
    return false;
  }
  
  if (!fs.existsSync(path.join(__dirname, '.env'))) {
    log.warn('未找到 .env 文件，将使用默认配置');
  }
  
  return true;
};

// 启动服务器
const startServer = () => {
  return new Promise((resolve, reject) => {
    log.info('启动开发服务器...');
    
    const env = { 
      ...process.env, 
      NODE_ENV: 'development',
      PORT: CONFIG.serverPort.toString()
    };
    const serverProcess = spawn('npm', ['run', 'dev'], {
      env,
      stdio: 'pipe',
      shell: true
    });
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('serving on port')) {
        log.success(`服务器已在端口 ${CONFIG.serverPort} 启动`);
        resolve(serverProcess);
      }
      process.stdout.write(`${CONFIG.colors.magenta}[服务器]${CONFIG.colors.reset} ${output}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.toLowerCase().includes('error') && !error.includes('Vite')) {
        process.stderr.write(`${CONFIG.colors.red}[错误]${CONFIG.colors.reset} ${error}`);
      }
    });
    
    serverProcess.on('error', (error) => {
      log.error('服务器启动失败: ' + error.message);
      reject(error);
    });
    
    serverProcess.on('close', (code) => {
      if (code !== 0) {
        log.error(`服务器异常退出，退出码: ${code}`);
      }
    });
    
    // 超时处理
    setTimeout(() => {
      reject(new Error('服务器启动超时'));
    }, 60000);
  });
};

// 主函数
const main = async () => {
  log.title('🚀 潜空间 (Latent Space) 开发环境启动器');
  
  try {
    // 检查依赖
    if (!checkDependencies()) {
      process.exit(1);
    }
    
    // 查找可用端口
    log.info('正在查找可用端口...');
    CONFIG.serverPort = await findAvailablePort();
    const appUrl = CONFIG.getAppUrl(CONFIG.serverPort);
    
    log.success(`找到可用端口: ${CONFIG.serverPort}`);
    
    // 启动服务器
    const serverProcess = await startServer();
    
    // 等待服务器完全启动
    log.info('等待服务器完全启动...');
    await waitForServer(appUrl);
    
    log.success('服务器启动成功！');
    
    // 打开浏览器
    log.info('正在打开浏览器...');
    openBrowser(appUrl);
    
    // 显示访问信息
    console.log('\n' + '='.repeat(60));
    log.success(`🎉 潜空间平台已准备就绪！`);
    console.log('='.repeat(60));
    console.log(`
  ${CONFIG.colors.bright}访问地址:${CONFIG.colors.reset}
  
  📍 主页: ${CONFIG.colors.cyan}${appUrl}${CONFIG.colors.reset}
  📍 API: ${CONFIG.colors.cyan}http://localhost:${CONFIG.serverPort}/api${CONFIG.colors.reset}
  
  ${CONFIG.colors.bright}快捷键:${CONFIG.colors.reset}
  
  • ${CONFIG.colors.yellow}Ctrl+C${CONFIG.colors.reset} - 停止服务器
  • ${CONFIG.colors.yellow}r${CONFIG.colors.reset} - 重启服务器
  • ${CONFIG.colors.yellow}h${CONFIG.colors.reset} - 显示帮助
    `);
    console.log('='.repeat(60) + '\n');
    
    // 处理退出
    process.on('SIGINT', () => {
      log.info('\n正在关闭服务器...');
      serverProcess.kill();
      process.exit(0);
    });
    
  } catch (error) {
    log.error('启动失败: ' + error.message);
    process.exit(1);
  }
};

// 运行主函数
main().catch((error) => {
  log.error('发生未预期的错误: ' + error.message);
  process.exit(1);
});