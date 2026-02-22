/**
 * Local LLM runtime. Calls llama.cpp if LLAMA_BIN and MODEL_PATH exist.
 * Otherwise returns null (caller should fall back to heuristics).
 */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const LLAMA_BIN = process.env.LLAMA_BIN
const MODEL_PATH = process.env.MODEL_PATH
const LLAMA_SERVER_URL = process.env.LLAMA_SERVER_URL

function isConfigured() {
  return Boolean(LLAMA_SERVER_URL || (LLAMA_BIN && MODEL_PATH && fs.existsSync(MODEL_PATH)))
}

/**
 * Generate text using local llama.cpp.
 * @param {string} systemPrompt - System instruction
 * @param {string} userPrompt - User input
 * @returns {Promise<string|null>} Generated text or null if not configured / failed
 */
export async function generate(systemPrompt, userPrompt) {
  if (LLAMA_SERVER_URL) {
    try {
      const res = await fetch(`${LLAMA_SERVER_URL}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `<s>[INST] ${systemPrompt}\n\n${userPrompt} [/INST]`,
          n_predict: 1024,
        }),
      })
      if (!res.ok) return null
      const json = await res.json()
      return json.content || null
    } catch (err) {
      console.warn('llama server error:', err?.message)
      return null
    }
  }

  if (!LLAMA_BIN || !MODEL_PATH) return null

  return new Promise((resolve) => {
    const proc = spawn(LLAMA_BIN, ['-m', MODEL_PATH, '-p', `${systemPrompt}\n\n${userPrompt}`, '-n', '1024'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    proc.stdout?.on('data', (d) => { out += d.toString() })
    proc.stderr?.on('data', () => {})
    proc.on('error', () => resolve(null))
    proc.on('close', (code) => resolve(code === 0 && out.trim() ? out.trim() : null))
  })
}

export { isConfigured }
