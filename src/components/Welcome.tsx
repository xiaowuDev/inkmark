import type { Workspace } from "../domain";
import { Icon } from "./Icon";

interface WelcomeProps {
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onOpenRecentWorkspace: (workspace: Workspace) => void;
  onOpenWorkspace: () => void;
  recentWorkspaces: readonly Workspace[];
}

export function Welcome({
  onNewDocument,
  onOpenDocument,
  onOpenRecentWorkspace,
  onOpenWorkspace,
  recentWorkspaces,
}: WelcomeProps) {
  return (
    <section className="welcome">
      <div className="welcome-paper" aria-hidden="true">
        <span>墨</span>
      </div>
      <p className="eyebrow">LOCAL-FIRST MARKDOWN</p>
      <h1>让文字留在你的电脑里。</h1>
      <p className="welcome-copy">
        InkMark 直接读写普通 Markdown 文件；写作保持本地，DeepSeek
        助手只在你启用时读取工作区。
      </p>
      <div className="welcome-actions">
        <button
          className="primary-button"
          onClick={onNewDocument}
          type="button"
        >
          <Icon name="new" />
          新建文稿
        </button>
        <button
          className="secondary-button"
          onClick={onOpenWorkspace}
          type="button"
        >
          <Icon name="folderOpen" />
          打开工作区
        </button>
      </div>
      <button className="welcome-link" onClick={onOpenDocument} type="button">
        或打开单个 Markdown 文件
      </button>
      {recentWorkspaces.length > 0 ? (
        <div className="recent-workspaces">
          <span className="eyebrow">最近的工作区</span>
          <div>
            {recentWorkspaces.map((workspace) => (
              <button
                key={workspace.rootPath}
                onClick={() => {
                  onOpenRecentWorkspace(workspace);
                }}
                title={workspace.rootPath}
                type="button"
              >
                <Icon name="folder" />
                <span>
                  <strong>{workspace.rootName}</strong>
                  <small>{workspace.rootPath}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
