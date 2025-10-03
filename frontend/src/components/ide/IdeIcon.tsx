import { Code2 } from 'lucide-react';
import { EditorType, ThemeMode } from 'shared/types';
import { useTheme } from '@/components/theme-provider';

type IdeIconProps = {
  editorType?: EditorType | null;
  className?: string;
};

function getResolvedTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === ThemeMode.SYSTEM) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme === ThemeMode.DARK ? 'dark' : 'light';
}

export function IdeIcon({ editorType, className = 'h-4 w-4' }: IdeIconProps) {
  const { theme } = useTheme();
  const resolvedTheme = getResolvedTheme(theme);

  if (editorType === EditorType.VS_CODE) {
    const vscodeIcon =
      resolvedTheme === 'dark'
        ? '/ide/vscode-dark.svg'
        : '/ide/vscode-light.svg';

    return <img src={vscodeIcon} alt="VS Code" className={className} />;
  }

  if (editorType === EditorType.CURSOR) {
    const cursorIcon =
      resolvedTheme === 'dark'
        ? '/ide/cursor-dark.svg' // dark
        : '/ide/cursor-light.svg'; // light

    return <img src={cursorIcon} alt="Cursor" className={className} />;
  }

  if (editorType === EditorType.WINDSURF) {
    const windsurfIcon =
      resolvedTheme === 'dark'
        ? '/ide/windsurf-dark.svg'
        : '/ide/windsurf-light.svg';

    return <img src={windsurfIcon} alt="Windsurf" className={className} />;
  }

  if (editorType === EditorType.INTELLI_J) {
    return <img src="/ide/intellij.svg" alt="IntelliJ IDEA" className={className} />;
  }

  if (editorType === EditorType.ZED) {
    const zedIcon =
      resolvedTheme === 'dark'
        ? '/ide/zed-dark.svg'
        : '/ide/zed-light.svg';

    return <img src={zedIcon} alt="Zed" className={className} />;
  }

  // Generic fallback for other IDEs or no IDE configured
  return <Code2 className={className} />;
}
