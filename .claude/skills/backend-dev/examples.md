# backend-dev 示例：正式 API 接口文档

## A. 文档信息

- 文档标题：TakeYourMedicine - 用药计划与打卡 API
- 文档版本：v1.0.0
- 基础 URL：
  - Dev: `https://dev-api.takeyourmedicine.com`
  - Test: `https://test-api.takeyourmedicine.com`
  - Prod: `https://api.takeyourmedicine.com`
- 鉴权方式：Bearer Token（JWT）

统一响应体：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "traceId": "9f8c4e1d2c3b4a5f",
  "timestamp": "2026-03-27T10:30:00+08:00"
}
```

---

## B. 接口清单

### 1) 查询今日用药计划

- 用途：获取用户当天用药项列表
- Method + Path：`GET /api/v1/medications/today`

#### 请求头

| 名称 | 必填 | 说明 |
|---|---|---|
| Authorization | 是 | `Bearer <token>` |
| X-Timezone | 否 | 时区，默认 Asia/Shanghai |

#### Query 参数

| 字段 | 类型 | 必填 | 说明 | 示例 |
|---|---|---|---|---|
| date | string | 否 | 查询日期（YYYY-MM-DD） | `2026-03-27` |
| includeDone | boolean | 否 | 是否包含已完成 | `true` |
| page | number | 否 | 页码，默认 1 | `1` |
| pageSize | number | 否 | 每页条数，默认 20，最大 50 | `20` |

#### 成功响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "planId": "mp_10001",
        "drugName": "阿司匹林肠溶片",
        "dosage": "1片",
        "scheduledTime": "2026-03-27T08:00:00+08:00",
        "status": "PENDING",
        "canCheckIn": true
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1
    }
  },
  "traceId": "trace-today-001",
  "timestamp": "2026-03-27T08:01:00+08:00"
}
```

#### 失败响应示例

```json
{
  "code": 1001,
  "message": "Unauthorized",
  "data": null,
  "traceId": "trace-auth-001",
  "timestamp": "2026-03-27T08:01:02+08:00"
}
```

#### 错误码

| code | HTTP | 说明 |
|---|---|---|
| 0 | 200 | 成功 |
| 1001 | 401 | token 无效或过期 |
| 1200 | 400 | 参数错误 |
| 5000 | 500 | 服务器异常 |

---

### 2) 用药打卡

- 用途：提交某条用药计划的完成记录
- Method + Path：`POST /api/v1/medications/{planId}/checkin`

#### 请求头

| 名称 | 必填 | 说明 |
|---|---|---|
| Authorization | 是 | `Bearer <token>` |
| Idempotency-Key | 是 | 幂等键，防止重复打卡 |

#### Path 参数

| 字段 | 类型 | 必填 | 说明 | 示例 |
|---|---|---|---|---|
| planId | string | 是 | 用药计划 ID | `mp_10001` |

#### Body 参数

| 字段 | 类型 | 必填 | 说明 | 示例 |
|---|---|---|---|---|
| actualTime | string | 是 | 实际服药时间（ISO 8601） | `2026-03-27T08:05:00+08:00` |
| note | string | 否 | 备注，最大 200 字符 | `饭后服用` |

#### 成功响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "checkinId": "ci_90001",
    "planId": "mp_10001",
    "status": "DONE",
    "actualTime": "2026-03-27T08:05:00+08:00"
  },
  "traceId": "trace-checkin-001",
  "timestamp": "2026-03-27T08:05:02+08:00"
}
```

#### 失败响应示例

```json
{
  "code": 2409,
  "message": "Already checked in",
  "data": null,
  "traceId": "trace-checkin-dup-001",
  "timestamp": "2026-03-27T08:05:05+08:00"
}
```

#### 错误码

| code | HTTP | 说明 |
|---|---|---|
| 0 | 200 | 成功 |
| 1001 | 401 | 未认证 |
| 2004 | 404 | planId 不存在 |
| 2409 | 409 | 重复打卡 |
| 5000 | 500 | 服务器异常 |

---

## C. 数据模型

### medication_plan

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 计划 ID |
| user_id | varchar(64) | idx, not null | 用户 ID |
| drug_name | varchar(128) | not null | 药品名称 |
| dosage | varchar(64) | not null | 用量 |
| scheduled_time | datetime | not null | 计划时间 |
| status | varchar(16) | not null | PENDING/DONE/MISSED |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |

### medication_checkin

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 打卡 ID |
| plan_id | varchar(64) | idx, not null | 关联计划 ID |
| user_id | varchar(64) | idx, not null | 用户 ID |
| actual_time | datetime | not null | 实际服药时间 |
| note | varchar(200) | null | 备注 |
| idem_key | varchar(128) | unique | 幂等键 |
| created_at | datetime | not null | 创建时间 |

---

## D. 业务规则

- 状态流转：`PENDING -> DONE`，超时未打卡可转 `MISSED`
- 幂等规则：`Idempotency-Key + user_id + plan_id` 唯一
- 分页规则：`page >= 1`，`1 <= pageSize <= 50`
- 排序规则：按 `scheduled_time asc`
- 限流策略：同用户打卡接口 60 次/分钟

---

## E. 联调与验收

### 调试要点

- 在 Postman/Apifox 预置 Bearer Token
- 打卡接口每次请求生成新 `Idempotency-Key`
- 对 401、409、500 场景分别回归

### 最小测试数据

- 用户：`u_10001`
- 计划：`mp_10001`（当天 08:00）
- Token：测试环境固定测试账号签发

### 验收用例

- 正常：查询列表成功 + 打卡成功
- 异常：token 过期返回 401
- 边界：重复打卡返回 409

### 上线检查项

- [ ] 数据库索引已创建
- [ ] 幂等唯一键生效
- [ ] 日志含 traceId
- [ ] 回滚脚本已准备
