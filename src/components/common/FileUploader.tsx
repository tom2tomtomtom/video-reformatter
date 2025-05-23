import React, { useRef, useState } from 'react'

interface FileUploaderProps {
  onFileSelected: (file: File) => void
  accept: string
  label: string
  className?: string
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelected,
  accept,
  label,
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [filename, setFilename] = useState<string | null>(null)
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFilename(file.name)
      onFileSelected(file)
    }
  }
  
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }
  
  return (
    <div className={`text-center ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={triggerFileInput}
        type="button"
        className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full"
      >
        {label}
      </button>
      
      {filename && (
        <p className="mt-2 text-sm text-gray-700">
          Selected: {filename}
        </p>
      )}
    </div>
  )
}

export default FileUploader

