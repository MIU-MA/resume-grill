'use client'

import { useEffect, useRef, useState } from 'react'

type RecognitionResultEvent = Event & {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: {
      transcript: string
    }
  }>
}

type RecognitionErrorEvent = Event & {
  error: string
}

type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: RecognitionResultEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

type RecognitionConstructor = new () => Recognition

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
}

type Options = {
  onFinalTranscript: (text: string) => void
  onError?: (message: string) => void
}

export function useSpeechInput({ onFinalTranscript, onError }: Options) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [interimText, setInterimText] = useState('')

  const recognitionRef = useRef<Recognition | null>(null)
  const onFinalTranscriptRef = useRef(onFinalTranscript)
  const onErrorRef = useRef(onError)

  onFinalTranscriptRef.current = onFinalTranscript
  onErrorRef.current = onError

  useEffect(() => {
    const Constructor =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition

    setSupported(Boolean(Constructor))

    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const start = () => {
    const Constructor =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition

    if (!Constructor) {
      onErrorRef.current?.('当前浏览器不支持语音输入。')
      return
    }

    recognitionRef.current?.abort()

    const recognition = new Constructor()

    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index]
        const transcript = result[0].transcript

        if (result.isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      setInterimText(interim.trim())

      if (final.trim()) {
        onFinalTranscriptRef.current(final.trim())
        setInterimText('')
      }
    }

    recognition.onerror = (event) => {
      setListening(false)

      const messages: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝，请在浏览器中允许访问。',
        'audio-capture': '没有检测到可用的麦克风。',
        'no-speech': '没有检测到语音，请重新尝试。',
        network: '语音识别服务暂时不可用。',
      }

      onErrorRef.current?.(
        messages[event.error] || '语音识别失败，请重新尝试。',
      )
    }

    recognition.onend = () => {
      setListening(false)
      setInterimText('')
      recognitionRef.current = null
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
      onErrorRef.current?.('无法启动语音识别。')
    }
  }

  const stop = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  return {
    supported,
    listening,
    interimText,
    start,
    stop,
  }
}
