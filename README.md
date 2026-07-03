# suat-course-eval-helper

深圳理工大学 / 原 SIAT 教评辅助填写工具。Lite 版离线智能，AI 版可选生成草稿。**不会自动保存或提交。**

支持以下教评页面：

- `https://education.siat.ac.cn/teaching/evaluation`
- `https://education.suat-sz.edu.cn/teaching/evaluation`

## 三步开始使用

1. 安装 [Tampermonkey / 篡改猴](https://www.tampermonkey.net/)浏览器扩展。
2. 点击下面的 Lite 版安装链接，并在 Tampermonkey 页面点击“安装”。
3. 正常登录学校系统并打开教评页面，点击右下角“教评辅助”，检查草稿后再由你手动保存。

### 安装图示

<img width="67" height="56" alt="浏览器工具栏中的 Tampermonkey 图标" src="https://github.com/user-attachments/assets/6161c2cf-6384-4855-9038-8e800c3bc63a" />

<img width="1091" height="197" alt="在浏览器扩展商店中找到 Tampermonkey" src="https://github.com/user-attachments/assets/78098c66-cc7e-40fd-8aa5-2f07965c0d28" />

<img width="2553" height="1278" alt="安装 Tampermonkey 浏览器扩展" src="https://github.com/user-attachments/assets/4a4f1322-9969-4a9d-92ed-1b786303eb6d" />

<img width="1115" height="275" alt="确认 Tampermonkey 已安装并启用" src="https://github.com/user-attachments/assets/c525da09-e50d-4b2b-810e-08542d146cdc" />

不需要 `git clone`、npm、下载 ZIP 或复制代码。

## 一键安装

### [安装 Lite 版（推荐）](https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-lite.user.js)

完全离线，不联网、不需要 API Key。可以识别开放题类型并生成不同的本地草稿，支持预览、编辑、撤销和诊断。

### [安装 AI 版（高级用户可选）](https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-ai.user.js)

适合已有 OpenAI-compatible API 的用户。只有主动配置 API、点击“生成 AI 草稿”并确认隐私提示后才会联网。

> 不要同时启用两个版本，以免页面出现两套辅助面板。

## 我该选哪个版本？

| 情况 | 推荐 |
| --- | --- |
| 第一次使用 | Lite |
| 不懂 API | Lite |
| 不希望信息发到外部 | Lite |
| 只想快速预填 | Lite |
| 已有 API Key，想根据真实感受生成草稿 | AI |

Lite 不是 AI，但会根据题目附近的关键词识别优点、建议、互动、实践、内容等问题，并在本地生成不同草稿。Lite 不联网，也不需要任何 API。

AI 版需要用户主动配置自己的 API。生成时，课程名、教师名、评价问题、语气和用户输入的真实感受会发送到用户配置的 API 服务；项目本身没有数据收集服务器。

## Lite 版怎么使用

1. 点击右下角“教评辅助”展开面板。
2. 选择评分和文本风格。
3. 点击“扫描并生成草稿”。
4. 逐题阅读、修改草稿；不想填写的题目可以勾选“本题不填写”。
5. 点击“采用并预填”。脚本只填写仍为空白的项目。
6. 回到学校页面逐项检查，最后手动保存或提交。

Lite 版支持撤销最近一次填写。若评分控件无法可靠清空，脚本不会强行撤销，而会提醒你手动检查。

详细步骤见 [使用教程](docs/usage.md)。AI 用户请阅读 [AI 模式说明](docs/ai-mode.md)。

## 安全边界

- 不自动保存或提交。
- 不点击学校页面的确认、完成或下一步按钮。
- 不绕过登录、验证码或权限控制。
- 不切换课程进行批量提交。
- 不代替用户作出真实评价。
- 已有评分和已有文本固定不覆盖。
- 所有草稿必须先预览、编辑和确认。
- Lite 版完全离线；AI 版只在用户主动生成并确认后联网。

设计原则见 [伦理与使用边界](docs/ethics.md)。

## 常见问题

### 点安装链接只看到代码怎么办？

请确认 Tampermonkey 已安装并启用，然后刷新本页面，再次点击安装链接。正常情况下会进入 Tampermonkey 安装页，不需要复制代码。

### 页面没有按钮怎么办？

确认脚本和 Tampermonkey 均已启用，并已进入某门课程的评价详情页。可以等待页面加载或刷新后再试。仍未出现时，点击 Tampermonkey 图标确认脚本是否正在当前页面运行。

### 会自动提交吗？

不会。脚本只预填空白项目，最终必须由你检查并手动保存或提交。

### Lite 版会联网吗？

不会。Lite 版没有任何网络请求能力。

### AI 版会上传什么信息？

只有主动生成并确认后，才会向你配置的 API 服务发送课程名、教师名、评价问题、语气和你输入的真实感受。不会发送学校密码、Cookie 或登录凭据。

### 如何卸载？

打开 Tampermonkey 管理面板，找到对应脚本，点击删除即可。

### 如何更新？

Tampermonkey 会按脚本的更新地址检查新版。也可以重新点击本页安装链接，并在安装页面确认更新。

## 免责声明

本项目为非官方开源工具，与深圳理工大学、中国科学院深圳先进技术研究院及教育信息化平台运营方无隶属、授权或背书关系。请遵守学校规章；如果学校规则禁止使用此类工具，应以学校规则为准。

报告问题时，请勿上传姓名、学号、课程、教师、评价内容、Cookie、Token 或 API Key。可以提交脱敏后的诊断信息到 [Issues](https://github.com/Gzx-070829/suat-course-eval-helper/issues)。

## License

[MIT](LICENSE) © Gzx-070829
