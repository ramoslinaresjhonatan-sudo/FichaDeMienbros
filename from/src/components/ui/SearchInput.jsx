export default function SearchInput({ value, onChange, placeholder, label }) {
  return (
    <label className="search-box">
      <span aria-hidden="true">⌕</span>
      <input type="search" value={value} onChange={onChange} placeholder={placeholder} aria-label={label || placeholder} />
    </label>
  )
}
