import { NextRequest, NextResponse } from 'next/server'
import { generateZaiResponse, ZaiContext } from '@/lib/zai-chat'
import { buildSystemPrompt, buildPrompt, routeQuestion, isForbiddenQuestion, getSafeDeclineResponse } from '@/lib/brains'
import pool from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, question, user_id, context: clientContext } = body

    // Support both 'message' and 'question' for backward compatibility
    const userMessage = message || question

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid question' },
        { status: 400 }
      )
    }

    // Build context from user data (if user_id provided)
    const context: ZaiContext = clientContext || {}

    if (user_id) {
      // Get user profile
      const userResult = await pool.query(
        'SELECT name, home_type, transport_mode FROM users WHERE id = $1',
        [user_id]
      )

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0]
        context.userProfile = {
          name: user.name,
          home_type: user.home_type,
          transport_baseline: user.transport_mode,
        }
      }

      // Get completed journeys
      const journeysResult = await pool.query(
        `SELECT DISTINCT journey_id 
         FROM journey_answers 
         WHERE user_id = $1 
         GROUP BY journey_id 
         HAVING COUNT(*) = (
           SELECT COUNT(*) 
           FROM journeys j 
           WHERE j.id = journey_id
         )`,
        [user_id]
      )
      context.completedJourneys = journeysResult.rows.map((r: any) => r.journey_id)

      // Get liked cards
      const likesResult = await pool.query(
        'SELECT card_id FROM likes WHERE user_id = $1',
        [user_id]
      )
      if (likesResult.rows.length > 0) {
        const cardIds = likesResult.rows.map((r: any) => r.card_id)
        const cardsResult = await pool.query(
          'SELECT title, category FROM cards WHERE id = ANY($1::text[])',
          [cardIds]
        )
        context.likedCards = cardsResult.rows.map((r: any) => ({
          title: r.title,
        }))
      }

      // Get visible cards (recently shown)
      const viewsResult = await pool.query(
        `SELECT DISTINCT c.id, c.title, c.journey_key 
         FROM cards c
         INNER JOIN card_views cv ON cv.card_id = c.id
         WHERE cv.user_id = $1
         ORDER BY cv.last_shown_at DESC
         LIMIT 10`,
        [user_id]
      )
      context.visibleCards = viewsResult.rows.map((r: any) => ({
        title: r.title,
        journey: r.journey_key,
      }))
    }

                // Use AI endpoint if available, otherwise fallback to rule-based logic
                if (process.env.AI_ENDPOINT) {
                  const prompt = buildPrompt(userMessage, context)

      try {
        const aiResponse = await fetch(process.env.AI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        })

        if (aiResponse.ok) {
          const data = await aiResponse.json()
          return NextResponse.json({
            answer: data.reply ?? 'I don\'t have enough information to be confident.',
            context: {
              hasProfile: !!context.userProfile,
              completedJourneys: context.completedJourneys?.length || 0,
              likedCards: context.likedCards?.length || 0,
              visibleCards: context.visibleCards?.length || 0,
            },
          })
        }
      } catch (aiError) {
        console.error('AI endpoint error:', aiError)
        // Fall through to rule-based fallback
      }
    }

    // Fallback to rule-based response (no memory, no hallucination)
    const answer = generateZaiResponse(userMessage, context)

    return NextResponse.json({
      answer,
      context: {
        hasProfile: !!context.userProfile,
        completedJourneys: context.completedJourneys?.length || 0,
        likedCards: context.likedCards?.length || 0,
        visibleCards: context.visibleCards?.length || 0,
      },
    })
  } catch (error) {
    console.error('Error in Zai chat:', error)
    return NextResponse.json(
      { error: 'Failed to generate response', answer: 'I don\'t have enough information to be confident.' },
      { status: 500 }
    )
  }
}
