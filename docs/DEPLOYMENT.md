# 🚀 潜空间 (Latent Space) 生产部署指南

## 📋 部署概览

本指南提供了潜空间平台的完整生产环境部署方案，包括Docker容器化、监控、安全配置和运维最佳实践。

## 🛠️ 系统要求

### 最低配置
- **CPU**: 4核心
- **内存**: 8GB RAM
- **存储**: 100GB SSD
- **网络**: 10Mbps上行带宽

### 推荐配置
- **CPU**: 8核心或更多
- **内存**: 16GB RAM或更多
- **存储**: 500GB SSD + 备份存储
- **网络**: 100Mbps上行带宽

### 系统支持
- Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- Docker 20.10+
- Docker Compose 2.0+

## 🔧 部署前准备

### 1. 安装Docker和Docker Compose

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.production.example .env.production

# 编辑配置文件
nano .env.production
```

**必须配置的关键变量：**
- `DATABASE_URL`: 生产数据库连接
- `SESSION_SECRET`: 会话加密密钥（使用强随机字符串）
- `OPENAI_API_KEY`: OpenAI API密钥
- `REDIS_URL`: Redis连接地址
- SSL证书路径和域名配置

### 3. 域名和DNS配置

将以下域名指向您的服务器IP：
- `yourdomain.com` (主域名)
- `app.yourdomain.com` (应用域名)

## 🚀 快速部署

### 使用Docker Compose部署

```bash
# 克隆项目
git clone <repository-url>
cd ResearchFounderNetwork

# 构建和启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

### 服务验证

```bash
# 检查应用健康状态
curl http://localhost:5001/health

# 检查Nginx状态
curl http://localhost/health

# 查看监控面板
# Grafana: http://localhost:3000 (admin/admin)
# Prometheus: http://localhost:9090
```

## 🔐 SSL/TLS配置

### 使用Let's Encrypt (推荐)

```bash
# 停止Nginx以申请证书
docker-compose -f docker-compose.prod.yml stop nginx

# 申请SSL证书
docker-compose -f docker-compose.prod.yml run --rm certbot

# 重启Nginx
docker-compose -f docker-compose.prod.yml start nginx

# 设置自动续期
echo "0 12 * * * /usr/local/bin/docker-compose -f /path/to/docker-compose.prod.yml run --rm certbot renew" | crontab -
```

### 使用自定义证书

```bash
# 将证书文件放在正确位置
sudo cp your-cert.crt /etc/ssl/certs/latent-space.crt
sudo cp your-private.key /etc/ssl/private/latent-space.key
sudo chmod 600 /etc/ssl/private/latent-space.key
```

## 📊 监控配置

### Grafana仪表板

1. 访问 `http://your-domain:3000`
2. 默认登录: `admin/admin`
3. 配置数据源指向Prometheus: `http://prometheus:9090`
4. 导入预配置的仪表板

### 关键监控指标

- **应用性能**: 响应时间、错误率、吞吐量
- **系统资源**: CPU、内存、磁盘使用率
- **数据库**: 连接数、查询性能、锁等待
- **业务指标**: 用户活跃度、匹配成功率

## 🔄 数据备份策略

### 自动备份配置

备份服务已在Docker Compose中配置，包括：

- **数据库备份**: 每日凌晨2点自动备份
- **保留策略**: 30天内的每日备份，4周的周备份，6个月的月备份
- **存储位置**: `./backups` 目录

### 手动备份

```bash
# 数据库备份
docker-compose -f docker-compose.prod.yml exec db pg_dump -U postgres latent_space_prod > backup_$(date +%Y%m%d).sql

# 应用数据备份
docker-compose -f docker-compose.prod.yml exec app tar -czf /backups/app_data_$(date +%Y%m%d).tar.gz /app/logs
```

### 恢复数据

```bash
# 恢复数据库
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres latent_space_prod < backup_20240101.sql
```

## 🚨 故障排查

### 常见问题

**1. 应用无法启动**
```bash
# 查看详细日志
docker-compose -f docker-compose.prod.yml logs app

# 检查配置
docker-compose -f docker-compose.prod.yml config
```

**2. 数据库连接失败**
```bash
# 检查数据库状态
docker-compose -f docker-compose.prod.yml exec db pg_isready

# 测试连接
docker-compose -f docker-compose.prod.yml exec app node -e "console.log(process.env.DATABASE_URL)"
```

**3. SSL证书问题**
```bash
# 检查证书有效期
openssl x509 -in /etc/ssl/certs/latent-space.crt -text -noout

# 测试SSL配置
openssl s_client -connect yourdomain.com:443
```

### 日志查看

```bash
# 实时查看所有服务日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose.prod.yml logs -f app nginx db

# 查看错误日志
grep -i error ./logs/*.log
```

## 🔧 运维命令

### 服务管理

```bash
# 重启所有服务
docker-compose -f docker-compose.prod.yml restart

# 重启特定服务
docker-compose -f docker-compose.prod.yml restart app

# 停止所有服务
docker-compose -f docker-compose.prod.yml down

# 更新和重新部署
git pull
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### 数据库管理

```bash
# 进入数据库命令行
docker-compose -f docker-compose.prod.yml exec db psql -U postgres latent_space_prod

# 查看数据库大小
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('latent_space_prod'));"

# 优化数据库
docker-compose -f docker-compose.prod.yml exec db psql -U postgres latent_space_prod -c "VACUUM ANALYZE;"
```

### 清理和维护

```bash
# 清理未使用的Docker镜像
docker system prune -a

# 清理日志文件
find ./logs -name "*.log" -mtime +30 -delete

# 查看磁盘使用情况
df -h
du -sh ./
```

## 🔐 安全最佳实践

### 1. 网络安全
- 使用防火墙限制访问端口
- 启用DDoS防护
- 定期更新SSL证书

### 2. 应用安全
- 定期更新依赖包
- 启用安全头配置
- 实施访问日志监控

### 3. 数据安全
- 加密敏感数据
- 定期备份验证
- 实施访问控制

## 📈 性能优化

### 1. 数据库优化
```sql
-- 创建索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_date ON events(date);

-- 优化配置
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
```

### 2. 应用优化
- 启用HTTP/2
- 配置CDN加速
- 优化图片和静态资源

### 3. 缓存策略
- Redis缓存热点数据
- Nginx静态文件缓存
- 数据库查询结果缓存

## 🆘 紧急响应流程

### 1. 服务中断
1. 检查服务状态
2. 查看错误日志
3. 重启相关服务
4. 通知相关人员

### 2. 数据丢失
1. 停止写入操作
2. 从最近备份恢复
3. 验证数据完整性
4. 重新启动服务

### 3. 安全事件
1. 立即隔离受影响系统
2. 分析安全日志
3. 修复安全漏洞
4. 更新安全策略

## 📞 支持与联系

- **技术文档**: [GitHub Wiki](https://github.com/your-repo/wiki)
- **问题报告**: [GitHub Issues](https://github.com/your-repo/issues)
- **紧急联系**: admin@yourdomain.com

---

**最后更新**: 2024年8月16日
**版本**: 1.0.0