export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' }

  const apiKey  = process.env.ANTHROPIC_API_KEY
  const wbToken = process.env.WB_TOKEN
  if (!apiKey)  return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY не задан' }) }
  if (!wbToken) return { statusCode: 500, body: JSON.stringify({ error: 'WB_TOKEN не задан' }) }

  let nmId
  try { ;({ nmId } = JSON.parse(event.body)) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Неверный формат запроса' }) }
  }

  const url = nmId
    ? `https://feedbacks-api.wildberries.ru/api/v1/feedbacks?isAnswered=true&take=100&skip=0&nmId=${nmId}&order=dateDesc`
    : `https://feedbacks-api.wildberries.ru/api/v1/feedbacks?isAnswered=true&take=100&skip=0&order=dateDesc`

  const wbRes = await fetch(url, { headers: { Authorization: wbToken } })

  if (wbRes.status === 429) return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit WB — подождите минуту' }) }
  if (!wbRes.ok) return { statusCode: wbRes.status, body: JSON.stringify({ error: await wbRes.text() }) }

  const data    = await wbRes.json()
  const reviews = data.data?.feedbacks || []

  if (reviews.length === 0) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis: 'Отзывов по этому артикулу не найдено.', count: 0, product: '' })
    }
  }

  const product = reviews[0]?.productDetails?.productName || (nmId ? `Артикул ${nmId}` : 'Все товары')

  const avgRating = (reviews.reduce((s, r) => s + (r.productValuation || 0), 0) / reviews.length).toFixed(1)

  const reviewLines = reviews
    .filter(r => r.text)
    .slice(0, 80)
    .map(r => `${r.productValuation}⭐: "${r.text.slice(0, 200)}"`)
    .join('\n')

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content:
          `Проанализируй ${reviews.length} отзывов на товар "${product}" (средняя оценка ${avgRating}/5) ` +
          `на Wildberries и дай конкретные рекомендации продавцу.\n\n` +
          `Отзывы:\n${reviewLines}\n\n` +
          `Ответь строго в таком формате (используй именно эти заголовки):\n\n` +
          `## Основные жалобы\n- пункт 1\n- пункт 2\n- пункт 3\n\n` +
          `## Что хвалят\n- пункт 1\n- пункт 2\n- пункт 3\n\n` +
          `## Рекомендации по улучшению\n- пункт 1\n- пункт 2\n- пункт 3\n- пункт 4\n\n` +
          `## Что улучшить в описании товара\n- пункт 1\n- пункт 2\n\n` +
          `Будь конкретным. Не добавляй вводных фраз.`
      }]
    })
  })

  if (!claudeRes.ok) {
    const err = await claudeRes.text()
    return { statusCode: claudeRes.status, body: JSON.stringify({ error: err }) }
  }

  const claudeData = await claudeRes.json()
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      analysis: claudeData.content[0].text.trim(),
      count: reviews.length,
      product,
      avgRating
    })
  }
}
