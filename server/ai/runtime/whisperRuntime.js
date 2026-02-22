/**
 * Local transcription runtime. Calls whisper.cpp if WHISPER_BIN exists.
 * Otherwise returns a mocked transcript and { mockTranscript: true }.
 */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const WHISPER_BIN = process.env.WHISPER_BIN
const WHISPER_MODEL = process.env.WHISPER_MODEL

const MOCK_TRANSCRIPT = `This is a mock transcript. Whisper is not configured.
Set WHISPER_BIN and optionally WHISPER_MODEL to use real transcription.
Functional Requirements: Users should be able to upload images. Users should be able to search by keyword. The system must support 1 million daily active users.
Non-Functional Requirements: Latency under 200ms for read operations. High availability 99.9% uptime.`

function isConfigured() {
  return Boolean(WHISPER_BIN)
}

/**
 * Transcribe a video/audio file.
 * @param {string} videoPath - Absolute path to video/audio file
 * @returns {Promise<{ transcript: string, mockTranscript?: boolean }>}
 */
export async function transcribe(videoPath) {
  if (!WHISPER_BIN || !videoPath || !fs.existsSync(videoPath)) {
    console.warn('[whisperRuntime] Whisper not configured or file missing. Returning mock transcript.')
    return { transcript: MOCK_TRANSCRIPT, mockTranscript: true }
  }

  return new Promise((resolve) => {
    const args = ['-m', WHISPER_MODEL || 'ggml-base.bin', '-f', videoPath]
    const proc = spawn(WHISPER_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    proc.stdout?.on('data', (d) => { out += d.toString() })
    proc.stderr?.on('data', () => {})
    proc.on('error', () => resolve({ transcript: '(transcription failed)', mockTranscript: false }))
    proc.on('close', (code) => {
      const text = code === 0 && out.trim() ? out.trim() : '(transcription produced no output)'
      resolve({ transcript: text, mockTranscript: false })
    })
  })
}

export { isConfigured }
