# 字幕对齐审校台

供字幕审校员使用的纯前端工具（TypeScript + React + Vite + CSS）。上传“源字幕”和“译字幕”两份 JSON，
通过自实现的动态规划计算全局最优对齐（**不调用任何在线服务**，所有运算均在浏览器本地完成）。

## 输入格式

两份文件结构相同，顶层均为数组；空数组 `[]` 合法。每项形如：

```json
{ "id": "c001", "startMs": 0, "endMs": 1500, "text": "字幕文本" }
```

校验规则（任一文件非法则**整批拒绝**，展示全部错误并清除旧结果）：

- `id`：唯一、非空字符串；
- `startMs` / `endMs`：整数，且 `0 ≤ startMs < endMs`；
- `text`：字符串；
- 全数组按 `startMs` 严格递增，相邻项时间不重叠（首尾相接合法）。

## 允许的对齐操作与成本

| 操作 | 含义 | 成本 |
| --- | --- | --- |
| `1:1` | 一条源 ↔ 一条译 | 见下 |
| `1:2` | 一条源 ↔ 连续两条译 | 见下 |
| `2:1` | 连续两条源 ↔ 一条译 | 见下 |
| `跳源` | 跳过一条源 | 该条时长 `endMs-startMs` + 1000 |
| `跳译` | 跳过一条译 | 该条时长 `endMs-startMs` + 1000 |

配对块取各自一侧首项 `startMs` 与末项 `endMs`：

```
cost = |源块起点 - 译块起点| + |源块终点 - 译块终点| + 500 × |源条数 - 译条数|
```

动态规划按后向递推求全局最优（**非局部贪心**）。总成本相同时，比较**完整操作序列**并按
`1:1 → 1:2 → 2:1 → 跳源 → 跳译` 的次序取字典序最小者。

约定：

- 空对空：空操作序列、总成本 0；
- 即使最优解全部由跳过组成，也会在“未匹配项”中列出全部条目。

## 页面

- 两个独立 JSON 上传入口（源 / 译），显示每份文件的合法状态与条数；
- 双栏展示两侧原字幕；
- 配对块、未匹配项、完整操作序列、总成本；
- 点击配对块（或操作行、未匹配项）同步高亮两侧其中所含原项，再点一次取消。

## 本地开发

```bash
npm ci
npm run dev       # 开发服务器
npm run build     # 类型检查 + 产出 dist/
npm run preview   # 预览生产构建
```

## 测试

```bash
npm run test:unit   # Vitest（含小规模暴力枚举器，交叉验证 DP 最优性与字典序）
npm run test:e2e    # Playwright（自动启动 vite preview）
npm run verify      # 一次性：build + Vitest + Playwright
```

## Docker Compose

启动静态 Web 应用（nginx 托管 `dist/`）：

```bash
docker compose up web            # 默认宿主端口 8080
WEB_PORT=9000 docker compose up web
```

一次性验证服务（容器内运行 Vitest 与 Playwright，结束即退出）：

```bash
docker compose run --rm verify
```
