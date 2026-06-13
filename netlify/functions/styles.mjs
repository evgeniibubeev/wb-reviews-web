export const handler = async () => {
  const token = process.env.WB_TOKEN
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'WB_TOKEN не задан' }) }

  const res = await fetch(
    'https://feedbacks-api.wildberries.ru/api/v1/feedbacks?isAnswered=true&take=100&skip=0&order=dateDesc',
    { headers: { Authorization: token } }
  )

  if (res.status === 429) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit — подождите минуту' }) }
  }
  if (!res.ok) {
    const body = await res.text()
    return { statusCode: res.status, body: JSON.stringify({ error: body }) }
  }

  const data = await res.json()
  const items = (data.data?.feedbacks || [])
    .filter(f => f.text && f.answer?.text && f.answer.text.length > 10)

  // До 3 примеров на каждую оценку
  const byStars = {}
  for (const f of items) {
    const s = f.productValuation || 0
    if (!byStars[s]) byStars[s] = []
    if (byStars[s].length < 3) byStars[s].push({
      stars:      s,
      product:    f.productDetails?.productName || '',
      reviewText: f.text.slice(0, 300),
      answerText: f.answer.text.slice(0, 500),
    })
  }

  const examples = Object.values(byStars).flat()

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examples, total: items.length })
  }
}
