export function Field({ label, name, type = 'text', className = '', ...props }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}{props.required && <b className="required"> *</b>}</span>
      <input name={name} type={type} {...props} />
    </label>
  )
}

export function NameField(props) {
  return <Field {...props} data-person-name onInput={(event) => event.currentTarget.setCustomValidity('')} />
}

export function IdentityField(props) {
  return (
    <Field
      {...props}
      inputMode="numeric"
      pattern="[0-9]*"
      title="Ingrese solo números"
      onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, '') }}
    />
  )
}
