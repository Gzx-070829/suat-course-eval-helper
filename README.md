# suat-course-eval-helper

深圳理工大学 / 原 SIAT 课程评价辅助预填工具。本地运行、不联网，所有内容都需要你检查后手动保存。

## 一键安装

### [点击安装教评辅助填写器](https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper.user.js)

不需要会编程，不需要 GitHub 账号，也不需要安装 npm、下载 ZIP 或复制代码。

## 三步开始使用

1. 安装 [Tampermonkey / 篡改猴](https://www.tampermonkey.net/)浏览器扩展。
2. 点击上方“一键安装”，在 Tampermonkey 页面中点击“安装”。
3. 打开学校课程评价详情页，点击右下角“教评辅助”，预检并确认填写内容，最后由你手动保存。

### 安装图示

<img width="67" height="56" alt="浏览器工具栏中的 Tampermonkey 图标" src="https://github.com/user-attachments/assets/6161c2cf-6384-4855-9038-8e800c3bc63a" />

<img width="1091" height="197" alt="在浏览器扩展商店中找到 Tampermonkey" src="https://github.com/user-attachments/assets/78098c66-cc7e-40fd-8aa5-2f07965c0d28" />

<img width="2553" height="1278" alt="安装 Tampermonkey 浏览器扩展" src="https://github.com/user-attachments/assets/4a4f1322-9969-4a9d-92ed-1b786303eb6d" />

<img width="1115" height="275" alt="确认 Tampermonkey 已安装并启用" src="https://github.com/user-attachments/assets/c525da09-e50d-4b2b-810e-08542d146cdc" />

## 支持页面

- `https://education.siat.ac.cn/*`
- `https://education.suat-sz.edu.cn/*`

脚本只在识别到疑似课程评价详情页时显示右下角按钮，不会在普通教务首页随意出现。

## 可以做什么

- 预检当前页面是否为教评页。
- 显示发现的评分下拉框和文本框数量。
- 选择“非常满意”“满意”或“不自动选择”。
- 修改优点评价和建议评价两段模板。
- 把设置保存在当前浏览器中。
- 用户确认后，只预填仍为空白的项目。
- 撤销最近一次由脚本完成的填写。
- 完成后显示成功、跳过和失败数量。

## 使用流程

1. 点击右下角“教评辅助”。
2. 查看预检结果。
3. 选择评分，并按真实体验修改两段模板。
4. 如需下次继续使用当前设置，点击“保存设置”。
5. 检查逐题预览后，点击“确认并预填”。
6. 再次检查学校页面，最后手动保存或提交。

详细步骤见 [使用教程](docs/usage.md)。遇到问题请查看 [常见问题与排障](docs/troubleshooting.md)。

## 安全与隐私

- 本工具不联网。
- 本工具不使用 AI。
- 本工具不收集或上传数据。
- 不自动保存。
- 不自动提交。
- 不点击学校页面的确认、完成或下一步按钮。
- 不绕过登录、验证码或权限控制。
- 不批量提交课程评价。
- 不覆盖已有评分或已有文字。
- 不代替用户作出真实评价。

设计原则见 [伦理与使用边界](docs/ethics.md)。

## 免责声明

本项目为非官方开源工具，与深圳理工大学、中国科学院深圳先进技术研究院及教育信息化平台运营方无隶属、授权或背书关系。请遵守学校规章；如果学校规则禁止使用此类工具，应以学校规则为准。

反馈问题时，请勿上传姓名、学号、课程、教师、评价内容、Cookie 或 Token。

## License

[MIT](LICENSE) © Gzx-070829
