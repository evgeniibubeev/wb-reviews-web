export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' }

  const token = process.env.WB_TOKEN
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'WB_TOKEN не задан' }) }

  let id, text
  try {
    ;({ id, text } = JSON.parse(event.body))
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Неверный формат запроса' }) }
  }

  const res = await fetch('https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer', {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, text })
  })

  if (res.status === 429) {
    console.error('[reply] Rate limit 429 | id:', id)
    return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit WB — подождите минуту' }) }
  }

  const ok = res.status === 204 || res.ok
  const body = res.status === 204 ? '{}' : await res.text()

  if (!ok) console.error('[reply] WB error', res.status, body, '| id:', id)
  else console.log('[reply] OK', res.status, '| id:', id)

  return { statusCode: ok ? 200 : res.status, body: ok ? body : JSON.stringify({ error: 'Ошибка WB: ' + res.status }) }
}
