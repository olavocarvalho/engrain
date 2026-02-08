# The Experiment: Does Passive Context Beat Active Retrieval?

**2026-02-02:** Experiment design complete
**2026-02-07:** The tool is stable to be used in a controlled experiment

## The Question

Does embedding a compressed documentation index directly in AGENTS.md — making knowledge always available in context — measurably improve agent task success rates on real-world ML repositories compared to skill-based, just-in-time retrieval approaches?

More broadly: Is always-on context” actually better than dynamic retrieval” for coding agents in practice?

## Why This Experiment Exists

Over the past two years, our thinking about working with AI coding agents has shifted in two major ways:

- **From prompt engineering to context engineering**: Instead of trying to “coach” the model with ever-better prompts, we began shaping what information the model sees by default.

- **From context enginering to dynamic retrieval**: The rise of skills and tools promised a cleaner solution: keep the core context lean, and let the agent fetch knowledge only when needed.

At my day job, we rely heavily on internal frameworks, so I assumed skills were the future. Why cram everything into context when you can teach the agent to fetch what it needs?

But, anyone who has seriously used skills with coding agents has felt it: sometimes they work beautifully; other times the model just… ignores them. This isn’t just anecdotal — it’s a [known limitation](https://developers.openai.com/blog/eval-skills) in today’s models.

Then I read [Vercel’s unexpected finding](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) that AGENTS.dm outperformed skills in agent evals. A **100% pass rate** using a minified index of the docs injected in AGENTS.md, compared to **79%** for skills with explicit trigger instructions and **53%** for skills with default behavior.

The approach to minify and inject the docs into AGENTS.md seems to have a good balance of not bloating the context while keeping it always-on. This experiment aims to reproduce and extend that comparison in other domains.


## Experiment design

This experiment explores how context strategy shapes agent coding capabilities with unfamiliar frameworks, due to time and money budgets, I'll explore only in data science domain.  

The primary testbed is [nubank/fklearn](https://github.com/nubank/fklearn), a functional ML library with learner-function pipelines, curry-style composition, and abstractions that are likely unfamiliar to most models — a realistic stress test for both passive context and retrieval. 

### What I'm Testing

#### Conditions:

1. **A — Baseline (no docs)** — Agent has access to code only. Tests pre-training knowledge.
2. **B — Skill (discoverable)** — Agent is told a skill file exists; decides whether to read it. Tests the decision-point problem.
3. **B+ — Skill (explicitly instructed)** — Same skill, plus explicit instruction to read it before coding. Tests whether prompting to use docs is sufficient.
4. **C — Preloaded index** — Full docs index embedded in agent's system prompt via engrain. Eliminates the decision point entirely.

#### Task categories
1. **Code navigation** - Can the agent find and understand specific functions/modules?
2. **API understanding** - Can it correctly use library APIs without examples?
3. **Bug diagnosis** - Can it identify and fix issues in ML pipelines?
4. **Feature extension** - Can it add new learners following library patterns?
5. **Doc retrieval** - Can it answer questions about library design?
6. **Conceptual reasoning** - Can it explain functional programming concepts in the library?

### Success Metrics

- **Task completion rate** - Did the agent complete the task correctly?
- **Total tokens consumption** - Which approach is more token-efficient per successful task?
- **Time to completion** - How long did it take?
- **Tool invocations** - How many tool calls were needed?
- **Retrieval accuracy** - Did the agent find relevant documentation when needed?
- **Failure modes** - When did passive context hurt rather than help?

### Reproducibility Protocol

- Pinned commits for `fklearn` repository
- Paired seeds for each task/condition combination
- Containerized execution environment 
- Confidence intervals calculated using bootstrap resampling
- All experimental code and data published

## Outcome

If the results show meaningful differences that validate passive context, engrain can become a useful tool until new generations of models solve the problem at foundation level.

If the results don't show meaningful differences, or if passive context creates more problems than it solves, I'll archive the repo and write up what I learned.

Either way, we'll have actual data instead of anecdotes.