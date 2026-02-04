# 后端上云保存 + 同步（接口需求 + 数据模型 + 同步策略）

面向：后端同学（Express + MySQL，现有 API 前缀 `/api/*`，鉴权中间件 `authenticateToken` 将 token 中的用户 id 写入 `req.userId`）。

目标：把前端新增的【历史数据/关键行动/长期主义/Your Life 周报月报】依赖的核心数据（Todo、长期主义计划）实现**多端一致、离线可用、增量同步、可回滚/排错**的上云能力。

---

## 0. 范围与目标

### 要上云同步的数据（MVP）
- **Todo（待办）**：Plan/History/周报月报均依赖
- **长期主义计划 LongTermPlan**：PlanPage 的 longTerm

### 可选（产品化建议）
- **周报/月报报表**：后端按完成时间范围计算，保证跨端一致（前端也可本地算，但跨端会漂）

### 核心目标
- **登录后多端同步**：任意设备登录可见同一份数据
- **离线可用**：本地可编辑，联网自动同步
- **增量同步**：不必每次全量拉取
- **冲突可控**：MVP 至少 LWW（Last Write Wins），可扩展 rev 并发控制
- **可追踪可排错**：每条记录有 `updated_at/deleted_at/client_id/rev` 等字段

---

## 1. 通用约定（强烈建议统一）

### 1.1 鉴权
- 所有数据接口均要求：
  - Header：`Authorization: Bearer <JWT>`
  - 服务端以 token 解出的 `userId` 为准（本项目：`req.userId`），不要信任客户端传 `user_id`

### 1.2 时间与版本字段（用于同步）
所有可同步资源（Todo/Attachment/LongTermPlan/Activity/…）建议统一具备：
- `created_at`：创建时间（建议 `DATETIME(3)`，UTC）
- `updated_at`：每次变更更新（建议 `DATETIME(3)`，UTC）
- `deleted_at`：软删除（未删为 `NULL`，删除时写入并同步）
- `client_id`：客户端设备 id（web 可用 uuid 存 localStorage，稳定且长期不变）
- `rev`：整数递增（可选但强烈建议，用于并发控制/排错）

同步推荐用 `updated_at + deleted_at` 做“变更流（change log）”。

### 1.3 ID 策略（非常关键）
建议：**客户端生成 id，服务端照收**（避免离线创建后“回填映射 id”的复杂度）。
- 示例：`todo_<timestamp>_<rand>`、`ltp_<timestamp>_<rand>`、`att_<timestamp>_<rand>`
- 服务端校验：长度、字符集、唯一性（建议保证 `(user_id, id)` 唯一）

### 1.4 统一错误格式
本项目全局与各路由普遍使用 `res.status(x).json({ error: "..." })`。
- 失败：HTTP 4xx/5xx，JSON `{ "error": "..." }`（可选附带 `{ "message": "..." }`）
- 成功：HTTP 200/201，JSON 返回业务字段即可

---

## 2. Todo 数据模型（建议）

### 2.1 Todo 字段（对齐前端本地）
前端本地 Todo（概念）：
- `id: string`
- `content: string`
- `dueAt: string(ISO)`（可空）
- `tag: "工作"|"健康"|"兴趣"|"爱"`（前端展示用）
- `attachments: [{ id, type:"image"|"video", url, fileName? }]`
- `createdAt: number(ms)`
- `completed: boolean`
- `completedAt?: number(ms)`

后端建议（字段名可按后端习惯，建议后端存英文枚举，响应可映射）：
- `id: string`
- `user_id: bigint`
- `content: string (max 200)`
- `tag: enum('work','health','interest','love')`
- `due_at: datetime(3) | null`
- `completed: boolean`
- `completed_at: datetime(3) | null`
- `created_at / updated_at / deleted_at`
- `client_id: string | null`
- `rev: int`

### 2.2 Attachment（附件）建议
本地 `dataURL` 不适合产品化（体积大、跨端慢、内存/存储压力大）。

建议：
- 上传走现有 `POST /api/upload`，返回可公网访问的 URL（后续可接 CDN/对象存储）
- Todo 里只存 URL + 元信息

Attachment 建议字段：
- `id: string`
- `user_id: bigint`
- `todo_id: string`
- `type: 'image'|'video'`
- `url: string`
- `file_name: string | null`
- `created_at / updated_at / deleted_at`
- `client_id / rev`

---

## 3. Todo 接口（CRUD + 同步）

下面给两套：A 同步端点（推荐，一把梭）+ B 传统 CRUD（建议也提供，便于调试/运营/回放）。

### 3.A 同步方案（推荐）：`/api/sync/*`

#### 3.A.1 拉取变更（增量）
`GET /api/sync/changes?since=<cursor>&limit=200`

- **Auth**：Bearer JWT（服务端使用 `req.userId`）
- **Query**
  - `since`：游标（建议用字符串游标，避免同毫秒漏拉）
    - 推荐格式：`<updated_at_ms>:<id>`；首次全量用 `0:0`
  - `limit`：默认 200
- **Response**
  - `server_time_ms`：服务器当前时间（客户端可用于诊断/展示）
  - `next_since`：下一次拉取用的游标（等于本次返回最后一条 change 的 `<updated_at_ms>:<id>`；若无变更则原样返回）
  - `has_more`：是否还有更多
  - `changes`：按 `(updated_at asc, id asc)` 排序的数组

每条 change：
- `type`: `"todo" | "todo_attachment" | "long_term_plan" | "long_term_activity"`
- `op`: `"upsert" | "delete"`
- `id`: string
- `updated_at_ms`: number
- `data`: 当 `op=upsert` 返回完整对象；`op=delete` 可只返回 `{ id, deleted_at_ms }`

> 后端必须保证：排序稳定、不会漏（建议按 `(updated_at, id)` 严格递增返回），并且软删除也会出现在变更流里。

#### 3.A.2 推送变更（增量）
`POST /api/sync/push`

- **Auth**：Bearer JWT
- **Body**
  - `client_id: string`（设备 id）
  - `changes: Array<Change>`

Change 结构：
- `type`: 同上
- `op`: `"upsert" | "delete"`
- `id`: string
- `client_updated_at_ms`: number（客户端变更时间，用于诊断；服务端最终以服务器 `updated_at` 为准）
- `base_rev?: number`（可选：并发控制）
- `data?: object`（upsert 必须传完整对象；delete 可为空）

- **Response**
  - `server_time_ms`
  - `results`: 与 `changes` 一一对应

Result 结构：
- `id`
- `type`
- `status`: `"applied" | "conflict" | "error"`
- `updated_at_ms`
- `rev`
- `resolved?`: 当冲突时，服务端最终版本（建议返回，便于客户端落库）
- `error?`: 当 error 时的说明

#### 3.A.3 冲突策略（最低可用标准）
MVP 最低标准：**LWW（最后写入获胜）**
- 服务端按“接收写入的时间”更新 `updated_at`；同一条记录多端并发时，后到的覆盖先到的（并写入 rev）

更稳的做法（建议尽快支持）：
- 每条记录维护 `rev`（整数自增）
- upsert 必须携带 `base_rev`
- 若 `base_rev != 当前 rev`：
  - 返回 409 或在 `results` 标 `conflict`，并附带 `resolved`（服务端当前版本）

---

### 3.B 传统 CRUD（建议也提供）

#### 3.B.1 列表（支持增量）
`GET /api/todos?since=<updated_at_ms>&include_deleted=0&limit=200&cursor=...`

返回建议：
- `items: Todo[]`（包含 `deleted_at` 字段）
- `next_cursor`（可选）
- `server_time_ms`

#### 3.B.2 创建（幂等 upsert）
`POST /api/todos`
- Body：完整 Todo（允许客户端传 `id`）
- 行为建议：若 `(user_id,id)` 已存在则按 upsert（返回 200 + 最新记录），否则创建（201）

#### 3.B.3 更新（支持 patch + 并发控制可选）
`PUT /api/todos/:id`
- Body：可全量或 patch（至少支持：`content/tag/due_at/completed/completed_at/attachments`）
- 并发：可用 `base_rev` 或 `If-Match: <rev>`

#### 3.B.4 删除（软删除）
`DELETE /api/todos/:id`
- 写 `deleted_at=now()`，并更新 `updated_at`（让增量同步可见）

---

## 4. 长期主义计划（LongTermPlan）模型与接口

### 4.1 数据模型（对齐前端）
前端本地结构：
- `id, title`
- `startDate(YYYY-MM-DD), endDate(YYYY-MM-DD)`
- `type: "daily"|"weekly"|"monthly"`
- `activities: [{ id, name, startTime("HH:mm"), durationMinutes }]`
- `createdAt(ms)`

后端建议：
- `long_term_plans`：`id,user_id,title,start_date,end_date,type,created_at,updated_at,deleted_at,client_id,rev`
- `long_term_activities`：`id,plan_id,user_id,name,start_time,duration_minutes,created_at,updated_at,deleted_at,client_id,rev`

### 4.2 接口（CRUD + 增量）
建议路径：
- `GET /api/plans/long-term?since=...&include_deleted=0`
- `POST /api/plans/long-term`（支持客户端 id，幂等 upsert）
- `PUT /api/plans/long-term/:id`
- `DELETE /api/plans/long-term/:id`（软删）

活动两种实现方式（二选一）：
- **方式 1（简单）**：`PUT plan` 时整体提交 `activities`，服务端对 activities 做 upsert + 软删
- **方式 2（更细）**：提供 activities 子资源接口
  - `POST /api/plans/long-term/:id/activities`
  - `PUT /api/plans/long-term/:id/activities/:activityId`
  - `DELETE /api/plans/long-term/:id/activities/:activityId`

---

## 5. 周报/月报（可选，但产品化建议）

你们现在是前端按 `completedAt` 本地过滤生成。为跨端一致，建议后端提供：

### 5.1 周报/月报查询
- `GET /api/reports/weekly?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/reports/monthly?start=YYYY-MM-DD&end=YYYY-MM-DD`

返回示例（建议）：
- `range: { start, end }`
- `by_tag: { health:{count:..}, work:{count:..}, interest:{count:..}, love:{count:..} }`
- `items: [{ todo_id, content, tag, completed_at }]`（可分页）

> 若确实需要 offset（0=上周，1=上上周），可以后端额外支持 `offset` 版本，但范围版更直观也更易测试。

---

## 6. 上传接口需要扩展的点（Todo 附件）

现有：`POST /api/upload`，并且当前实现只允许图片，`type` 仅支持 `avatar/vision-image/vision-cover`。

为支持 Todo 附件建议：
- 允许 `type` 增加：`todo-image`、`todo-video`
- 允许视频 MIME（如 `video/mp4`, `video/webm` 等），并按类型限制大小
- 可选字段：`todo_id`（便于后端归档路径，例如 `uploads/<uid>/todos/<todo_id>/...`）
- 响应保持现有格式：`{ success: true, url: "<publicUrl>" }`

---

## 7. 推荐同步流程（客户端视角，便于后端理解）

### 7.1 首次登录
- `GET /api/sync/changes?since=0:0` 拉全量
- 客户端落库，并保存 `next_since`

### 7.2 日常使用（离线 + 自动同步）
- 本地每次变更入队（upsert/delete）
- 联网后 `POST /api/sync/push` 批量推送
- 推送成功后，用响应 `server_time_ms`/服务端返回的记录 `updated_at_ms` 更新本地
- 再 `GET /api/sync/changes?since=<last>` 拉取其他端的变更，直到 `has_more=false`

### 7.3 后端需要保证的性质
- **幂等**：同一条变更重复推送不会造成重复记录（依赖客户端 id + upsert）
- **软删除可同步**：删除也会出现在增量里
- **排序稳定**：按 `(updated_at, id)` 返回，避免漏拉/重复处理
- **多资源同游标**：`/sync/changes` 返回 todo/plan/activity 等混合变更流时，也必须稳定排序

---

## 8. 最低可落地版本（MVP：最小完整闭环）

如果后端想先快速支持（够前端开始改同步），先实现以下接口 + 表即可：

### Todo
- `GET /api/todos?since=...`（返回含 `deleted_at` 的增量）
- `POST /api/todos`（幂等 upsert，允许客户端 id）
- `PUT /api/todos/:id`（upsert/patch）
- `DELETE /api/todos/:id`（软删）

### LongTermPlan
- `GET /api/plans/long-term?since=...`
- `POST /api/plans/long-term`（幂等 upsert）
- `PUT /api/plans/long-term/:id`
- `DELETE /api/plans/long-term/:id`

### Upload（Todo 附件）
- `POST /api/upload` 支持 `todo-image/todo-video`

> 备注：如果前端通过 `/api/proxy/*` 调用，你们也可以像现有路由一样在 `src/app.js` 增加对应的 proxy 挂载（例如 `/api/proxy/todos`、`/api/proxy/sync`）。
