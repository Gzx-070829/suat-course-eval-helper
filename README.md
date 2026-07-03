# SIAT/SUAT 教师评价辅助填写器

适用于深圳理工大学 / 原 SIAT 教育信息化平台。

本项目本地运行，不联网，不使用 AI，不收集数据。

## 一键安装

### [Lite 版：推荐大多数同学使用](https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-lite.user.js)

只填写当前课程，不自动保存，不自动提交。填写完成后，请检查并手动保存。(我更建议这个,queue有小bug,而且本意是节省时间,所以有些低分还是要自己打的)

### [Queue 版：批量队列版](https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-queue.user.js)

支持从列表页逐门处理状态为“未填写”的课程，自动填写并点击详情页严格等于“保存”的按钮。**不会点击最终“提交评价”。**

> 重要：Lite 和 Queue 二选一，不要同时启用。如果两个版本都已安装，请在 Tampermonkey 管理面板停用其中一个。

## 安装与使用

1. 安装 [Tampermonkey / 篡改猴](https://www.tampermonkey.net/)浏览器扩展。
2. 点击上方所需版本的安装链接。
3. 在 Tampermonkey 页面点击“安装”。
4. 正常登录学校系统并打开教评页面。
5. 点击页面右下角“教评辅助”。
6. Lite：检查填写结果后手动保存。
7. Queue：会自动保存每门课程的草稿；全部处理完后，检查列表并手动决定是否最终提交评价。

不需要会编程，不需要 GitHub 账号，也不需要 npm、下载 ZIP 或复制代码。

### 安装图示

<img width="67" height="56" alt="浏览器工具栏中的 Tampermonkey 图标" src="https://github.com/user-attachments/assets/6161c2cf-6384-4855-9038-8e800c3bc63a" />

<img width="1091" height="197" alt="在浏览器扩展商店中找到 Tampermonkey" src="https://github.com/user-attachments/assets/78098c66-cc7e-40fd-8aa5-2f07965c0d28" />

<img width="2553" height="1278" alt="安装 Tampermonkey 浏览器扩展" src="https://github.com/user-attachments/assets/4a4f1322-9969-4a9d-92ed-1b786303eb6d" />

<img width="1115" height="275" alt="确认 Tampermonkey 已安装并启用" src="https://github.com/user-attachments/assets/c525da09-e50d-4b2b-810e-08542d146cdc" />

## 一些问题
> **无法使用(见下)**
<img width="1625" height="381" alt="image" src="https://github.com/user-attachments/assets/977fc083-a053-4519-85ef-71e144f89cee" />

<img width="1020" height="217" alt="image" src="https://github.com/user-attachments/assets/b5600d65-f8ff-46dd-b3ca-122c2bcd2bee" />
- 即可解决

## 两个版本的区别

| 功能 | Lite | Queue |
| --- | --- | --- |
| 填写当前课程 | 支持 | 支持 |
| 随机评分与本地文字模板 | 支持 | 支持 |
| 自动保存当前课程草稿 | 不支持 | 支持 |
| 从列表处理“未填写”课程 | 不支持 | 支持 |
| 点击最终“提交评价” | 永不点击 | 永不点击 |
| 联网或收集数据 | 否 | 否 |

## 安全边界

- 两版均不联网、不使用 AI、不收集数据。
- 不绕过登录、验证码或权限控制。
- Lite 不点击“保存”，也不自动提交。
- Queue 只允许点击详情页文字严格等于“保存”的按钮。
- Queue 默认跳过“未提交”和“已提交”课程。
- 两版均不会点击“提交评价”“提交”“确认”“最终提交”或其他最终动作按钮。
- 用户必须检查评价内容，并自行决定是否最终提交。

详细说明见 [使用教程](docs/usage.md)、[伦理与安全边界](docs/ethics.md)和[常见问题](docs/troubleshooting.md)。

## 如何卸载

打开 Tampermonkey 管理面板，找到 Lite 或 Queue 脚本，点击删除，然后刷新学校页面。

## License

[MIT](LICENSE) © Gzx-070829
