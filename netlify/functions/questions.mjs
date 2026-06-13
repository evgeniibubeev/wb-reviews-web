export const handler = async () => {
  const token = process.env.WB_TOKEN
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'WB_TOKEN не задан' }) }

  const res = await fetch(
    'https://feedbacks-api.wildberries.ru/api/v1/questions?isAnswered=false&take=50&skip=0&order=dateDesc',
    { headers: { Authorization: token } }
  )

  if (res.status === 429) return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit WB — подождите минуту' }) }
  if (!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: await res.text() }) }

  const data = await res.json()
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data.data?.questions || [])
  }
}
