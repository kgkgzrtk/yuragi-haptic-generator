import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
  loading?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled,
  className = '',
  ...props
}) => {
  const buttonClasses = [
    'button',
    `button-${variant}`,
    `button-${size}`,
    loading ? 'button-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  // Preserve original label when loading
  const ariaLabel = loading && typeof children === 'string' ? children : props['aria-label']

  return (
    <button
      className={buttonClasses}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-label={ariaLabel}
      {...props}
    >
      {loading ? (
        <>
          <span className='button-spinner' aria-hidden='true' />
          <span className='sr-only'>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

export default Button
