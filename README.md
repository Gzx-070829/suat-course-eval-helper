# suat-course-eval-helper

深圳理工大学 / 原 SIAT 课程评价极简辅助预填脚本。本地运行、不联网，填写后由你检查并手动保存。

## 一键安装

### [点击安装教评辅助填写器](https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper.user.js)

不需要会编程，不需要 GitHub 账号，也不需要 npm、下载 ZIP 或复制代码。

## 使用方法

1. 安装 [Tampermonkey / 篡改猴](https://www.tampermonkey.net/)浏览器扩展。
2. 点击上方“一键安装”，再在 Tampermonkey 页面点击“安装”。
3. 正常登录学校系统并打开课程评价详情页。
4. 点击页面右下角“教评辅助”。
5. 等待填写完成，逐项检查评分和文字。
6. 确认无误后，由你本人手动保存或提交。

脚本会为评分项选择以“非常满意”为主、少量“满意”的组合，并为前两个开放题生成本地随机模板。每次结果可能略有不同，请务必检查是否符合你的真实体验。

### 安装图示

<img width="67" height="56" alt="浏览器工具栏中的 Tampermonkey 图标" src="https://github.com/user-attachments/assets/6161c2cf-6384-4855-9038-8e800c3bc63a" />

<img width="1091" height="197" alt="在浏览器扩展商店中找到 Tampermonkey" src="https://github.com/user-attachments/assets/78098c66-cc7e-40fd-8aa5-2f07965c0d28" />

<img width="2553" height="1278" alt="安装 Tampermonkey 浏览器扩展" src="https://github.com/user-attachments/assets/4a4f1322-9969-4a9d-92ed-1b786303eb6d" />

<img width="1115" height="275" alt="确认 Tampermonkey 已安装并启用" src="https://github.com/user-attachments/assets/c525da09-e50d-4b2b-810e-08542d146cdc" />

## 支持页面

- `https://education.siat.ac.cn/*`
- `https://education.suat-sz.edu.cn/*`

脚本只在疑似课程评价页显示“教评辅助”按钮，并支持站内单页切换。

## 安全边界

- 不联网，不收集或上传数据。
- 不使用 AI。
- 不自动保存或提交。
- 不点击学校页面的保存、提交、确认等最终操作按钮。
- 不绕过登录、验证码或权限控制。
- 不批量提交课程评价。
- 工具只减少重复操作，不替代用户的真实评价。

详细教程见 [使用说明](docs/usage.md)，遇到问题请查看 [常见问题](docs/troubleshooting.md)。

## License

[MIT](LICENSE) © Gzx-070829
