# Git 提交规范

使用 `type(scope): 简短说明`。type 选用 `feat`、`fix`、`docs`、`test`、`refactor`、`build`、`ci` 或 `chore`；scope 可用 `pages`、`records`、`family`、`recognition`、`config` 等。

例：`feat(records): 添加处方实际用药日期记录`。

一次提交围绕一个可说明的行为变化；说明影响、验证及未接通的外部服务。明确列出暂存文件，不使用 `git add .` 或 `git add -A`。不跳过项目检查，不覆盖其他人的未提交修改，不自动执行外部发布。

当前提交格式属于人工约定，尚未配置 commitlint；机械门禁范围见 `../HARNESS.md` 第 8 节，不能声称提交格式已被 CI 强制。
