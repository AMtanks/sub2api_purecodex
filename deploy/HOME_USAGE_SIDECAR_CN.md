# 预构建后端旁挂 `home-usage` sidecar

适用场景：

- 后端仍使用官方预构建 `weishaw/sub2api:latest`
- 前端首页需要 `GET /api/v1/public/home-usage`
- 不想改动 upstream 容器本体

这个 sidecar 只做一件事：

- 直接查询 PostgreSQL 的 `usage_logs`
- 暴露 `GET /api/v1/public/home-usage`
- 返回与前端现有卡片兼容的 JSON

对 `1C1G` Ubuntu 机器，运行成本很低：

- 常驻只有一个很小的 Go HTTP 进程
- 默认数据库连接池 `max_open_conns=2`
- 只额外占一个本地监听端口 `127.0.0.1:18080`

## 文件

把下面两个文件/目录放到你的官方部署目录 `~/sub2api-deploy`：

- `docker-compose.home-usage-sidecar.yml`
- `home-usage-sidecar/`

如果你直接在本仓库里取文件，拷贝方式例如：

```bash
scp -r deploy/docker-compose.home-usage-sidecar.yml deploy/home-usage-sidecar user@your-server:~/sub2api-deploy/
```

## 1. 进入部署目录

```bash
cd ~/sub2api-deploy
```

## 2. 可选：把 sidecar 变量补到 `.env`

```bash
cat <<'EOF' >> .env
HOME_USAGE_SIDECAR_PORT=18080
HOME_USAGE_WINDOW_HOURS=12
HOME_USAGE_QUERY_TIMEOUT_SECONDS=5
HOME_USAGE_DB_MAX_OPEN_CONNS=2
HOME_USAGE_DB_MAX_IDLE_CONNS=1
HOME_USAGE_CORS_ALLOWED_ORIGINS=https://purecodex.asia,https://www.purecodex.asia
EOF
```

## 3. 启动 sidecar

```bash
docker compose -f docker-compose.yml -f docker-compose.home-usage-sidecar.yml up -d --build home-usage-sidecar
```

不要在 `~/sub2api-deploy` 根目录直接执行：

```bash
docker build -t home-usage-sidecar-test .
```

因为这会误用主项目的 `Dockerfile`，去构完整前后端镜像。

如果你只是想单独验证 sidecar 镜像，应该进入它自己的目录：

```bash
cd ~/sub2api-deploy/home-usage-sidecar
docker build -t home-usage-sidecar-test .
```

查看日志：

```bash
docker compose -f docker-compose.yml -f docker-compose.home-usage-sidecar.yml logs -f home-usage-sidecar
```

## 4. 验证 sidecar 本地端口

```bash
curl http://127.0.0.1:18080/health
curl http://127.0.0.1:18080/api/v1/public/home-usage
```

第二条应返回类似：

```json
{"code":0,"message":"success","data":{"window_hours":12,"total_tokens":0,"total_actual_cost":0,"tokens_per_cny":0,"tokens_per_cny_million":0,"updated_at":"2026-01-01T00:00:00Z"}}
```

## 5. 修改 Nginx

编辑你的 API 站点配置，例如：

```bash
sudo nano /etc/nginx/sites-available/sub2api-api
```

在原来的通用 `location /` 之前，插入精确路由：

```nginx
location = /api/v1/public/home-usage {
    proxy_pass http://127.0.0.1:18080/api/v1/public/home-usage;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

然后检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6. 验证公网接口

```bash
curl https://api.purecodex.asia/api/v1/public/home-usage
```

如果这里不再是 `404 page not found`，说明旁挂成功。

## 7. 前端后台配置也要修

你后台站点设置里的 `api_base_url` 现在应该填成：

```text
https://api.purecodex.asia/api/v1
```

不要只填：

```text
https://api.purecodex.asia
```

否则部分前端动态拼接接口地址会不一致。

## 8. 更新方式

官方后端照旧更新：

```bash
docker compose pull
docker compose up -d
```

只有 sidecar 代码改动时，额外执行：

```bash
docker compose -f docker-compose.yml -f docker-compose.home-usage-sidecar.yml up -d --build home-usage-sidecar
```
