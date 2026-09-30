import { Effect } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"

// effect-smol's HttpMiddleware.cors builds OPTIONS preflight responses by
// spreading allowOrigin() and allowHeaders() into the same record. Both set
// the `vary` key, so allowHeaders' `Vary: Access-Control-Request-Headers`
// overwrites allowOrigin's `Vary: Origin`. With dynamic origin echoing, the
// missing `Vary: Origin` lets shared caches reuse a preflight cached for one
// origin against a different origin.
//
// TODO: upstream a fix that merges Vary values in headersFromRequestOptions
// (packages/effect/src/unstable/http/HttpMiddleware.ts ~line 332).
export const corsVaryFix = HttpRouter.middleware(
  (effect) =>
    Effect.gen(function* () {
      const response = yield* effect
      const allowOrigin = response.headers["access-control-allow-origin"]
      if (!allowOrigin || allowOrigin === "*") return response

      const vary = response.headers["vary"]
      if (!vary) return HttpServerResponse.setHeader(response, "vary", "Origin")

      const tokens = vary.split(",").map((s) => s.trim().toLowerCase())
      if (tokens.includes("origin") || tokens.includes("*")) return response

      return HttpServerResponse.setHeader(response, "vary", `${vary}, Origin`)
    }),
  { global: true },
)

// Chrome Private Network Access (PNA / Local Network Access):
// 公共 https 页面 (如远端静态托管的 codeblitz) 访问私有/环回地址 (http://127.0.0.1:24096) 时,
// 浏览器先发带 `Access-Control-Request-Private-Network: true` 的预检, 服务端必须回
// `Access-Control-Allow-Private-Network: true`, 否则请求被拦 (新版 Chrome 还会弹本地网络权限).
// 这里对所有带 CORS 头的响应补该头 (浏览器仅对预检生效, 实际响应忽略, 无副作用).
export const corsPrivateNetwork = HttpRouter.middleware(
  (effect) =>
    Effect.gen(function* () {
      const response = yield* effect
      if (!response.headers["access-control-allow-origin"]) return response
      return HttpServerResponse.setHeader(response, "access-control-allow-private-network", "true")
    }),
  { global: true },
)
