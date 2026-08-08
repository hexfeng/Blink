# Blink 状态与交互图

- 状态：P0 设计基线
- 更新日期：2026-08-06
- 相关文档：[精简 PRD](./PRD.md) · [接口与 Prompt 协议](./PROTOCOLS.md)

## 1. 组件状态图

```mermaid
stateDiagram-v2
    [*] --> Hidden
    Hidden --> Ready: 有效输入框聚焦或已有草稿
    Ready --> Hidden: 输入框消失、禁用或离开视口

    Ready --> MenuOpen: 点击模式箭头
    MenuOpen --> Ready: 选择模式或关闭菜单

    Ready --> Loading: 点击 Blink 且草稿有效
    Ready --> Ready: 空草稿 / 未配置 Provider

    Loading --> Success: 返回有效且草稿未变化
    Loading --> Ready: 返回与原文相同
    Loading --> Error: Provider、网络或格式失败
    Loading --> Recovery: 写回失败且无法自动恢复
    Loading --> Error: 草稿已变化
    Loading --> Hidden: 输入框被移除或页面离开

    Success --> Ready: 点击撤销
    Success --> Ready: 用户编辑、发送或切换会话
    Success --> Hidden: 输入框被移除或页面离开

    Error --> Ready: 提示消失或用户继续操作
    Error --> Hidden: 输入框被移除或页面离开

    Recovery --> Ready: 恢复或复制原文完成
    Recovery --> Hidden: 页面离开
```

状态含义：

| 状态 | UI | 可执行操作 |
| --- | --- | --- |
| Hidden | 不显示 | 无 |
| Ready | `[✦ Blink] [模式⌄]` | 优化、切换模式 |
| MenuOpen | 模式菜单展开 | 选择模式、关闭菜单 |
| Loading | 加载动画，Blink 按钮禁用 | 用户仍可编辑或发送原草稿 |
| Success | 原胶囊切换为 `[✓ 已优化] [撤销]` | 撤销或继续编辑 |
| Error | 短暂错误提示 | 修正设置或重试 |
| Recovery | 持续显示原文恢复卡 | 恢复输入框或复制原文 |

## 2. 正常优化时序

```mermaid
sequenceDiagram
    actor User as 用户
    participant Editor as AI 网站输入框
    participant Content as Content Script
    participant Worker as Service Worker
    participant Provider as BYOK Provider

    User->>Content: 点击 Blink
    Content->>Editor: 读取草稿快照 S0
    Content->>Worker: OPTIMIZE(requestId, S0, modeId)
    Worker->>Worker: 校验消息并读取 Provider / 模式配置
    Worker->>Provider: 发送标准化模型请求
    Provider-->>Worker: 返回 JSON 文本
    Worker->>Worker: 解析并校验 optimized_prompt
    Worker-->>Content: OptimizeSuccess
    Content->>Editor: 再次读取当前草稿 S1
    alt S1 等于 S0
        Content->>Editor: 写入优化结果并同步编辑事件
        Content->>Content: 保存单步撤销数据
        Content-->>User: 原胶囊切换为“✓ 已优化｜撤销”
    else S1 不等于 S0
        Content-->>User: 显示“草稿已变化，请重试”
    end
```

## 3. 撤销时序

```mermaid
sequenceDiagram
    actor User as 用户
    participant Editor as AI 网站输入框
    participant Content as Content Script

    User->>Content: 点击撤销
    Content->>Editor: 读取当前文本
    alt 当前文本等于 Blink 写入结果
        Content->>Editor: 恢复原始草稿并同步编辑事件
        Content->>Content: 清除撤销记录
        Content-->>User: 显示“已撤销”
    else 当前文本已被修改
        Content->>Content: 清除撤销记录
        Content-->>User: 不再显示撤销
    end
```

## 4. 草稿竞争保护

```mermaid
flowchart TD
    A[点击 Blink] --> B[保存草稿快照 S0]
    B --> C[请求 Provider]
    C --> D[收到优化结果]
    D --> E[读取当前草稿 S1]
    E --> F{S1 是否严格等于 S0}
    F -- 是 --> G[写入优化结果]
    F -- 否 --> H[丢弃结果]
    H --> I[提示草稿已变化，请重试]
```

比较使用完整字符串严格相等，不做 trim、标准化换行或模糊匹配。任何用户修改都优先于模型结果。

## 5. 输入框生命周期

```mermaid
flowchart LR
    A[页面进入或 SPA 导航] --> B[站点配置定位候选编辑器]
    B --> C{找到唯一有效编辑器}
    C -- 否 --> D[MutationObserver 等待变化]
    D --> B
    C -- 是 --> E[绑定编辑器并显示 Blink]
    E --> F{编辑器仍连接且可见}
    F -- 是 --> G[更新悬浮位置]
    G --> F
    F -- 否 --> H[解绑并隐藏 Blink]
    H --> B
```

首版只有站点配置和必要的站点专用写回函数，不实现“全网页候选输入框打分器”。

## 6. 设置 Provider

```mermaid
flowchart TD
    A[用户填写 Provider 配置] --> B[校验字段和 URL]
    B --> C{字段是否合法}
    C -- 否 --> D[显示字段错误]
    C -- 是 --> E[请求精确 API Origin 权限]
    E --> F{用户是否授权}
    F -- 否 --> G[不保存并提示需要权限]
    F -- 是 --> H[保存至 storage.local]
    H --> I[显示配置已保存、尚未测试]
    I --> J[用户可点击测试连接]
    J --> K{测试是否成功}
    K -- 否 --> L[保留配置，显示安全错误]
    K -- 是 --> M[标记本次测试成功]
```

保存与测试分离：离线时仍可保存有效配置；测试状态只描述最近一次测试结果，不作为长期可用性保证。

## 7. 关键交互规则

### Blink 胶囊

- 左侧主按钮执行当前模式。
- 右侧箭头只打开模式菜单，不立即优化。
- 胶囊固定在整个 Composer 外框右上方 8px，右边缘与包含发送按钮的完整外框对齐并限制在视口内；Composer 高度变化时保持该相对位置，编辑区内部文字滚动时不漂移。
- 输入框空且失焦时隐藏；聚焦或已有草稿时显示。
- 模式菜单使用键盘可访问：方向键移动、Enter 选择、Escape 关闭。
- 加载期间主按钮和模式选择均禁用，避免请求与模式不一致。
- 成功后不弹出第二个成功框；原胶囊左侧显示图标与“已优化”，右侧只保留“撤销”。
- 成功态不能再次优化或调整模式；撤销、用户编辑、发送或切换会话后回到 Ready。

### 提示消息

- 相同结果和普通错误提示在 4 秒后消失。
- “撤销”在失效前持续显示，不使用自动倒计时。
- 设置类错误提供“打开设置”操作。
- 错误提示不得遮挡原网站的发送、附件或语音按钮。

### 焦点

- 打开模式菜单时焦点进入菜单。
- 关闭菜单后焦点返回 Blink 箭头。
- 优化成功、失败或撤销后，焦点返回原输入框。

## 8. 异常路径

| 事件 | 状态变化 | 处理 |
| --- | --- | --- |
| 请求中用户继续输入 | Loading → Error | 丢弃返回结果，不覆盖草稿 |
| 请求中用户发送消息 | Loading → Hidden/Ready | 丢弃返回结果 |
| 请求中切换会话 | Loading → Hidden | 丢弃返回结果 |
| Provider 返回原文 | Loading → Ready | 提示已经足够清晰，不建立撤销 |
| Provider 返回无效 JSON | Loading → Error | 保留原文，不自动重试 |
| 写回后读回不一致 | Loading → Error/Recovery | 自动恢复原文；恢复仍失败则持续展示可复制原文恢复卡 |
| 优化后用户手动编辑 | Success → Ready | 清除撤销记录 |
| 自定义模式被删除 | 任意非 Loading 状态 → Ready | 回退到自动模式 |
| Provider 配置被清除 | Ready → Ready | 点击时引导打开设置 |

## 9. 人工验收路径

每个支持站点至少执行以下七条：

1. 输入文本 → 自动模式 → 成功替换 → 撤销。
2. 输入冗长文本 → 精简模式 → 结果不长于原文且约束完整。
3. 输入宽泛的分析或研究请求 → 自动模式补充分析维度、证据要求和输出结构，但不虚构事实。
4. 输入复杂文本 → 专业模式形成严谨、可核验的任务结构。
5. 请求期间继续打字 → 返回结果不覆盖新草稿。
6. 优化后手动修改 → 撤销消失。
7. 新建对话或切换会话 → Blink 重新定位且旧撤销失效。
