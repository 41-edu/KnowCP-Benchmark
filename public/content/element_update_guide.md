# Element Update Guide

This document explains how to update all Element-related website data after new element annotations or element questions are added.

## Inputs
- docs/annotations/objects_annotation_applied.json
- docs/questions/by_type/ER_choice.jsonl
- docs/questions/by_type/ER_fillin.jsonl

## Output files
- public/content/annotation-elements.json
- public/content/data-distribution.json
- public/content/question-section.json
- public/content/question-cases/ER_choice.json
- public/content/question-cases/ER_fillin.json

## Rebuild command
- npm run build:content

## Validation checklist
1. Confirm new labels appear in annotation-elements top level and nested levels.
2. Confirm each updated label has both count and directCount.
3. Confirm ER_choice groups expose existing L1/L2/L3 tabs only.
4. Confirm Data Distribution -> Elements total equals total object bbox count.
5. Confirm Question Distribution counts match by_type ER files.

## Notes
- Hierarchy is generated from actual annotation labels. No fixed dictionary is required.
- If a label text format changes, keep separators stable (/ or >), or update parser logic in tools/build_content.mjs.
