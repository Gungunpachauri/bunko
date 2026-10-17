# Evaluation results

Run 2026-10-17T20:22:11 · LLM: gemini gemini-flash-latest · embeddings snowflake/snowflake-arctic-embed-xs · reranker jinaai/jina-reranker-v1-turbo-en

Questions: `eval/questions.json`. Each question is asked as a reader who has reached a set point in the book, once with spoiler-safe search (the app) and once without the reading-position filter (baseline). Full answers are saved locally in `eval/results/` (not committed).

| Metric | Spoiler-safe (app) | No position filter (baseline) |
|---|---|---|
| questions | 18 | 18 |
| LLM answered | 18/18 | 18/18 |
| recall@3 | 36% (5/14) | 57% (8/14) |
| recall@8 | 100% (14/14) | 79% (11/14) |
| citation support | 100% (14/14) | 7% (1/14) |
| invalid citations | 0 | 1 |
| past-position hits | 0 | 102 |
| answer leak rate | 0% (0/18) | 17% (3/18) |
| leaks flagged | none to flag | off (spoilers allowed) |
| trap abstention | 100% (4/4) | 25% (1/4) |
| median seconds | 14.1 | 8.8 |

## Per question

| Question | safe | open |
|---|---|---|
| pp-insult | found, cited | missed, uncited |
| pp-news | found, cited | missed, uncited |
| pp-income | found, cited | found, uncited |
| pp-trap-derbyshire | declined | declined |
| fr-walton | found, cited | found, uncited |
| fr-agrippa | found, cited | missed, uncited |
| fr-electricity | found, cited | found, uncited |
| fr-awakening | found, cited | found, uncited |
| fr-trap-language | declined | answered, **leaked De Lacey** |
| al-bottle | found, cited | found, uncited |
| al-caterpillar | found, cited | found, uncited |
| al-trap-trial | declined | answered, **leaked Knave** |
| me-verus | found, cited | found, uncited |
| aw-factors | found, cited | found, uncited |
| aw-know | found, cited | found, cited |
| si-friend | found, cited | found, uncited |
| si-gotama | found, cited | found, uncited |
| si-trap-courtesan | declined | answered, **leaked Kamala** |
