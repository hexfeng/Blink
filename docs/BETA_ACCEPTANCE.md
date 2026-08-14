# Blink 0.1.0 本地 Beta 生命周期验收

- 结论：通过
- 执行日期：2026-08-14
- 环境：Windows、Chrome 151.0.7922.138、独立 `--user-data-dir` Profile、Chrome Sync 禁用
- 扩展 ID：`ikckgaecejfpocchpcflhcmfiblbohnd`
- 安装目录：`D:\Blink-Beta-Acceptance\2026-08-14-blink-0.1.0\installed`

## 1. 发布产物

| 项目 | 结果 |
| --- | --- |
| 文件 | `blink-extension-0.1.0-chrome.zip` |
| 版本 | 0.1.0 / Manifest V3 |
| 大小 | 341369 bytes（333.37 KiB） |
| SHA-256 | `246B422081DDFF3A41D630239C2332ABB716319F7517F5A3F64AC751E26705E3` |
| ZIP 结构 | 16 个文件；`manifest.json` 位于根目录 |
| 权限结构 | 无静态 `host_permissions`；25 个 `optional_host_permissions` |
| 凭据形态扫描 | 未发现 OpenAI、Anthropic 或 Gemini Key 形态匹配 |

## 2. 自动化门槛

| 检查 | 结果 |
| --- | --- |
| `npm test` | 71/71 通过，11 个测试文件 |
| `npm run lint` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run build` | Chrome MV3 生产构建通过，764.39 kB |
| `npm run test:e2e` | 6/6 通过 |
| `npm run zip` | 通过 |

第一次并行 Vitest 进程未正常退出；终止该进程后，单 worker 全量测试通过，最终再次执行默认 `npm test` 也在 4.12 秒内以 71/71 通过，问题未复现。

## 3. 生命周期结果

| 阶段 | 结果 | 证据 |
| --- | --- | --- |
| 首次安装 | 通过 | 从固定解压目录加载 0.0.9 基线；设置页自动打开；Provider 未配置、自定义模式 0/5、站点 0 enabled、无 Errors |
| 首次使用 | 通过 | OpenAI-compatible 测试连接成功；创建 `Beta Marker`；仅授权 ChatGPT；Concise 优化、直接写回和精确 Undo 通过 |
| 本地升级模拟 | 通过 | Chrome 完全退出后，将同一安装目录从 0.0.9 原位覆盖为 0.1.0；16 个文件与候选目录哈希一致 |
| 升级后状态 | 通过 | Provider、`Beta Marker`、Concise 活动模式和 ChatGPT 权限保留；设置页未按首次安装弹出；页面仅一个 Blink；优化与 Undo 通过；无 Errors |
| Reset | 通过 | Provider/API Key、标记模式和站点权限清除；设置恢复默认；已打开 ChatGPT 的 Blink 被移除，刷新后仍不出现；无 Errors |
| Reset 后恢复 | 通过 | 重新配置 Provider、创建 `Uninstall Marker`、授权 ChatGPT 后，优化与 Undo 正常 |
| 卸载 | 通过 | 删除 Blink 后刷新 ChatGPT，页面不再出现 Blink |
| 同路径重装 | 通过 | 重新加载 0.1.0 后设置页自动打开；Provider 未配置、模式 0/5、站点 0 enabled、未就绪且无 Errors |

## 4. 证据边界

- 构建、ZIP、版本、文件清单、逐文件哈希、Chrome 版本、进程隔离和密钥形态扫描由自动化验证。
- `chrome://extensions` 受浏览器控制安全边界限制；加载、版本确认、Errors 检查、Reload、卸载和重装由用户在隔离 Profile 中执行并逐阶段确认。
- API Key、模型输出、登录凭据、Cookie 和浏览器存储均未读取或写入文档。
- 0.0.9 基线与 0.1.0 使用相同代码，只有构建产物 Manifest 版本不同；该步骤验证本地扩展的数据保留和生命周期，不验证 Chrome Web Store 自动分发或跨真实历史版本迁移。

## 5. 结论

Blink 0.1.0 已达到本地 Beta 包的安装、首次使用、本地升级模拟、Reset、卸载和重装门槛。完整发布门槛仍受剩余实站矩阵、外部站点阻塞以及 Anthropic/Gemini 原生协议凭据验证影响。
