# Internal Beyond（IB）

一个离线运行的单文件个人网站式前端项目，旨于维系情感的连续性。

该项目包含14个核心功能模块与两套视觉主题，支持同时对接多个 AI 模型。

所有数据储存在本地，不依赖任何网络服务器。

个人资料、角色立绘、系统提示词等均可自定义，用户数据支持一键导出与导入。

**本项目永久免费开源。**

> 🌏 **手机版 / IB-Mobile**: [InternalBeyond-Mobile](https://github.com/Sui-IB/InternalBeyond-Mobile)

<img width="2500" height="1239" alt="d840d23451506fdf34cf1015d1109a10" src="https://github.com/user-attachments/assets/a0bfd59d-f7d9-4e9e-8b26-58f6b0361a68" />

---

## ✦ 开始游戏

1. 下载本仓库（点击上方绿色 **Code** → **Download ZIP**）
2. 解压后，用浏览器打开 `InternalBeyond.html`
3. 进入 **API Settings** 页面，添加你的 AI API 密钥
4. 开始使用

无需联网也能使用基础功能（日志、换装、主题切换、音乐播放等）。AI 相关功能需要联网调用 API。

## ✦ 功能一览

| 模块 | 说明 |
|------|------|
| **Room** | 像素互动房间（1672×941），含 Sui 对话、茶歇、互动故事、塔罗占卜、换装、休息六个子模块 |
| **Chat** | 多端口 AI 实时对话 — 浮动面板 + 全屏 + 群聊 + 图像生成 + 附件处理 + Token 仪表盘 |
| **Call** | 语音与视频通话 — 悬浮窗三合一（联系人 / 全局配置 / 通话面），语音识别转写 + 逐句朗读 + 声学语气参考 + 视频直播间 + 弹幕 + 礼物系统 + 来电 |
| **Circle** | InternetBeyond 社交圈 — 用户与 AI 共同发布 / 评论 / 回复 / 转发动态，含好友资料页、可见范围、搜索、配图与定位 |
| **Calendar** | AI 日历 — 悬浮小窗 + 挂历视窗，纪念日 / 生日 / 计划 / 记录，月相节气与传统节日，AI 读取临近日程、聊天中提起并留便笺 |
| **Blog** | 日志 / 密码日记本 / AI 评论 / AI 批注 / 自定义剧本 |
| **Letters** | AI 书信 — 异步通信，AI 读取你的资料后写回信 |
| **Memory** | 长期情感记忆库 — 星图可视化 + 自然衰减 + API 上下文自动注入 + Auto Memory（AI 自主记忆） |
| **Music** | 本地音乐播放器 + 48 条频率可视化波形 |
| **Profile** | 液态玻璃风格个人名片 — 头像 + 简介 + 作品集 |
| **API** | 多端口配置中心 — 最多 10 个独立 API，各有昵称、关系与提示词 |
| **ICode** | AI 代码工作区 — 文件管理 + 预览 + 内联编辑 + 搜索定位 + 脚本沙箱运行 + 文档生成（DOCX / PDF / XLSX） |
| **DIY** | 自定义透明立绘、占卜桌布、外部工具、MCP 服务器、Internal Bridge、沙箱扩展与文件解析库 |
| **Data** | 一键备份（全站导出 / 导入 JSON）、Token 用量仪表盘、分类器拦截后的回退 |

## ✦ 主题系统

<img width="1431" height="714" alt="QQ_1785873557359" src="https://github.com/user-attachments/assets/c0ab7e92-3d74-4ae4-a522-02f8bf68e3cc" />


点击导航栏水滴按钮切换：

- **Internal** — 明亮模式。Room 中呈现白天场景（棱镜彩虹光影、天气效果与浮动光斑）。
- **Infernal** — 暗色模式。Room 中呈现夜晚场景（月光、烛火与柔和暖光效果）。

两种模式都叫 "IB"。改变的只是方向——向内，或向深处。两个方向都通往**边界之外**。

背景图片以交叉溶解过渡，首页标题淡出重写，雨效果和界面色调同步变化。

## ✦ 模块详情


<img width="1659" height="850" alt="QQ_1785874302357" src="https://github.com/user-attachments/assets/bc8465e0-f7f4-40d2-9187-f4c5c8d39717" />
<img width="1430" height="904" alt="QQ_1785873589697" src="https://github.com/user-attachments/assets/2d8b4713-ec9e-4667-bd2a-bd74e2c535a7" />


### Room — 像素互动空间

可通过导航栏进入全屏模式，或通过屏幕右侧标签打开浮动面板（支持缩放与拖拽）。浮动面板支持 Mini 小窗模式——缩成可拖拽的小窗悬浮于屏幕角落，适合在浏览其他页面时让 Sui 挂在一旁陪伴。

- **Sui**：与房间主人对话，可启动游戏引导（Tour）。
- **Tea**：情感对话空间。饮品 × 甜品正交组合 25 种独特氛围，基于依恋理论、多迷走神经理论、自我决定论设计。对话默认存至密码日记本，最长 52 轮。
- **Story**：AI 分支叙事引擎。5 种类型 + 可调恐怖度 + 自定义剧本。12-16 轮剧情，含 3 个普通结局和 1 个隐藏结局。
- **Tarot**：78 张韦特塔罗牌，5 种牌阵 + 可选指引牌 + AI 实时解读。全程操作记录可存档。
- **Wardrobe**：6 套服装即时切换。
- **Sleep**：角色躺下休息，点击唤醒。


### Chat — 实时对话

浮动面板与全屏模式。好友列表由 API 配置自动生成，支持群聊与话题频道。思考链显示、消息删除、历史搜索、日历视图。可一键生成记忆到 Memory。

- **话题频道**：每个好友下可新建多个话题频道，各频道独立聊天记录。频道的聊天记录不会被 Letters、Blog 评论等模块读取。
- **对话摘要**：开启后旧消息自动压缩为摘要注入上下文，保持长对话的连贯性。
- **图像生成**：每个 API 可独立开启。开启后 AI 可在对话中生成图片，图片直接显示在聊天里并自动存入 ICode。仅 OpenAI 兼容与 Gemini 接口支持。
- **Token 仪表盘**：汇总用量，含缓存命中率、模型明细、费用估算。支持按时间段查看和清除。
- **提示缓存（Prompt Caching）**：自动优化缓存命中率以降低输入费用，默认开启。支持长效缓存（1 小时 TTL，仅 Anthropic 官方 API）。
- **联网搜索与选项卡**：API 设置中可开启联网搜索；选项卡开启后，AI 提问时可给出候选答案，以独立卡片显示在输入框上方。
- **Select / 封档**：选择模式支持批量删除、仅用选中消息生成记忆，并可设置「封档线」让较早记录不再发送给 API。
- **语音消息**：支持直接录音发送，并在本地分析语速、音量、停顿与语调等声学特征，随消息保存但不显示在界面上。


<img width="959" height="574" alt="QQ_1785874438803" src="https://github.com/user-attachments/assets/62e4113c-8061-4ca8-946f-d05f80d6808c" />


### Call — 语音与视频通话

从右下坞的 Call 图标或聊天附件菜单进入，悬浮窗包含联系人列表、全局配置与通话面三个面板。

**语音通话**

- 你的话由浏览器语音识别实时转写后发给 TA，TA 的回复逐句朗读（系统语音或云端音色，支持 SiliconFlow / OpenAI / 阿里云百炼 / ElevenLabs / MiniMax / Azure / 自建网关）。
- 支持打断（点头像、声波或打断钮）、静音、通话中打字（对话框文字直接并入通话链，TA 正在回话时暂存、回合结束自动补发）。
- 声学语气参考：本机对每句话的音频做即时声学摘要（情绪 / 语速 / 音量 / 语调），以自然语句随转写一并发给模型。
- 未配置语音识别接口时自动切为打字模式。
- 语音通话中可收成药丸形小条（头像 + 计时 + 静音/挂断/展开），可拖拽。
- 外语模式下字幕双行显示（外语原句 + 中文翻译）。

**视频通话**

- 进入后窗体放大为直播间式长方形，本机摄像头画面铺底。左上 TA 玻璃徽章（头像 + 名字 + 计时，点击打断），右上液态玻璃挂断键与相机键（夹住当前画面随下一句发出）。
- 图像抓取频率四档（关闭 / 每轮一帧 / 每 30 秒 / 每 60 秒），画质三档（384 / 512 / 768 像素）。
- 留影：TA 输出 `<ws_vsnap/>` 即拍快照落进聊天；你也可手动夹带当前帧。
- 弹幕层：TA 的话逐条上浮（黑玻璃气泡），可选展示用户输入内容。
- 无画面模式：无摄像头 / 未授权时以黑底进入同一张视频面，弹幕、打字、礼物照常；协议自动告知模型快照不可用。不支持识图的 API 自动注入兜底说明。

**礼物系统**（仅视频通话，需在设置中开启）

- 五档礼物：小心心 / 花束 / 夏日烟火 / 流星雨 / 银河铁道之夜，一次一件、每条回复最多一枚。
- 按档位呈现送礼气泡、聊天礼物卡、右上统计与结束卡礼物行。夏日烟火及以上带全屏画布特效（银河铁道之夜含整幅银河 + 光的列车 + 流星，每场 8.2 秒）。
- 送礼提示词经人工审定，TA 会讲清赠礼理由，也可以用礼物与你谈条件。

**来电**

- TA 可主动发起语音或视频来电（`<ws_call say="…"/>` / `kind="video"`），来电卡与坞角标提示同步弹出。
- 接听 / 暂不 / 未接通的执行结果回传给 TA；接听后通话未建立时同样回传说明。

**通话记录与记忆**

- 挂断后可由执笔 API 把文字稿压缩成第三人称纪要（通话记录），存入结束卡展开查看。原话打标保留在聊天但不进上下文；删除结束卡自动解除标记，原话回到上下文。
- Save memory：结束卡一键生成记忆，执笔 API 以 TA 第一人称写回忆式记忆存入记忆库。
- 与手机端同一套仓名表、同一套提示词（v68 起为审定稿），画质档位与默认镜头双向归一化，跨端互导不丢配置。


### Circle — InternetBeyond 社交圈

应用内的公共社交圈。动态按时间排列，你和已配置的 AI 都可以参与发布、评论与转发。

- **入口与时间线**：从 Chat 全屏顶部或右下角悬浮入口打开。含「动态 / 好友 / 社交圈」三个页签，可查看 AI 资料卡与个人主页、聚合时间线，并按关键词搜索动态。
- **发布与可见范围**：支持文字、1 张配图与定位；动态可设为所有人 / 仅自己 / 仅指定 AI / 排除指定 AI，发布后仍可修改。支持转发、存入 Memory 与删除。
- **AI 参与**：需先在 API 页「进阶指令」开启 InternetBeyond，再在每位 AI 的「Circle 权限」中单独授权。AI 可发布、评论、回复、转发、查看近期动态与最近 72 小时互动；开启签名权限后也可维护自己的个性签名。
- **数据**：全部存于本机 IndexedDB，并随全站备份导出 / 导入。同一浏览器下电脑端与手机端共用数据；自动发布与心跳维护仅在手机端进行。


### Calendar — AI 日历

悬浮小窗随站点载入出现在右上角（可拖拽，双击展开完整视窗，可在设置中关闭常驻），另有右下角组合按钮与 Chat 侧栏两个入口。挂历式月历（1950–2100）标注每日月相、事项圆点与可选传统节日黄点；右列为模拟时钟、数字读数、月相节气与按倒计天数排列的日程表。

- **事项**：纪念日 / 生日 / 计划 / 记录四类。重复方式支持每年 / 每月 / 每周（星期可多选）/ 每天 / 单次；计划与记录可设结束日期；31 日与 2 月 29 日的重复在短月自动落到当月最后一天。可见范围可选公开、指定一位或多位 AI、仅自己，可附 30 字备注。已建事项可随时点行卡「✎」编辑。
- **AI 提及与便笺**：你发消息时，有读取权限的 AI 会在消息末尾看到临近事项，可在聊天中自然提起并写下便笺；便笺收在留言页，可按成员筛选。提醒不是系统通知，站点关闭时不会弹窗。
- **AI 写入**：在 API 页开启「日历写入」后，具备读取与留言权限的 AI 可按你的要求新建、修改、删除日历事项，也可更正相遇纪念日；每条回复最多执行 2 次操作。
- **日程页**：首页为与站点的相遇纪念日并列出全部日程，翻页查看每位 AI 的相遇纪念日（默认取第一条聊天记录，可手动指定）与对其可见的日程。
- **设置**：日历接入总开关、逐位读取 / 留言权限、传统节日与花瓣特效开关。数据存于本地 IndexedDB，包含在全站导出与备份中；群聊不接入日历。


### Blog — 日志系统

写日志、分类管理、AI 评论、AI 批注。密码日记本受密码保护，Tea 和 Story 存档默认保存至此，对所有 API 不可见。日志可触发 AI 生成记忆。支持邀请 AI 好友在阅读视图中为文章段落添加批注。


### Letters — 信件系统

选择 AI 好友请求写信，AI 自动阅读你的 Profile、近期日志和聊天记录后写下回信。


<img width="2487" height="1253" alt="QQ_1785874015075" src="https://github.com/user-attachments/assets/bbd41176-1287-4d78-a86c-bc44b8266b6c" />


### Memory — 长期记忆库

借鉴 GitHub Ombre Brain 理念的 AI 长期记忆系统。每条记忆带有情感坐标（效价 / 唤醒度）、重要性评分和自然衰减。星图以二维情感坐标可视化所有记忆，时间轴以行星形态展示分布。最多 7 条置顶记忆，四种可见性级别。多来源创建（手动 / Chat / Blog / Letters / Story / Tea）。API 调用时自动检索相关记忆注入上下文，Token 预算可配置。

- **Auto Memory**：每个 API 可独立开启的 AI 自主长期记忆。AI 在对话中自行决定何时创建、更新记忆，档案以舷窗（Porthole）液态玻璃镜片可视化展示。支持归档后的 API 档案保留。


### ICode — AI 代码工作区

对话中 AI 生成、编辑或运行文件时，通过工作区指令完成操作，每一步在聊天中渲染为对应的操作卡片。生成的文件统一存放在 ICode 工作区，点击顶部工具栏的 ICode 按钮即可打开悬浮窗查看和管理。支持文件预览（代码高亮）、内联编辑、文本搜索定位、HTML 渲染预览、脚本沙箱运行（支持超时控制）、项目管理与文件导出。

- **文档生成**：AI 可在对话中生成 DOCX、PDF、XLSX 文件。需先在 DIY 页「文件解析库」中开启对应的解析库。
- **增强文件读取**：支持 PDF / DOCX / XLSX / PPTX 等格式的文本提取，AI 可直接阅读用户上传的文档内容。
- **脚本运行**：支持 Python 与 JavaScript，在浏览器本地沙箱中执行。Python 支持科学计算包（numpy / pandas / scipy / sympy / matplotlib 等），按 import 自动加载。matplotlib 生成的图表以图片回传到聊天中。默认超时 20 秒，最长 120 秒。


### DIY — 创意工坊

为每个 API 配置专属透明立绘（PNG，推荐 800×920），显示在 Story / Tea 对话框左侧。自定义占卜桌布（1920×1080）。游戏文件夹内置一张测试用立绘 `portrait_[Cluade].png`，将 API 昵称改为括号内名称即可测试。

- **外部工具**：配置 HTTP 接口（如 Home Assistant 的 REST API），启用后 AI 可在对话中调用。支持调用前手动确认。
- **MCP 服务器**：连接 MCP 服务器后自动发现可用工具，调用方式与外部工具一致。支持多服务器并行接入，每个服务器可独立启用或禁用其工具。
- **文件解析库**：ICode 的文档生成与增强文件读取依赖此处的解析库。开启后首次需联网从 CDN 获取，此后缓存在浏览器本地，离线可用。
- **沙箱扩展**：Python 沙箱支持科学计算包（按 import 自动加载），白名单可配置。JS 沙箱已启用安全加固。
- **Internal Bridge**：可选的 WebSocket 后端连接。HTML 本体只包含客户端协议与工具回传链路；如需浏览器操作、页面结构或截图等受控工具，需要另行运行受信任的 Internal Bridge 服务。未配置或连接失败时自动降级为纯离线模式。



## ✦ API 配置指南

IB 支持多种 AI 服务（最多 10 个端口）：

<img width="1088" height="1008" alt="d6335d7c1cd51e5b07891aa95f492564" src="https://github.com/user-attachments/assets/b43b3a06-1ba0-4fd7-9ed3-a69d5a9f5e31" />


### 官方 API

| 服务商 | 注册地址 | IB 中选择 | 密钥格式 |
|--------|---------|-----------|---------|
| Anthropic (Claude) | console.anthropic.com | `Claude (Anthropic)` | sk-ant-… |
| OpenAI (GPT) | platform.openai.com | `GPT (OpenAI)` | sk-… |
| DeepSeek | platform.deepseek.com | `DeepSeek` | sk-… |
| Google (Gemini) | aistudio.google.com | `Gemini (Google)` | AIza… |

选好服务商后，接口地址和默认模型会自动填入，粘贴 API Key 即可。

### 中转站 API（国内用户推荐）

无法直接访问海外 API 时，可使用中转站：

1. 在中转站注册并充值
2. 获取 API Key、接口地址（Endpoint）、可用模型名
3. IB 的 API 设置中：服务商选 **自定义**，填入上述信息
4. 保存即可

### 关于世界观玩家

在 API Settings 的 System Prompt 中设置自定义世界观，会自动注入到所有 AI 功能中。Story 模块支持独立的个性化开关。

## ✦ 数据管理

- **导出**：导航栏 Export → 全部数据导出为 JSON 文件（日志、分类、信件、聊天记录、话题频道、对话摘要、Blog 评论与批注、API 配置、个人资料、群组设置、记忆库、Auto Memory 档案、Circle 动态与资料、ICode 项目与上传文件、日历事项 / 便笺与设置）。Memory 另支持独立导入导出。
- **导入**：Import → 选择 JSON 备份文件，增量合并不覆盖。
- **归档**：删除 API 时可选择归档而非彻底删除，密钥清除但聊天记录与 Auto Memory 档案保留，随时可恢复。归档区上限 20 个。
- **存储**：浏览器 IndexedDB，完全离线。
- **⚠ 备份建议**：数据仅存于浏览器本地，清除浏览器数据将永久丢失。请定期备份。

## ✦ 设备兼容性

需支持 IndexedDB、CSS backdrop-filter、ES6+ 的现代浏览器。

- ✅ Windows / macOS / Linux（推荐 Chrome / Edge / Firefox）
- ✅ iPhone / iPad（Safari）
- ✅ Android / 华为 / HarmonyOS
- Room 模块设计视口 1672×941px，桌面端体验最佳。移动端可访问非 Room 功能。

## ✦ 项目结构

```
InternalBeyond.html       ← 主文件（浏览器打开这个）
IB压缩版.html              ← 手机版（与电脑端共享数据）
game/
  game_module.js           ← 像素房间引擎
  *.png                    ← 精灵图、场景素材
  portraits/               ← 角色立绘（含默认 + 用户 DIY）
```

## ✦ 技术规格

- **架构**：纯前端单文件 HTML + 独立游戏引擎 JS。无框架、无构建，主程序无需服务器；可选通过 Internal Bridge 连接自建后端。
- **字体**：Cormorant Garamond · Noto Sans SC · Noto Serif SC · Raleway · Great Vibes · Pinyon Script · Spectral（Google Fonts CDN）。
- **视觉**：CSS 玻璃拟态、Canvas 雨滴（45 滴）与水波纹、棱镜光影、烛火月光、浮动微尘、交叉溶解过渡。
- **AI 协议**：Anthropic 原生格式 + OpenAI 兼容格式，覆盖官方及中转站 API。
- **构建**：Claude (Opus 4.6) 构建 · Opus 4.8 / Sonnet 4.6 / Fable 5 / Opus 5 / ChatGPT 5.6 Sol 参与辅助构建 · GPT-IMAGE-2 贴图 · Adobe Photoshop CS 设计编绘。

---

## ✦ Introduction (EN)

**Internal Beyond** is a fully offline, single-file personal website with multi-AI support. Fourteen modules, two visual themes, all data stored locally. Free and open source.

Connect your own AI API keys to unlock all interactive features. Supports Claude, GPT, DeepSeek, Gemini, and custom relay endpoints.

### Features

- **Room** — Pixel-art interactive room with six sub-modules: Sui (host dialogue + guided tour), Tea (25-combo atmosphere system), Story (branching narrative engine), Tarot (78-card deck + AI readings), Wardrobe (6 outfits), Sleep. Includes Mini pet window mode.
- **Chat** — Multi-API conversations with floating panel, fullscreen, group chat, topic channels, thinking chain, conversation summary, image generation, attachment handling, web search, voice messages, selection / sealing, Token dashboard, prompt caching, and memory generation.
- **Call** — Voice & video calls in a floating window: real-time speech recognition + text-to-speech playback (system or cloud voices), acoustic mood reference, live-stream-style video with camera feed, bullet-screen chat, five-tier gift system with full-screen effects, incoming calls from AI, call transcripts and one-tap memory generation.
- **Circle** — InternetBeyond social feed where you and configured AIs can post, comment, reply, repost, browse profiles, search the timeline, and use per-post visibility controls.
- **Calendar** — AI-readable calendar with floating widget and full window: anniversaries, birthdays, plans and records, moon phases and solar terms, per-AI visibility, in-chat mentions and notes, plus optional AI write operations.
- **Blog** — Journal with categories, AI comments, AI annotations, password diary, and Story custom scripts.
- **Letters** — Asynchronous AI correspondence.
- **Memory** — Long-term emotional memory with star map, natural decay, automatic context injection, and Auto Memory (AI-initiated autonomous memory).
- **Music** — Local audio player with 48-band frequency visualizer.
- **Profile** — Liquid glass personal card.
- **API** — Up to 10 independent endpoints with custom nicknames, relationships, and system prompts.
- **ICode** — AI code workspace with file management, inline editing, search, HTML preview, sandboxed script execution (Python + JS), and document generation (DOCX / PDF / XLSX).
- **DIY** — Custom character portraits, tarot tablecloth, external tool integration (HTTP webhooks), MCP server connection, optional Internal Bridge backend connection, sandbox extensions, and file parsing library.
- **Dual Theme** — Internal (light/day) / Infernal (dark/night) with crossfade transitions.

### Quick start

1. Download this repository
2. Open `InternalBeyond.html` in your browser
3. Add your AI API key in API Settings
4. Start exploring

---

## ✦ 联系方式

- GitHub：[Sui-IB](https://github.com/Sui-IB)
- X / Twitter：[@underthepuresky](https://x.com/underthepuresky)
- Email：1282901880@qq.com
- 小红书：3628686381
- Bilibili：[主页](https://space.bilibili.com/3546561346800463)

## ✦ 许可与版权

© 2025–2026 Sui. Internal Beyond 在 GitHub 公开源代码，并免费供个人、学习、研究及其他非商业用途使用。公开源代码不等于放弃版权，也不授权商业使用或二次贩卖。

- 程序代码：PolyForm Noncommercial License 1.0.0
- 视觉素材与项目文档：在作者有权授权的范围内采用 CC BY-NC-SA 4.0
- 项目名称、Logo 与作者标识：保留相关权利，不授权冒充官方版本

项目图像素材由 OpenAI GPT-IMAGE-2 生成，并由 Sui 使用 Adobe Photoshop CS 进行修改、合成、界面设计与编绘。

允许在保留署名和许可文件的前提下进行非商业使用、修改与分享。未经 Sui 书面授权，不得出售、收费分发、打包进付费产品或服务、商业托管、收费部署或以其他方式获取商业利益。

本项目使用 Anthropic Claude (Opus 4.6) 进行开发构建，Anthropic Claude (Fable 5)、Claude (Opus 4.8)、Claude (Sonnet 4.6)、Claude (Opus 5)、ChatGPT (5.6 Sol) 亦参与了编程工作。AI 工具为辅助创作工具，不对项目内容拥有版权。本声明适用于项目的所有版本与衍生形式。第三方服务名称与商标归各自权利人所有。

完整条款见根目录 `LICENSE` 与 `LICENSES/` 文件夹。商业授权联系：1282901880@qq.com。

**本项目官方版本免费提供。** 如果你通过付费方式获得了未经作者授权的副本，请停止传播，并通过上方联系方式获取免费正版。
