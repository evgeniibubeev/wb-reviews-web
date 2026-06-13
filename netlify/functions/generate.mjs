export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY не задан' }) }

  let type = 'review', review, question, examples = []
  try {
    ;({ type = 'review', review, question, examples = [] } = JSON.parse(event.body))
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Неверный формат запроса' }) }
  }

  let prompt

  if (type === 'question') {
    const text    = question.text || '(без текста)'
    const product = question.productDetails?.productName || 'товар'
    prompt =
      `Ты менеджер магазина на Wildberries. Ответь на вопрос покупателя.\n\n` +
      `Товар: ${product}\nВопрос: "${text}"\n\n` +
      `Правила:\n` +
      `- Обращение на "Вы", вежливо и конкретно\n` +
      `- 1–3 предложения\n` +
      `- Дай полезный ответ по существу вопроса\n` +
      `- Если не хватает информации — предложи написать в чат поддержки\n` +
      `- Только готовый текст ответа, без кавычек и пояснений`
  } else {
    const stars   = review.productValuation || 0
    const text    = review.text || '(без текста)'
    const product = review.productDetails?.productName || 'товар'

    const sameStars = examples.filter(e => e.stars === stars)
    const other     = examples.filter(e => e.stars !== stars)
    const picked    = [...sameStars, ...other].slice(0, 5)

    let examplesBlock = ''
    if (picked.length > 0) {
      examplesBlock =
        `\nВот примеры уже отправленных ответов этого магазина — используй их как образец стиля:\n\n` +
        picked.map((e, i) =>
          `Пример ${i + 1} (${e.stars}⭐):\nОтзыв: "${e.reviewText}"\nОтвет: "${e.answerText}"`
        ).join('\n\n') +
        `\n\nТеперь напиши ответ в том же стиле:\n`
    }

    prompt =
      `Ты менеджер магазина на Wildberries. Напиши ответ на отзыв покупателя.` +
      examplesBlock +
      `\nТовар: ${product}\nОценка: ${stars}/5 ⭐\nОтзыв: "${text}"\n\n` +
      `Правила:\n` +
      `- Обращение на "Вы", вежливо и по делу\n` +
      `- 2–3 предложения, не больше\n` +
      `- 1–2 ⭐: выразить сожаление, попросить написать в чат поддержки для решения вопроса\n` +
      `- 3 ⭐: поблагодарить за обратную связь, учтём пожелания\n` +
      `- 4–5 ⭐: поблагодарить, пригласить снова\n` +
      `- Только готовый текст ответа, без кавычек и пояснений`
  }

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
      messages: [{ role: 'user', content: prompt }]
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
