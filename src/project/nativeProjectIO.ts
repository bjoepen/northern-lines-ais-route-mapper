import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

const NLROUTE_FILTER = [{ name: 'Northern Lines Route', extensions: ['nlroute'] }];

type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

export interface NativeProjectOpenResult {
  path: string;
  contents: string;
}

export function hasNativeProjectIO(): boolean {
  return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

export async function openNativeProject(): Promise<NativeProjectOpenResult | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: NLROUTE_FILTER,
  });

  if (!selected || Array.isArray(selected)) return null;

  const contents = await readTextFile(selected);
  return { path: selected, contents };
}

export async function saveNativeProject(
  contents: string,
  suggestedFileName: string,
  currentPath: string | null,
  saveAs = false,
): Promise<string | null> {
  let targetPath = currentPath;

  if (saveAs || !targetPath) {
    targetPath = await save({
      defaultPath: currentPath ?? suggestedFileName,
      filters: NLROUTE_FILTER,
    });
  }

  if (!targetPath) return null;

  await writeTextFile(targetPath, contents);
  return targetPath;
}
