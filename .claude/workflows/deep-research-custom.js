export const meta = {
  name: 'deep-research-custom',
  description: 'Exhaustive multi-angle deep research with adversarial cross-validation',
  phases: [
    { title: 'Decompose', detail: 'Break the question into sub-questions' },
    { title: 'Gather', detail: 'Parallel web and codebase search across each angle' },
    { title: 'Synthesize', detail: 'Cross-validate findings and build structured report' },
  ],
};

const question = args || $ARGUMENTS;

if (!question) {
  throw new Error('Usage: /deep-research-custom <your research question>');
}

phase('Decompose');
const decomposition = await agent(
  `Decompose this research question into 3-6 sub-questions that each address an orthogonal angle: "${question}". For each sub-question, specify what sources to check. Return as JSON array of {subQuestion, sources[], importance(1-5)}.`,
  {
    label: 'decompose-question',
    phase: 'Decompose',
    schema: {
      type: 'object',
      required: ['subQuestions'],
      properties: {
        subQuestions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['subQuestion', 'sources', 'importance'],
            properties: {
              subQuestion: { type: 'string' },
              sources: {
                type: 'array',
                items: { type: 'string', enum: ['web', 'codebase', 'docs'] },
              },
              importance: { type: 'number', minimum: 1, maximum: 5 },
            },
          },
        },
      },
    },
  },
);

const sqs = (decomposition?.subQuestions ?? []).filter(Boolean);
log(`Decomposed into ${sqs.length} sub-questions`);

phase('Gather');
const findings = await pipeline(sqs, async (sq) => {
  const result = { question: sq.subQuestion, sources: [], answers: [] };

  if (sq.sources.includes('web')) {
    const webResult = await agent(
      `Research this question thoroughly using web search: "${sq.subQuestion}". Provide key findings with specific citations.`,
      { label: `web:${sq.subQuestion.slice(0, 40)}`, phase: 'Gather' },
    );
    if (webResult) result.answers.push({ type: 'web', content: webResult });
  }

  if (sq.sources.includes('codebase')) {
    const codeResult = await agent(
      `Search the local codebase to answer: "${sq.subQuestion}". Read relevant files and report findings with file paths.`,
      { label: `code:${sq.subQuestion.slice(0, 40)}`, phase: 'Gather' },
    );
    if (codeResult) result.answers.push({ type: 'codebase', content: codeResult });
  }

  return result;
});

const validFindings = findings.filter(Boolean);
log(`Gathered ${validFindings.length} finding sets`);

phase('Synthesize');
const report = await agent(
  `Synthesize all findings below into a comprehensive research report addressing the original question: "${question}". Cross-validate claims across sources, flag contradictions, rate confidence (high/medium/low) for each major claim, and identify open questions. Format as a structured markdown report with sections: Executive Summary, Detailed Findings, Confidence Assessment, Open Questions, Sources.`,
  {
    label: 'synthesize-report',
    phase: 'Synthesize',
    files: validFindings
      .map(
        (f, i) =>
          `--- Finding Set ${i + 1}: ${f.question} ---\n${f.answers.map((a) => a.content).join('\n')}`,
      )
      .join('\n\n'),
  },
);

return report;
