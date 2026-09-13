import { invoke, isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

const NLROUTE_FILTER = [{ name: 'Northern Lines Route', extensions: ['nlroute'] }];

export interface NativeProjectOpenResult {
  path: string;
  contents: string;
}

export function hasNativeProjectIO(): boolean {
  return isTauri();
}

export async function openNativeProject(): Promise<NativeProjectOpenResult | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: NLROUTE_FILTER,
  });

  if (!selected || Array.isArray(selected)) return null;

  const contents = await invoke<string>('read_project_file', { path: selected });
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

  await invoke('write_project_file', { path: targetPath, contents });
  return targetPath;
}
