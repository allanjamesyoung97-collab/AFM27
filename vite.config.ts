import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { rename, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const playerAttributeKeys = new Set([
  'kicking', 'handball', 'marking', 'goalSense', 'tackling', 'spoiling',
  'speed', 'acceleration', 'agility', 'endurance', 'strength', 'verticalLeap',
  'vision', 'decisionMaking', 'positioning', 'composure', 'leadership', 'creativity',
  'workRate', 'professionalism', 'determination', 'teamwork', 'competitiveness',
])

function developerPlayerAttributeWriter(enabled: boolean): Plugin {
  const dataFile = fileURLToPath(new URL('./src/data/playerAttributeOverrides.json', import.meta.url))

  return {
    name: 'developer-player-attribute-writer',
    apply: 'serve',
    configureServer(server) {
      // This file-writing endpoint is opt-in because preview servers can be
      // reachable by other people. Enable only in a trusted development project.
      if (!enabled) return
      server.middlewares.use('/__dev/player-attributes', (request, response, next) => {
        if (request.method !== 'PUT') return next()

        const host = request.headers.host
        const origin = request.headers.origin
        if (!origin || !host) {
          response.writeHead(403, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ error: 'A same-origin request is required.' }))
          return
        }
        try {
          if (new URL(origin).host !== host) {
            response.writeHead(403, { 'Content-Type': 'application/json' })
            response.end(JSON.stringify({ error: 'Cross-origin saves are not allowed.' }))
            return
          }
        } catch {
          response.writeHead(403, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ error: 'Invalid request origin.' }))
          return
        }

        let body = ''
        request.on('data', (chunk) => {
          body += chunk
          if (body.length > 2_000_000) request.destroy()
        })
        request.on('end', async () => {
          try {
            const parsed = JSON.parse(body) as Record<string, unknown>
            if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Expected an object of player overrides.')
            const sanitized: Record<string, { attributes: Record<string, number>; overall?: number }> = {}
            for (const [id, entry] of Object.entries(parsed)) {
              if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue
              const playerEntry = entry as Record<string, unknown>
              const attributes: Record<string, number> = {}
              const playerAttributes = playerEntry.attributes && typeof playerEntry.attributes === 'object' && !Array.isArray(playerEntry.attributes)
                ? playerEntry.attributes as Record<string, unknown>
                : {}
              for (const [attribute, value] of Object.entries(playerAttributes)) {
                const rating = Number(value)
                if (playerAttributeKeys.has(attribute) && Number.isInteger(rating) && rating >= 1 && rating <= 99) attributes[attribute] = rating
              }
              const overall = Number(playerEntry.overall)
              if (Object.keys(attributes).length) {
                sanitized[id] = {
                  attributes,
                  ...(Number.isInteger(overall) && overall >= 1 && overall <= 99 ? { overall } : {}),
                }
              }
            }

            const temporaryFile = `${dataFile}.tmp`
            await writeFile(temporaryFile, `${JSON.stringify(sanitized, null, 2)}\n`, 'utf8')
            await rename(temporaryFile, dataFile)
            response.writeHead(200, { 'Content-Type': 'application/json' })
            response.end(JSON.stringify({ savedPlayers: Object.keys(sanitized).length }))
          } catch (error) {
            response.writeHead(400, { 'Content-Type': 'application/json' })
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Could not save player attributes.' }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), developerPlayerAttributeWriter(env.AFM_ENABLE_PLAYER_ATTRIBUTE_WRITER === 'true')],
    server: {
      host: '0.0.0.0',
    },
  }
})
