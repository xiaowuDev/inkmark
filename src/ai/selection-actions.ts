/** 编辑器选中片段后可执行的 AI 快捷动作。 */
export interface SelectionAction {
  key: string;
  label: string;
  prompt: string;
  /** 结果是正文改写，可以直接覆盖选中内容。 */
  replaces: boolean;
}

export const SELECTION_ACTIONS: readonly SelectionAction[] = [
  {
    key: "explain",
    label: "解释",
    prompt:
      "解释选中片段讲的技术和内容：它解决什么问题、关键概念怎么理解、有哪些容易踩的坑。必要时结合工作区其他文稿佐证。",
    replaces: false,
  },
  {
    key: "polish",
    label: "润色",
    prompt:
      "润色选中片段：保持原意和 Markdown 结构，让表达更清晰专业，去掉啰嗦。只输出改写后的正文。",
    replaces: true,
  },
  {
    key: "expand",
    label: "扩写",
    prompt:
      "把选中片段展开写详细：补充必要的背景、步骤或示例，保持原有 Markdown 结构。只输出改写后的正文。",
    replaces: true,
  },
  {
    key: "condense",
    label: "精简",
    prompt:
      "把选中片段压缩到要点，保留全部关键信息和 Markdown 结构。只输出改写后的正文。",
    replaces: true,
  },
  {
    key: "translate",
    label: "翻译",
    prompt:
      "翻译选中片段：中文译成英文，其他语言译成中文，保留 Markdown 结构与代码。只输出译文。",
    replaces: true,
  },
];
