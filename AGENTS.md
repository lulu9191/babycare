# Babycare 协作约定

本项目是家庭健康档案微信小程序，仅开发微信原生 JavaScript、WXML、WXSS 页面。当前阶段是本机演示骨架，真实微信登录、家庭共享、原件云存储及云端 AI 尚待接入。

## 开始工作

先读 [README.md](README.md)、[工作流](docs/workflow.md)、[工程规范](HARNESS.md)，修改界面或数据前读 [服务契约](docs/client-contract.md)。已确认需求和分阶段验收见 [开发计划](docs/development-plan.md)。

## 实现边界

- 页面通过 `miniprogram/services/repository.js` 读写业务数据，不绕过服务层。
- 健康档案所属人与家庭成员账号分别管理。所有详情、关联和修改须核验所属人；真实家庭权限必须由服务端校验。
- 原件与识别内容分别保存。修改识别字段不能改写原件；识别不清的姓名、日期、数值、剂量保持待确认。
- 处方与实际服药分别记录；不能把开方日期自动当作实际开始日期。
- 演示与真实服务明确区分；云端失败不能回退为模拟成功。不得声称本机演示已提供多人同步或真实识别。
- 不创建 H5 前端。后续平台变化以用户明确决策为准。

## 验证与交付

提交前运行 `bash scripts/check-redlines.sh`、`npm run check`、`npm test`。权限、所属人隔离、原件关联、日期范围、并发版本、用药校验等逻辑变化应有行为测试；简单样式修改无需为了覆盖率编写测试。微信开发者工具和真机验证未执行时明确说明。

工程红线及实际检查覆盖范围见 [HARNESS.md 第 8 节](HARNESS.md#8-机械红线)。发现问题先修复，不绕过门禁。依赖或接口变更同步更新契约与调用方。使用中文沟通，报告具体结果和未接通环节。

`AGENTS.md` 是 agent 入口；`CLAUDE.md` 和 `GEMINI.md` 只作为指针。Git 提交格式见 [提交规范](docs/git-commit-conventions.md)，不要自行提交或发布未获授权的外部动作。

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
