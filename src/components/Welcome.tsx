import { Icon } from "./Icon";

interface WelcomeProps {
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onOpenWorkspace: () => void;
}

export function Welcome({
  onNewDocument,
  onOpenDocument,
  onOpenWorkspace,
}: WelcomeProps) {
  return (
    <section className="welcome">
      <div className="welcome-paper" aria-hidden="true">
        <span>墨</span>
      </div>
      <p className="eyebrow">LOCAL-FIRST MARKDOWN</p>
      <h1>让文字留在你的电脑里。</h1>
      <p className="welcome-copy">
        InkMark 直接读写普通 Markdown 文件，没有账号、云端副本或专有格式。
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
    </section>
  );
}
