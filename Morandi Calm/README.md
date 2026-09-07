# Morandi Calm 2.3.10

一套依据参考图重构的 Obsidian 莫兰迪主题系统：低饱和色板、悬浮编辑器、磨砂侧栏、网格纸、柔和 Mermaid、表格与常用插件适配。

## 已实现

- 奶油砂岩、雾蓝石板、灰粉丁香、鼠尾草绿四套浅深配套色板
- 中央悬浮编辑器与磨砂左右侧栏
- 几何轨道、寂静地平线、雾海群岛、静谧阶台、庭院枝影、纸上云境六种图片背景，以及纯色回退
- 细密网格纸与暖纸张/石墨材质
- 文件树彩色层级标记与当前文件胶囊高亮
- 标题块、Callout、表格、代码、标签、属性、嵌入笔记
- Mermaid 节点、连线、子图与外层卡片
- Canvas、Graph、Dataview、Kanban、Calendar、Excalidraw 和聊天面板基础适配
- 小屏幕回退、键盘焦点和减少动态效果支持

## 安装主题

将整个 `Morandi Calm` 文件夹复制到：

```text
你的仓库/.obsidian/themes/Morandi Calm/
```

确保该文件夹中直接包含：

```text
manifest.json
theme.css
assets/
assets/fonts/
```

然后在 Obsidian 中执行：

1. 设置 → 外观。
2. 在主题中选择 `Morandi Calm`。
3. 如果已经打开 Obsidian，执行“重新加载应用”命令。

## 配色和背景切换

有两种方式：

1. 安装同包提供的 `Morandi Companion`，在插件设置中切换配色、背景和时钟。
2. 安装社区插件 `Style Settings`，它会读取 `theme.css` 顶部的设置定义。

两者都不安装时，主题会使用默认奶油砂岩配色、几何轨道背景、悬浮编辑器和网格纸。

## 安装可选时钟

将 `Morandi Companion` 文件夹复制到：

```text
你的仓库/.obsidian/plugins/morandi-companion/
```

在设置 → 第三方插件中启用 `Morandi Companion`。插件会在左侧栏创建动态模拟时钟，并提供完整主题设置。

## 示例笔记

将 `demo/快速开始.md` 复制到仓库任意位置并用阅读视图打开，可检查标题、Mermaid、Callout、表格、代码和任务列表的效果。

## 说明

- macOS 红黄绿窗口按钮由操作系统提供，不属于主题资源。
- Claude 或其他聊天内容需要对应插件；本主题负责视觉适配，不提供聊天功能。
- 背景素材为原创 SVG，可以通过设置关闭。
