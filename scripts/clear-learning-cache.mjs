#!/usr/bin/env node
/**
 * Prints browser localStorage keys to clear for a fresh loop + Zai learning test.
 * Run in DevTools console on http://127.0.0.1:3000/zone (or any app route):
 *
 *   localStorage.removeItem('zz_loop_answered_ids');
 *   localStorage.removeItem('zz_pinned_achievements');
 *   localStorage.removeItem('zz_loop_answers_log');
 *   localStorage.removeItem('zz_zai_likes');
 *   localStorage.removeItem('zz_recent_chat_history');
 *   Object.keys(localStorage).filter(k => k.startsWith('journey_') && k.endsWith('_answers')).forEach(k => localStorage.removeItem(k));
 *   location.reload();
 */

console.log(`
Clear learning cache (paste in browser console):

localStorage.removeItem('zz_loop_answered_ids');
localStorage.removeItem('zz_pinned_achievements');
localStorage.removeItem('zz_loop_answers_log');
localStorage.removeItem('zz_zai_likes');
localStorage.removeItem('zz_recent_chat_history');
Object.keys(localStorage).filter(k => k.startsWith('journey_') && k.endsWith('_answers')).forEach(k => localStorage.removeItem(k));
location.reload();

Neon (server): journey_answers_jsonb + users profile — loop question_ids stored under journey_* keys after POST /api/answers.
`)
