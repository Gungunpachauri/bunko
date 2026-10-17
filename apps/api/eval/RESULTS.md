# Evaluation results

Run 2026-10-15T19:35:52 · LLM: gemini gemini-flash-latest · embeddings snowflake/snowflake-arctic-embed-xs · reranker jinaai/jina-reranker-v1-turbo-en

Questions: `eval/questions.json`. Raw answers: `eval/results/20261015-200920.json`.

| Metric | Spoiler-safe (app) | No position filter (baseline) |
|---|---|---|
| questions | 18 | 18 |
| LLM answered | 6/18 | 6/18 |
| recall@3 | 36% (5/14) | 57% (8/14) |
| recall@8 | 100% (14/14) | 79% (11/14) |
| citation support | 100% (4/4) | 80% (4/5) |
| invalid citations | 0 | 0 |
| past-position hits | 0 | 102 |
| answer leak rate | 0% (0/6) | 17% (1/6) |
| leaks flagged | 0/0 | 0/1 |
| trap abstention | 100% (2/2) | 0% (0/1) |
| median seconds | 15.5 | 9.25 |

## Per question

| Question | safe | open |
|---|---|---|
| pp-insult | found, _no answer (LLM error)_ | missed, _no answer (LLM error)_ |
| pp-news | found, _no answer (LLM error)_ | missed, uncited |
| pp-income | found, _no answer (LLM error)_ | found, cited |
| pp-trap-derbyshire | declined | _no answer (LLM error)_ |
| fr-walton | found, _no answer (LLM error)_ | found, _no answer (LLM error)_ |
| fr-agrippa | found, _no answer (LLM error)_ | missed, _no answer (LLM error)_ |
| fr-electricity | found, _no answer (LLM error)_ | found, cited |
| fr-awakening | found, _no answer (LLM error)_ | found, cited |
| fr-trap-language | _no answer (LLM error)_ | _no answer (LLM error)_ |
| al-bottle | found, _no answer (LLM error)_ | found, _no answer (LLM error)_ |
| al-caterpillar | found, cited | found, cited |
| al-trap-trial | _no answer (LLM error)_ | answered, **leaked Knave** |
| me-verus | found, cited | found, _no answer (LLM error)_ |
| aw-factors | found, _no answer (LLM error)_ | found, _no answer (LLM error)_ |
| aw-know | found, cited | found, _no answer (LLM error)_ |
| si-friend | found, _no answer (LLM error)_ | found, _no answer (LLM error)_ |
| si-gotama | found, cited | found, _no answer (LLM error)_ |
| si-trap-courtesan | declined | _no answer (LLM error)_ |
