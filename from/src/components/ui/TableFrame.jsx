export default function TableFrame({ children, className = '' }) {
  return <div className={`church-table-wrap ${className}`.trim()}>{children}</div>
}
