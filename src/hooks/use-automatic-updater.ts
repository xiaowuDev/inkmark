import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { useEffect, useRef, useState } from "react";

const INITIAL_CHECK_DELAY_MS = 1_200;
const UPDATE_TIMEOUT_MS = 20_000;

export type UpdatePhase =
  "idle" | "checking" | "downloading" | "installing" | "postponed" | "error";

export interface AutomaticUpdateState {
  message: string | null;
  phase: UpdatePhase;
}

interface UseAutomaticUpdaterOptions {
  canRelaunch: boolean;
}

interface UpdateLifecycle {
  isCancelled: boolean;
}

const IDLE_STATE: AutomaticUpdateState = {
  message: null,
  phase: "idle",
};

function isLifecycleActive(lifecycle: UpdateLifecycle): boolean {
  return !lifecycle.isCancelled;
}

function downloadMessage(
  event: DownloadEvent,
  downloadedBytes: number,
): { downloadedBytes: number; message: string } {
  if (event.event === "Started") {
    return {
      downloadedBytes: 0,
      message: "正在下载更新…",
    };
  }

  if (event.event === "Progress") {
    const nextDownloadedBytes = downloadedBytes + event.data.chunkLength;
    return {
      downloadedBytes: nextDownloadedBytes,
      message: `正在下载更新 ${String(
        Math.max(1, Math.round(nextDownloadedBytes / 1024 / 1024)),
      )} MB`,
    };
  }

  return {
    downloadedBytes,
    message: "正在安装更新…",
  };
}

export function useAutomaticUpdater({
  canRelaunch,
}: UseAutomaticUpdaterOptions): AutomaticUpdateState {
  const [state, setState] = useState<AutomaticUpdateState>(IDLE_STATE);
  const canRelaunchRef = useRef(canRelaunch);

  useEffect(() => {
    canRelaunchRef.current = canRelaunch;
  }, [canRelaunch]);

  useEffect(() => {
    if (import.meta.env.DEV || !isTauri()) {
      return;
    }

    const lifecycle = { isCancelled: false };
    const checkForUpdate = async () => {
      setState({ message: "正在检查更新…", phase: "checking" });

      try {
        const update = await check({ timeout: UPDATE_TIMEOUT_MS });
        if (lifecycle.isCancelled) {
          await update?.close();
          return;
        }

        if (!update) {
          setState(IDLE_STATE);
          return;
        }

        if (!canRelaunchRef.current) {
          const availableVersion = update.version;
          await update.close();
          setState({
            message: `新版本 ${availableVersion} 将在下次启动时自动安装`,
            phase: "postponed",
          });
          return;
        }

        let downloadedBytes = 0;
        setState({ message: "正在下载更新…", phase: "downloading" });
        await update.downloadAndInstall((event) => {
          if (lifecycle.isCancelled) {
            return;
          }

          const progress = downloadMessage(event, downloadedBytes);
          downloadedBytes = progress.downloadedBytes;
          setState({
            message: progress.message,
            phase: event.event === "Finished" ? "installing" : "downloading",
          });
        });

        if (isLifecycleActive(lifecycle)) {
          setState({ message: "更新完成，正在重新启动…", phase: "installing" });
          await relaunch();
        }
      } catch {
        if (isLifecycleActive(lifecycle)) {
          setState({
            message: "自动更新暂时不可用，将在下次启动时重试",
            phase: "error",
          });
        }
      }
    };

    const timer = window.setTimeout(() => {
      void checkForUpdate();
    }, INITIAL_CHECK_DELAY_MS);

    return () => {
      lifecycle.isCancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return state;
}
