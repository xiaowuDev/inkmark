import { memo } from "react";

import type { EditorTab } from "../domain";
import { Icon } from "./Icon";

interface EditorTabsProps {
  activeTabId: string | null;
  tabs: readonly EditorTab[];
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

export const EditorTabs = memo(function EditorTabs({
  activeTabId,
  tabs,
  onActivate,
  onClose,
}: EditorTabsProps) {
  return (
    <div className="editor-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          aria-selected={activeTabId === tab.id}
          className={`editor-tab ${activeTabId === tab.id ? "is-active" : ""}`}
          key={tab.id}
          onClick={() => {
            onActivate(tab.id);
          }}
          role="tab"
          type="button"
        >
          <span
            className={`tab-state ${
              tab.saveState === "error" ? "has-error" : ""
            }`}
          >
            {tab.isDirty ? "●" : ""}
          </span>
          <span className="tab-name">{tab.name}</span>
          <span
            aria-label={`关闭 ${tab.name}`}
            className="tab-close"
            onClick={(event) => {
              event.stopPropagation();
              onClose(tab.id);
            }}
            role="button"
            tabIndex={0}
          >
            <Icon name="close" />
          </span>
        </button>
      ))}
    </div>
  );
});
