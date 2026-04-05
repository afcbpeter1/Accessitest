'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapLink from '@tiptap/extension-link'

interface WikiTiptapEditorProps {
  initialHtml: string
  onChange: (html: string) => void
}

export default function WikiTiptapEditor({ initialHtml, onChange }: WikiTiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'nofollow noopener noreferrer',
        },
      }),
    ],
    content: initialHtml || '<p></p>',
    editorProps: {
      attributes: {
        class:
          'min-h-[320px] px-3 py-2 text-[15px] leading-relaxed bg-white border border-[#a2a9b1] rounded-sm focus:outline-none focus:ring-1 focus:ring-[#0645ad] prose max-w-none',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  if (!editor) {
    return (
      <div className="min-h-[320px] border border-[#a2a9b1] rounded-sm bg-white animate-pulse" aria-hidden />
    )
  }

  return (
    <div className="wiki-editor">
      <div className="flex flex-wrap gap-2 mb-2 text-sm">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 border rounded ${editor.isActive('bold') ? 'bg-[#eaf3ff] border-[#0645ad]' : 'bg-white border-[#a2a9b1]'}`}
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 border rounded ${editor.isActive('italic') ? 'bg-[#eaf3ff] border-[#0645ad]' : 'bg-white border-[#a2a9b1]'}`}
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 border rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-[#eaf3ff] border-[#0645ad]' : 'bg-white border-[#a2a9b1]'}`}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 border rounded ${editor.isActive('bulletList') ? 'bg-[#eaf3ff] border-[#0645ad]' : 'bg-white border-[#a2a9b1]'}`}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => {
            const previous = editor.getAttributes('link').href
            const url = window.prompt('Link URL', previous || 'https://')
            if (url === null) return
            if (url === '') {
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
              return
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
          }}
          className="px-2 py-1 border border-[#a2a9b1] rounded bg-white"
        >
          Link
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
