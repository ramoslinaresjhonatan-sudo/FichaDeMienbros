export default function Alert({ children, className = 'church-error', role = 'alert' }) {
  if (!children) return null
  return <p className={className} role={role}>{children}</p>
}
