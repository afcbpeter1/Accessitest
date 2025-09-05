interface LoadingSpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  return (
    <div className="flex items-center justify-center" role="status" aria-live="polite">
      <div className={`animate-spin rounded-full border-b-2 border-[#0B1220] ${sizeClasses[size]}`}></div>
      <span className="sr-only">{message}</span>
      {message && <span className="ml-2 text-sm text-gray-600">{message}</span>}
    </div>
  )
}
