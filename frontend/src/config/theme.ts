// Modern Green Theme Configuration
export const modernGreenTheme = {
  // Primary green colors
  primary: '#13ae4b',
  primaryDark: '#0f893b',
  primaryLight: '#16c55b',
  accent: '#0bdc84',
  accentDark: '#089860',

  // Supporting green variations
  success: '#039555',
  successLight: '#c4dc34',

  // Background colors
  background: {
    light: '#fafafa',
    dark: '#212121',
  },

  // Surface colors
  surface: {
    primary: '#e5efde',
    secondary: '#ffffff',
    elevated: '#f0f8ec',
    card: '#ffffff',
  },

  // Text colors
  text: {
    primary: '#1a1a1a',
    secondary: '#666666',
    tertiary: '#999999',
    inverse: '#ffffff',
    onSurface: '#2d2d2d',
  },

  // Border colors
  border: {
    primary: '#d1e7d1',
    secondary: '#e0e0e0',
    accent: '#13ae4b',
  },

  // Status colors (keeping existing for warnings/errors)
  status: {
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
  },

  // Waveform channel colors
  waveform: {
    channel1: '#13ae4b', // Primary green
    channel2: '#0bdc84', // Bright accent green
    channel3: '#039555', // Success green
    channel4: '#c4dc34', // Success light (yellow-green)
  },

  // Signal colors for charts
  signal: {
    voltage: '#13ae4b',
    current: '#0bdc8480', // 50% opacity
    acceleration: '#039555',
  },

  // Shadow and elevation
  shadows: {
    small: '0 2px 4px rgba(19, 174, 75, 0.1)',
    medium: '0 4px 8px rgba(19, 174, 75, 0.12)',
    large: '0 8px 16px rgba(19, 174, 75, 0.15)',
    card: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },

  // Interactive states
  hover: {
    primary: '#16c55b',
    surface: '#f0f8ec',
    border: '#13ae4b',
  },

  focus: {
    ring: '#13ae4b40', // 25% opacity
    border: '#13ae4b',
  },

  // Spacing (Material Design inspired)
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },

  // Border radius
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '50%',
  },

  // Transitions
  transitions: {
    fast: '150ms ease-out',
    medium: '250ms ease-out',
    slow: '350ms ease-out',
  },
} as const

// CSS Custom Properties string for injection
export const getCSSVariables = (theme = modernGreenTheme) => {
  return `
    /* Modern Green Theme Variables */
    --color-primary: ${theme.primary};
    --color-primary-dark: ${theme.primaryDark};
    --color-primary-light: ${theme.primaryLight};
    --color-accent: ${theme.accent};
    --color-accent-dark: ${theme.accentDark};
    
    --color-success: ${theme.success};
    --color-success-light: ${theme.successLight};
    --color-danger: ${theme.status.error};
    --color-warning: ${theme.status.warning};
    --color-info: ${theme.status.info};
    
    --color-background-light: ${theme.background.light};
    --color-background-dark: ${theme.background.dark};
    --color-surface-primary: ${theme.surface.primary};
    --color-surface-secondary: ${theme.surface.secondary};
    --color-surface-elevated: ${theme.surface.elevated};
    --color-surface-card: ${theme.surface.card};
    
    --color-text-primary: ${theme.text.primary};
    --color-text-secondary: ${theme.text.secondary};
    --color-text-tertiary: ${theme.text.tertiary};
    --color-text-inverse: ${theme.text.inverse};
    --color-text-on-surface: ${theme.text.onSurface};
    
    --color-border-primary: ${theme.border.primary};
    --color-border-secondary: ${theme.border.secondary};
    --color-border-accent: ${theme.border.accent};
    
    --color-waveform-channel-1: ${theme.waveform.channel1};
    --color-waveform-channel-2: ${theme.waveform.channel2};
    --color-waveform-channel-3: ${theme.waveform.channel3};
    --color-waveform-channel-4: ${theme.waveform.channel4};
    
    --color-signal-voltage: ${theme.signal.voltage};
    --color-signal-current: ${theme.signal.current};
    --color-signal-acceleration: ${theme.signal.acceleration};
    
    --color-hover-primary: ${theme.hover.primary};
    --color-hover-surface: ${theme.hover.surface};
    --color-hover-border: ${theme.hover.border};
    
    --color-focus-ring: ${theme.focus.ring};
    --color-focus-border: ${theme.focus.border};
    
    --shadow-small: ${theme.shadows.small};
    --shadow-medium: ${theme.shadows.medium};
    --shadow-large: ${theme.shadows.large};
    --shadow-card: ${theme.shadows.card};
    
    --spacing-xs: ${theme.spacing.xs};
    --spacing-sm: ${theme.spacing.sm};
    --spacing-md: ${theme.spacing.md};
    --spacing-lg: ${theme.spacing.lg};
    --spacing-xl: ${theme.spacing.xl};
    --spacing-xxl: ${theme.spacing.xxl};
    
    --border-radius-sm: ${theme.borderRadius.sm};
    --border-radius-md: ${theme.borderRadius.md};
    --border-radius-lg: ${theme.borderRadius.lg};
    --border-radius-xl: ${theme.borderRadius.xl};
    --border-radius-full: ${theme.borderRadius.full};
    
    --transition-fast: ${theme.transitions.fast};
    --transition-medium: ${theme.transitions.medium};
    --transition-slow: ${theme.transitions.slow};
    
    /* Legacy compatibility */
    --color-dark: ${theme.text.primary};
    --color-light: ${theme.background.light};
    --color-white: ${theme.surface.secondary};
    --color-black: ${theme.text.primary};
    --color-secondary: ${theme.text.secondary};
    --border-radius: ${theme.borderRadius.sm};
    --transition-speed: 250ms;
  `
}

// Type definitions for theme customization
export type ThemeColors = typeof modernGreenTheme
export type WaveformColors = typeof modernGreenTheme.waveform
