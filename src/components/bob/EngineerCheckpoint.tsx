import { useState } from 'react';
import { Check, Lightbulb } from 'lucide-react';

const checkpoints = {
  database: { question: 'More API servers, same overloaded database. What helps most?', choices: ['Keep adding API servers', 'Cache repeated balance reads', 'Ignore the slow requests'], answer: 1, explanation: 'Redis can answer repeated reads before they reach PostgreSQL. More API workers alone still send that work to the same database.' },
  compute: { question: 'Database pressure is down. API CPU is still high. Your next experiment?', choices: ['Add or resize an API worker', 'Add another cache', 'Remove the load balancer'], answer: 0, explanation: 'The remaining pressure is in the API layer. Test more compute capacity, then check the cost and performance together.' },
  disconnected: { question: 'A server is on the canvas but receives no traffic. Is it helping?', choices: ['Yes, just being there adds capacity', 'Only if it has more memory', 'No, it needs a complete request path'], answer: 2, explanation: 'Capacity only helps when requests can reach the server and the server can reach its dependencies. Inspect the connections.' },
  budget: { question: 'All performance targets pass, but the bill is too high. What next?', choices: ['Declare victory', 'Remove or downsize capacity and retest', 'Stop measuring the cost'], answer: 1, explanation: 'A working design also meets its budget. Make one small capacity change and rerun the same traffic to test the trade-off.' },
  success: { question: 'A balance changes. What must happen to its cached value?', choices: ['Keep it forever', 'Treat the cache as the source of truth', 'Invalidate or update it after the write'], answer: 2, explanation: 'PostgreSQL is authoritative. In this mission, writes invalidate the cached balance so the next read can fetch the new value.' },
};

export function EngineerCheckpoint({ topic }: { topic: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const quiz = checkpoints[topic as keyof typeof checkpoints] ?? checkpoints.database;
  const correct = selected === quiz.answer;
  return <section className="engineer-checkpoint" aria-label="Engineer checkpoint"><div className="eyebrow"><Lightbulb size={13} /> BOB’S QUICK CHECK</div><h3>{quiz.question}</h3><div className="checkpoint-options">{quiz.choices.map((choice, index) => <button key={choice} aria-pressed={selected === index} className={selected === index ? correct ? 'is-correct' : 'try-again' : ''} onClick={() => setSelected(index)}><span>{selected === index && correct ? <Check size={12} /> : String.fromCharCode(65 + index)}</span>{choice}</button>)}</div>{selected !== null && <p className="checkpoint-feedback" role="status"><strong>{correct ? 'You’ve got it! ' : 'Good hypothesis. Think about this: '}</strong>{quiz.explanation}</p>}</section>;
}
