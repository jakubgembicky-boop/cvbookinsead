'use client'

import { useState, KeyboardEvent, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  suggestions?: string[]
  label?: string
}

export function TagInput({ value, onChange, placeholder, suggestions = [], label }: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInput('')
    setShowSuggestions(false)
  }

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((t) => t !== tagToRemove))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className="w-full" ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="min-h-[42px] p-1.5 flex flex-wrap gap-2 rounded-md border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-[#003781] focus-within:border-[#003781]">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-[#f0f4f8] text-[#003781] px-2.5 py-1 rounded-md text-sm font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-[#003781] hover:text-[#001f4d] focus:outline-none"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setShowSuggestions(true)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none border-none focus:ring-0 text-sm px-1 py-1 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      {showSuggestions && input && filteredSuggestions.length > 0 && (
        <div className="relative">
          <ul className="absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 sm:text-sm">
            {filteredSuggestions.map((suggestion) => (
              <li
                key={suggestion}
                onClick={() => addTag(suggestion)}
                className="relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-[#f0f4f8] hover:text-[#003781]"
              >
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
