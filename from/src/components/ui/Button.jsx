import { forwardRef } from 'react'

const Button = forwardRef(function Button({
  children,
  className = '',
  type = 'button',
  variant = 'primary',
  ...props
}, ref) {
  const variantClass = variant === 'primary' ? 'admin-primary' : variant === 'secondary' ? 'secondary' : ''
  return <button ref={ref} type={type} className={[variantClass, className].filter(Boolean).join(' ')} {...props}>{children}</button>
})

export default Button
