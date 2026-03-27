# frontend-dev 示例：接口需求文档（Frontend -> Backend）

> 场景：用药提醒小程序首页「今日用药列表」

## A. 接口概览

- 接口名称：查询今日用药计划
- 业务目标：前端首页展示当天待服药项，支持完成打卡
- 优先级：P0
- 负责人：
  - 前端：小程序开发
  - 后端：Node.js 服务开发

## B. 接口定义

- Method + Path：`GET /api/v1/medications/today`
- 请求头：
  - `Authorization: Bearer <token>`（必填）
  - `X-App-Platform: wechat-miniapp`（选填）
  - `X-Timezone: Asia/Shanghai`（选填，默认 Asia/Shanghai）

### Query 参数

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|---|---|---|---|---|
| date | string | 否 | 查询日期（ISO 日期）默认当天 | `2026-03-27` |
| includeDone | boolean | 否 | 是否包含已完成项，默认 false | `true` |
| page | number | 否 | 页码，默认 1 | `1` |
| pageSize | number | 否 | 每页条数，默认 20，最大 50 | `20` |

### Path 参数

- 无

### Body 字段

- 无（GET 请求）

## C. 返回定义

### 统一响应结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 0
    }
  },
  "traceId": "9f8c4e1d2c3b4a5f",
  "timestamp": "2026-03-27T09:10:11+08:00"
}
```

### data 字段结构

| 字段名 | 类型 | 可空 | 说明 | 示例 |
|---|---|---|---|---|
| list | array | 否 | 今日用药项列表 | - |
| list[].planId | string | 否 | 计划 ID | `mp_10001` |
| list[].drugName | string | 否 | 药品名 | `阿司匹林肠溶片` |
| list[].dosage | string | 否 | 用量文案 | `1片` |
| list[].scheduledTime | string | 否 | 计划服药时间（ISO 8601） | `2026-03-27T08:00:00+08:00` |
| list[].status | string | 否 | 状态：PENDING/DONE/MISSED | `PENDING` |
| list[].canCheckIn | boolean | 否 | 当前是否可打卡 | `true` |
| pagination.page | number | 否 | 当前页 | `1` |
| pagination.pageSize | number | 否 | 每页条数 | `20` |
| pagination.total | number | 否 | 总条数 | `12` |

### 错误码与前端策略

| code | HTTP | 含义 | 前端处理 |
|---|---|---|---|
| 0 | 200 | 成功 | 正常渲染 |
| 1001 | 401 | 登录已过期 | 跳转登录并缓存当前路由 |
| 1200 | 400 | 参数错误 | Toast 提示并使用默认日期重试 |
| 2004 | 404 | 用户计划不存在 | 展示空态并引导创建计划 |
| 5000 | 500 | 服务器异常 | Toast + 重试按钮 + 上报 |

## D. 前端约束

- 分页：`page/pageSize`，下拉触底加载下一页
- 排序：按 `scheduledTime asc`
- 筛选：`includeDone=false` 默认只看待完成项
- 幂等：打卡接口需支持 `Idempotency-Key`
- 时间格式：全部 ISO 8601（带时区），前端按本地时区显示

## E. 联调验收

### Mock 数据

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
  "traceId": "mock-trace-id",
  "timestamp": "2026-03-27T08:01:00+08:00"
}
```

### 用例

- 成功：返回 1 条待服药项，页面可渲染并可打卡
- 失败：token 过期返回 401，前端跳登录
- 边界：当天无数据，展示空态，不报错

### 验收清单

- [ ] 字段齐全且类型一致
- [ ] 分页正确（含 total）
- [ ] 401/500 处理符合约定
- [ ] traceId 可用于日志追踪
