/**
 * 子域端口代理 (numas fork 增量, 对应 --domain-proxy 启动参数)
 *
 * Host: <port>.<domain>[:端口] → 反代到 127.0.0.1:<port>, path/query 原样透传
 * (不带 /proxy 前缀; 对标 code-server 的 --proxy-domain 语义).
 *
 * 与路径式 /proxy/<port>/ (ports-route.ts) 同源安全策略:
 *   - 只代理"已知端口" (Ports.isKnown: 扫描发现 + 白名单), 防 SSRF
 *   - OPENCODE_SERVER_PASSWORD 设置时校验 Basic / auth_token (与 authOnly 路由一致)
 * 仅在 --domain-proxy <domain> 配置时启用; 未配置不注册中间件 (零开销).
 *
 * 公网部署需自备泛域名 DNS + 泛域名证书 (*.<domain> 指向 opencode 监听端口).
 */

import { ServerAuth } from "@/server/auth"
import { credentialFromRequest } from "@/server/routes/instance/httpapi/middleware/authorization"
import { HttpApiProxy } from "@/server/routes/instance/httpapi/middleware/proxy"
import { Context, Effect } from "effect"
import { HttpClient, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import * as Socket from "effect/unstable/socket/Socket"
import { PortsService } from "./ports"

const UNAUTHORIZED = 401
const WWW_AUTHENTICATE = 'Basic realm="Secure Area"'

/** Host 头 → 子域端口: "<port>.<domain>[:端口]" 命中返回端口号, 否则 undefined.
 *  domain 配置可含端口 (如 numas.example.com:8080), 比较时两侧都去掉端口. */
export function domainProxyPort(host: string | undefined, domain: string): number | undefined {
  if (!host || !domain) return undefined
  const hostname = host.replace(/:\d+$/, "").toLowerCase()
  const base = domain.replace(/:\d+$/, "").toLowerCase()
  if (!hostname.endsWith(`.${base}`)) return undefined
  const label = hostname.slice(0, -(base.length + 1))
  if (!/^\d+$/.test(label)) return undefined
  const port = Number(label)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined
  return port
}

/** 子域代理请求处理: auth 校验 → 已知端口校验 → HTTP/WS 反代到 127.0.0.1:<port>.
 *  services 由调用方 (ports 路由层) 闭包捕获, 避免全局中间件的服务注入问题. */
export function proxyDomainRequest(
  request: HttpServerRequest.HttpServerRequest,
  port: number,
  services: {
    ports: PortsService.Ports.Interface
    client: HttpClient.HttpClient
    websocket: Context.Service.Shape<typeof Socket.WebSocketConstructor>
    auth: ServerAuth.Info
  },
) {
  return Effect.gen(function* () {
    if (ServerAuth.required(services.auth)) {
      const credential = yield* credentialFromRequest(request)
      if (!ServerAuth.authorized(credential, services.auth)) {
        return HttpServerResponse.empty({
          status: UNAUTHORIZED,
          headers: { "www-authenticate": WWW_AUTHENTICATE },
        })
      }
    }

    const known = yield* services.ports.isKnown(port)
    if (!known) {
      return HttpServerResponse.text(`port ${port} not known (scan or whitelist first)`, { status: 404 })
    }

    const url = new URL(request.url, "http://localhost")
    const target = new URL("http://127.0.0.1")
    target.port = String(port)
    target.pathname = url.pathname
    target.search = url.search

    const headers = request.headers as Record<string, string>
    if (headers["upgrade"]?.toLowerCase() === "websocket") {
      return yield* HttpApiProxy.websocket(request, target).pipe(
        Effect.provideService(Socket.WebSocketConstructor, services.websocket),
      )
    }
    return yield* HttpApiProxy.http(services.client, target, undefined, request)
  })
}

export * as PortsDomainProxy from "./ports-domain-proxy"
