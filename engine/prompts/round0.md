[ralph:round0]
You are the setup step of an autonomous build loop. Never ask questions; log assumptions in {{LOOP_DIR}}/DECISIONS.md ("[round 0, setup] ...").
Working directory is the repo on branch {{BASE_BRANCH}}.

Read {{RULES_FILE}} if it exists, {{LOOP_DIR}}/SPEC.md, {{LOOP_DIR}}/CONTRACTS.md.
Create the skeleton so the areas ({{AREAS_CSV}}) can work in parallel without waiting for each other:
- The folder layout for each area from the ownership table in CONTRACTS.md, each with a tiny placeholder file so it is tracked.
- Every shared type, interface or function signature listed in CONTRACTS.md, as real code that compiles / parses, with doc comments. Stubs are fine for bodies. Keep files small.
- If the repo has a layout or structure list in {{RULES_FILE}}, add the new folders to it.
Run the full checks until clean: {{FULL_CHECK}}
Commit on {{BASE_BRANCH}}. One commit.
