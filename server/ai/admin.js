/**
 * Admin Train pipeline: upload video, transcribe, build memory.
 * Train selection: Creator | Interviewer | Both.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { transcribe } from './runtime/whisperRuntime.js'
import { appendCreatorMemory, appendInterviewerMemory } from '../storage/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, '../data/uploads')
const TRANSCRIPTS_DIR = path.join(__dirname, '../data/transcripts')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

ensureDir(UPLOADS_DIR)
ensureDir(TRANSCRIPTS_DIR)

export function getUploadPath(uploadId) {
  return path.join(UPLOADS_DIR, uploadId)
}

/**
 * Transcribe uploaded file. Returns { transcript, mockTranscript }.
 */
export async function runTranscribe(uploadId) {
  const videoPath = getUploadPath(uploadId)
  const result = await transcribe(videoPath)
  const transcript = typeof result === 'object' ? result.transcript : result
  const transcriptPath = path.join(TRANSCRIPTS_DIR, `${uploadId}.txt`)
  ensureDir(TRANSCRIPTS_DIR)
  fs.writeFileSync(transcriptPath, transcript, 'utf-8')
  return { transcript, mockTranscript: result.mockTranscript === true }
}

/**
 * Build memory from transcripts.
 * @param {'creator'|'interviewer'|'both'} trainTarget
 */
export function buildMemory(trainTarget = 'both') {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) return { ok: true, chunks: 0 }
  const files = fs.readdirSync(TRANSCRIPTS_DIR).filter((f) => f.endsWith('.txt'))
  const chunkSize = 500
  let chunks = 0

  const doCreator = trainTarget === 'creator' || trainTarget === 'both'
  const doInterviewer = trainTarget === 'interviewer' || trainTarget === 'both'

  for (const f of files) {
    const text = fs.readFileSync(path.join(TRANSCRIPTS_DIR, f), 'utf-8')
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize).trim()
      if (chunk.length > 50) {
        if (doCreator) appendCreatorMemory(chunk)
        if (doInterviewer) appendInterviewerMemory(chunk)
        chunks++
      }
    }
  }
  return { ok: true, chunks }
}
