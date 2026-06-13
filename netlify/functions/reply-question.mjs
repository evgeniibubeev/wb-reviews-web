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

  const res = await fetch('https://feedbacks-api.wildberries.ru/api/v1/questions', {
    method: 'PATCH',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, wasViewed: true, answer: { text } })
  })

  return { statusCode: res.ok ? 200 : res.status, body: res.ok ? '{}' : await res.text() }
}
