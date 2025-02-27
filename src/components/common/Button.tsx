import React, { forwardRef } from 'react'

interface ButtonProps {
  children: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
  fullWidth?: boolean
  id?: string
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  fullWidth = false,
  id,
  ...rest
}, ref) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }
  
  const widthClass = fullWidth ? 'w-full' : ''
  
  const buttonClasses = `
    ${baseClasses} 
    ${variantClasses[variant]} 
    ${sizeClasses[size]} 
    ${widthClass}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    ${className}
  `

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return
    
    if (onClick) {
      // Log click for debugging
      console.log("Button clicked:", id || "unnamed button")
      onClick(e)
    }
  }

  return (
    <button
      ref={ref}
      id={id}
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
