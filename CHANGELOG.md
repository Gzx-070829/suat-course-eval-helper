# Changelog

本项目的显著变化记录于此。版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.0.0-beta] - 2026-07-03

### Added

- Lite 版升级为离线智能草稿模式。
- Lite 版新增题目识别、问题分类和本地草稿生成。
- Lite 版新增评分选择、草稿预览、逐题编辑、撤销和诊断。
- AI 版新增隐私确认和按题目生成的可编辑草稿流程。

### Changed

- Lite 版固定只填写空白项，不覆盖已有评分或文本。
- AI 版简化默认界面，API 设置改为折叠式首次设置。
- 更新 README、usage、ai-mode 和 ethics 文档。
- 强化安全边界：不自动保存、不自动提交、不批量提交。

## [0.1.0] - 2026-07-03

### Added

- 新增 Lite 用户脚本，支持识别 SIAT/SUAT 课程评价页。
- 新增 Element UI 评分下拉框逐项预选和页面内部滚动支持。
- 新增开放式评价固定模板预填，并保留已有文本。
- 新增 SPA 路由与 DOM 变化监听。
- 新增 AI 用户脚本，支持固定模板和可选 AI 草稿模式。
- 新增 OpenAI-compatible Chat Completions API 配置与 Tampermonkey 本地设置存储。
- 新增 AI 草稿预览、编辑和用户确认流程。
- 新增 README、使用教程、伦理说明和 AI 隐私文档。
- 明确禁止自动保存、提交、确认、批量评价以及绕过登录、验证码或权限控制。
