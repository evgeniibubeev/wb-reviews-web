export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY не задан' }) }

  let review
  try {
    ;({ review } = JSON.parse(event.body))
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Неверный формат запроса' }) }
  }

  const stars   = review.productValuation || 0
  const text    = review.text || '(без текста)'
  const product = review.productDetails?.productName || 'товар'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content:
          `Ты менеджер магазина на Wildberries. Напиши ответ на отзыв покупателя.\n\n` +
          `Товар: ${product}\nОценка: ${stars}/5 ⭐\nОтзыв: "${text}"\n\n` +
          `Правила:\n` +
          `- Обращение на "Вы", вежливо и по делу\n` +
          `- 2–3 предложения, не больше\n` +
          `- 1–2 ⭐: выразить сожаление, попросить написать в чат поддержки для решения вопроса\n` +
          `- 3 ⭐: поблагодарить за обратную связь, учтём пожелания\n` +
          `- 4–5 ⭐: поблагодарить, пригласить снова\n` +
          `- Только готовый текст ответа, без кавычек и пояснений`
      }]
    })
  })

  if (!res.ok) {
    const err = await res.text()
    return { statusCode: res.status, body: JSON.stringify({ error: err }) }
  }

  const data = await res.json()
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply: data.content[0].text.trim() })
  }
}
