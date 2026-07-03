# 使用说明

## 安装

1. 安装 [Tampermonkey / 篡改猴](https://www.tampermonkey.net/)。
2. 点击 [一键安装教评辅助填写器](https://raw.githubusercontent.com/Gzx-070829/suat-course-eval-helper/main/userscripts/suat-eval-helper.user.js)。
3. 在 Tampermonkey 页面点击“安装”。

不需要 GitHub 账号、命令行或 npm。

## 使用

1. 正常登录学校教育信息化平台。
2. 进入某门课程的评价详情页。
3. 点击右下角“教评辅助”。
4. 按钮显示“填写中...”时请稍候，不要重复点击。
5. 完成后查看弹出的填写统计。
6. 逐项检查评分和开放式评价。
7. 确认内容符合真实体验后，手动保存或提交。

脚本会逐个处理评分下拉框，大部分选择“非常满意”，少量选择“满意”。第一个开放题填写课程优点，第二个开放题填写改进建议；如果只有一个文本框，则填写综合评价；超过两个时只处理前两个。

每次评分分布和文字组合可能不同。脚本不会自动完成最终保存或提交。

## 卸载

打开 Tampermonkey 管理面板，找到“SIAT/SUAT 教师评价辅助填写器”，点击删除。
