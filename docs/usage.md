# 使用教程

Lite 和 Queue 请二选一，不要同时启用。

## Lite 版使用方法

1. 安装 [Lite 版](https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-lite.user.js)。
2. 正常登录学校系统，进入某门课程的评价详情页。
3. 点击右下角“教评辅助”。
4. 等待评分和最多两个开放题填写完成。
5. 逐项检查评分与文字。
6. 由你本人手动点击“保存”。

Lite 不会自动保存，也不会自动提交。

## Queue 版使用方法

### 从列表页启动队列

1. 安装 [Queue 版](https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper-queue.user.js)。
2. 打开“教学评价”的课程列表页。
3. 点击右下角“教评辅助”。
4. 阅读提示，确认发现的“未填写”课程数量。
5. 确认后，Queue 会逐门进入详情页、填写评分和文字，并点击详情页严格等于“保存”的按钮。
6. 返回列表后，Queue 会重新扫描下一门“未填写”课程，不依赖固定行号。
7. 全部处理结束后，检查列表和每门课程内容，再手动决定是否点击最终“提交评价”。

### 在详情页单独使用 Queue

在详情页点击“教评辅助”，Queue 会填写当前课程并自动保存草稿，然后提示返回列表检查状态。

## 为什么跳过“未提交”

“未提交”通常表示课程草稿已经保存、正在等待用户检查。Queue 默认只处理“未填写”，避免覆盖或重复处理用户已经保存过的内容。

## 为什么最终提交必须手动

最终提交会让整批评价正式生效。随机评分和文字模板不一定符合每门课程的真实体验，因此必须由用户检查后亲自决定，脚本不会点击任何最终提交按钮。

## 清除 Queue 状态

按住 `Alt`，再点击右下角“教评辅助”，即可清除本地队列状态。队列卡住、更换账号或准备重新开始时，可以使用此操作。

## 如何停用一个版本

打开 Tampermonkey 管理面板，找到对应脚本，关闭其启用开关。确保 Lite 和 Queue 同一时间只有一个处于启用状态。

## 从 Lite 换到 Queue

1. 在 Tampermonkey 中停用 Lite。
2. 安装并启用 Queue。
3. 刷新学校教评页面。

## 从 Queue 换回 Lite

1. 按住 `Alt` 点击 Queue 的“教评辅助”，清除队列状态。
2. 在 Tampermonkey 中停用 Queue。
3. 安装并启用 Lite。
4. 刷新学校教评页面。
