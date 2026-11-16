# 参考的开源项目

RF-01 的 CAD 和代码都是独立写的，没有复制下面任何项目的文件。列在这里是因为它们的思路值得看，也方便你把某个模块换成更成熟的现成方案。

**使用前请自己核对许可**。下表的许可信息是 2026 年 11 月查到的；标“直接读到”的是打开项目仓库确认的，标“转述”的来自搜索结果摘录，没有打开原页面。多数硬件项目是非商用许可。

## 硬件

| 项目 | 公开了什么 | 许可 | 可以借鉴 |
|---|---|---|---|
| Will Cogley EyeMech ε3.2（Printables / MakerWorld） | STL、3MF | Printables 上为 CC BY-NC-SA 4.0；MakerWorld 上为更严格的标准数字文件许可（转述） | 眼球和眼皮联动机构，用 SG90 级舵机 |
| InMoov 头部（inmoov.fr） | STL | CC BY-NC（转述） | 真人大小的下颌和眼球机构 |
| Eva，哥伦比亚大学（HardwareX，DOI 10.1016/j.ohx.2020.e00117；文件 DOI 10.5281/zenodo.3539723） | 论文和设计文件 | BSD 3-Clause（转述） | 钢丝拉动硅胶皮肤，25 个 MG90S |
| Emo，哥伦比亚大学（Science Robotics，DOI 10.1126/scirobotics.adi4724） | 论文、数据、模型和分析代码。没有找到硬件 CAD | 硬件未开源 | 26 个电机、磁吸皮肤、对着镜头自学表情的思路 |
| Reachy Mini（github.com/pollen-robotics/reachy_mini） | SDK；STL 在仓库里 | 软件 Apache-2.0；硬件 CC BY-SA-NC（直接读到） | 头部运动和 SDK 设计 |
| ElectronBot（github.com/peng-zhihui/ElectronBot） | STEP、PCB、固件、SDK | GPL-3.0（直接读到） | 桌面机器人整机工程，脸是屏幕 |
| Stack-chan（github.com/stack-chan/stack-chan） | 外壳、原理图、固件 | Apache-2.0（直接读到） | 屏幕脸加舵机 |

RF-01 与它们的主要差别：眼球支架用一体短轴加导槽，不用万向节；左右舵机随支架一起俯仰，连杆始终在一个平面内；下眼皮用前置钢丝连桥。

## 软件

控制台没有打包任何第三方库。摄像头功能打开时会从 CDN 加载 MediaPipe。

| 组件 | 许可 | 与本项目的关系 |
|---|---|---|
| MediaPipe Face Landmarker（`@mediapipe/tasks-vision`） | Apache-2.0（直接读到） | 可选。人脸跟随和表情镜像。输出 52 个表情系数，名字接近 ARKit 但不完全相同 |
| xiaozhi-esp32（github.com/78/xiaozhi-esp32） | MIT（直接读到） | 未使用。想让 ESP32 独立联网对话、不依赖电脑时可以参考 |
| Rhubarb Lip Sync | MIT（直接读到） | 未使用。离线从音频生成口型，比本项目的音量驱动更准 |
| wLipSync（github.com/mrxz/wLipSync） | MIT（直接读到） | 未使用。浏览器里的 MFCC 口型识别 |
| NVIDIA Audio2Face-3D | SDK 为 MIT，模型为 NVIDIA Open Model 许可（直接读到） | 未使用。从音频生成整脸表情系数 |
| FunASR / SenseVoice | 代码 MIT，模型权重另见各自说明（直接读到） | 未使用。中文语音识别，可替代浏览器自带识别 |
| CosyVoice | Apache-2.0（直接读到） | 未使用。中文语音合成 |
| OpenAI Whisper | MIT（直接读到） | 未使用。语音识别 |

## 浏览器支持

Web Serial 需要 Chrome 89、Edge 89 或更新版本的桌面浏览器。Safari 和 iOS 上的浏览器不支持，所以手机上只能用仿真模式。

从 `file://` 直接打开网页时 Web Serial 是否可用，没有找到官方文档的明确说法；从 Chromium 源码看应该可以。如果连接按钮没有反应，在 `app/` 目录下运行 `python3 -m http.server`，然后访问 `http://localhost:8000/face.html`。
