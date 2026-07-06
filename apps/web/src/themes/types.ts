export type ThemePreset = 'brutalist' | 'neumorphic' | 'soft-ui' | 'saas' | 'custom';

export type ThemeMode = 'light' | 'dark';

export interface ThemeSettings {
  preset: ThemePreset;
  mode: ThemeMode;
  customTokens?: Partial<Record<string, string>>;
  brandColor?: string;
  fonts?: {
    display?: string;
    body?: string;
    mono?: string;
  };
}
