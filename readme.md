# TakeYourMedicine 前端技术文档

## 项目概览
`TakeYourMedicine-uniapp` 为 uni-app 小程序前端工程，当前包含单页“吃药打卡”界面。该页面支持固定用药时段卡片展示、通知邮箱输入、点击“吃药了”提交事件，并在成功后展示视觉反馈弹窗。

## 目录结构（前端相关）
- `TakeYourMedicine-uniapp/pages/index/index.vue`：主页面
- `TakeYourMedicine-uniapp/common/timeSlots.js`：用药时段静态配置
- `TakeYourMedicine-uniapp/static/images/`：药片/药丸图标资源
- `TakeYourMedicine-uniapp/manifest.json`、`pages.json`、`main.js`、`App.vue`、`uni.scss`：uni-app 基础工程文件

## 页面结构与模块说明
### 1. 头部区域
- 绿色渐变 Hero 区域
- 标题文案：记得吃药呦~

### 2. 用药时段卡片
- 由 `TIME_SLOTS` 数据驱动
- 每个时段包含：主标题（如“早饭”）、高亮提示（如“饭后吃”）、药片/药丸图标
- 使用 `grid` 排列为 2 列布局

### 3. 吃药按钮
- 文案：吃药了
- 状态：提交中禁用
- 点击后调用后端接口

### 4. 邮箱输入
- 输入通知邮箱
- 前端校验邮箱格式

### 5. 成功反馈弹窗
- 点击成功后展示自定义弹窗
- 内容包括：成功图标、标题、描述、确认按钮
- 默认 1.8s 自动关闭，也支持手动关闭

## 关键交互逻辑
### 邮箱校验
- 为空：toast 提示“请先输入通知邮箱”
- 格式错误：toast 提示“邮箱格式不正确”

### 点击“吃药了”流程
1. 校验邮箱
2. 发送请求到接口
3. 成功：展示成功弹窗
4. 失败：toast 提示“提交失败，请稍后重试”

## 关键状态
- `email`：当前输入的邮箱
- `submitting`：按钮是否处于提交中
- `successVisible`：成功弹窗显示状态
- `successTimer`：弹窗自动关闭定时器

## 视觉反馈说明
成功后展示自定义遮罩层弹窗，样式设计为：
- 半透明遮罩 + 模糊背景
- 白色圆角卡片
- 渐变圆形勾选图标
- 强调标题与描述文本
- 渐变确认按钮

## 接口需求（前端视角）
### A. 接口概览
- 接口名称：记录吃药事件
- 业务目标：记录用户的“已吃药”点击并触发邮件通知
- 优先级：P0
- 负责人：前端 / 后端

### B. 接口定义
- Method：POST
- Path：`/medicine-events`
- 请求头：`Content-Type: application/json`
- Body：
  - `email` (string, required) 通知邮箱
  - `clickedAt` (string, required) ISO 时间戳
  - `source` (string, required) 固定 `mp-weixin`

示例：
```json
{
  "email": "test@example.com",
  "clickedAt": "2026-03-27T12:30:00.000Z",
  "source": "mp-weixin"
}
```

### C. 返回定义
- 成功：`200/201`
- 失败：`4xx/5xx`

推荐统一响应：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "eventId": "evt_123"
  }
}
```

### D. 前端约束
- `email` 必须有效格式
- `clickedAt` 使用 ISO 8601
- 接口需保证幂等（可基于 `email + clickedAt + source` 或 `client_request_id`）

### E. 联调验收
- 成功用例：合法邮箱 + 正常响应
- 失败用例：邮箱为空/格式错误/接口超时
- 校验点：返回 code 与 message 正确、失败时前端可提示

## 本地运行建议
使用 HBuilderX 或 `uni-app` CLI 运行小程序模式，确保 `pages.json` 中页面路径已正确配置。

## 后续可扩展方向
- 增加“早/中/晚”与具体时间的提醒倒计时
- 增加历史打卡记录列表
- 接入真实后端 API 与用户身份标识
- 支持多邮箱配置与提醒类型管理
