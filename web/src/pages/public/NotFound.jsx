export default function NotFound() {
  return (
    <div style={{ padding: 24, fontFamily: 'var(--d-font-sans)' }}>
      <h1>404</h1>
      <p>Page not found.</p>
      <p>
        <a href="/">Home</a> · <a href="/admin/dashboard">Admin Dashboard</a> ·{' '}
        <a href="/gallery">Gallery</a>
      </p>
    </div>
  )
}
